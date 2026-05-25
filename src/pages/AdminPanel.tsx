// src/pages/AdminPanel.tsx — VoxMeet Admin
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, SubscriptionPlan, PLAN_CONFIGS } from '../types';
import { cn } from '../lib/utils';
import { Shield, Users, Crown, Star, Zap, Sparkles, RefreshCw, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ADMIN_EMAIL = 'consultoriaetims@gmail.com';

interface UserRow extends UserProfile {
  uid: string;
  meetingsCount?: number;
}

const PLAN_ICONS: Partial<Record<SubscriptionPlan, React.ReactNode>> = {
  starter: <Zap className="w-4 h-4" />,
  pro: <Star className="w-4 h-4" />,
  pro_monthly: <Star className="w-4 h-4" />,
  ultra: <Sparkles className="w-4 h-4" />,
  pro_annual: <Sparkles className="w-4 h-4" />,
  power: <Crown className="w-4 h-4" />,
};

const PLAN_COLORS: Partial<Record<SubscriptionPlan, string>> = {
  starter: 'text-white/30',
  pro: 'text-blue-400',
  pro_monthly: 'text-blue-400',
  ultra: 'text-purple-400',
  pro_annual: 'text-purple-400',
  power: 'text-amber-400',
};

export default function AdminPanel() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user || user.email !== ADMIN_EMAIL) {
        navigate('/');
        return;
      }
      loadUsers();
    });
    return () => unsub();
  }, []);

  const loadUsers = async () => {
    setIsRefreshing(true);
    try {
      const snapshot = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      const rows: UserRow[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Omit<UserProfile, 'uid'>;
        const meetingsSnap = await getDocs(collection(db, `users/${docSnap.id}/meetings`));
        rows.push({ uid: docSnap.id, ...data, meetingsCount: meetingsSnap.size });
      }
      setUsers(rows);
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleChangePlan = async (uid: string, newPlan: SubscriptionPlan) => {
    setUpdatingId(uid);
    try {
      const planConfig = PLAN_CONFIGS[newPlan];
      await updateDoc(doc(db, 'users', uid), {
        plan: newPlan,
        minutesLimit: planConfig.minutesPerMonth,
        minutesUsed: 0,
        planExpiresAt: newPlan === 'ultra' || newPlan === 'pro_annual'
          ? Date.now() + 365 * 24 * 60 * 60 * 1000
          : newPlan === 'pro' || newPlan === 'pro_monthly' || newPlan === 'power'
          ? Date.now() + 30 * 24 * 60 * 60 * 1000
          : null,
      });
      setUsers(prev => prev.map(u =>
        u.uid === uid ? { ...u, plan: newPlan, minutesUsed: 0, minutesLimit: planConfig.minutesPerMonth } : u
      ));
    } catch (e) {
      console.error('Erro ao atualizar plano:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const counts = {
    total: users.length,
    starter: users.filter(u => u.plan === 'starter').length,
    pro: users.filter(u => u.plan === 'pro' || u.plan === 'pro_monthly').length,
    ultra: users.filter(u => u.plan === 'ultra' || u.plan === 'pro_annual').length,
    power: users.filter(u => u.plan === 'power').length,
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
        <Shield className="w-12 h-12 text-white/20" />
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      <div className="max-w-6xl mx-auto px-6 py-8">

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">VoxMeet Admin</h1>
              <p className="text-xs text-white/30">{currentUser?.email}</p>
            </div>
          </div>
          <button onClick={loadUsers} disabled={isRefreshing} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-white/60 transition-colors">
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            Atualizar
          </button>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Total', value: counts.total, icon: <Users className="w-4 h-4" />, color: 'text-white/60' },
            { label: 'Starter', value: counts.starter, icon: <Zap className="w-4 h-4" />, color: 'text-white/30' },
            { label: 'Pro', value: counts.pro, icon: <Star className="w-4 h-4" />, color: 'text-blue-400' },
            { label: 'Ultra', value: counts.ultra, icon: <Sparkles className="w-4 h-4" />, color: 'text-purple-400' },
            { label: 'Power', value: counts.power, icon: <Crown className="w-4 h-4" />, color: 'text-amber-400' },
          ].map((card) => (
            <div key={card.label} className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <div className={cn("flex items-center gap-2 mb-2", card.color)}>
                {card.icon}
                <span className="text-xs font-medium">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
            </div>
          ))}
        </div>

        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por email ou nome..."
          className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-white/20 outline-none mb-4 transition-all"
        />

        <div className="space-y-2">
          {filtered.map((user) => {
            const planConfig = PLAN_CONFIGS[user.plan ?? 'starter'];
            return (
              <motion.div key={user.uid} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 flex-wrap"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{user.displayName || 'Sem nome'}</p>
                  <p className="text-xs text-white/40 truncate">{user.email}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-white/20 font-mono">
                    <span>{user.meetingsCount || 0} reuniões</span>
                    <span>·</span>
                    <span>{user.minutesUsed || 0} min usados</span>
                    {user.createdAt && <><span>·</span><span>desde {new Date(user.createdAt).toLocaleDateString('pt-BR')}</span></>}
                    {user.planExpiresAt && <><span>·</span><span className="text-amber-400">expira {new Date(user.planExpiresAt).toLocaleDateString('pt-BR')}</span></>}
                  </div>
                </div>

                <div className={cn("flex items-center gap-1.5 text-sm font-bold", PLAN_COLORS[user.plan ?? 'starter'] ?? 'text-white/30')}>
                  {PLAN_ICONS[user.plan ?? 'starter'] ?? <Zap className="w-4 h-4" />}
                  {planConfig?.name ?? user.plan}
                </div>

                <div className="relative">
                  <select
                    value={user.plan ?? 'starter'}
                    onChange={(e) => handleChangePlan(user.uid, e.target.value as SubscriptionPlan)}
                    disabled={updatingId === user.uid}
                    className="appearance-none bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 pr-8 outline-none cursor-pointer hover:bg-white/15 transition-colors disabled:opacity-50"
                  >
                    <option value="starter" className="bg-[#050505]">Starter (Free)</option>
                    <option value="pro" className="bg-[#050505]">Pro — R$ 9,99/mês</option>
                    <option value="ultra" className="bg-[#050505]">Ultra — R$ 19,99/mês</option>
                    <option value="power" className="bg-[#050505]">Power — R$ 49,99/mês</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                  {updatingId === user.uid && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                      <RefreshCw className="w-4 h-4 animate-spin text-white/60" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-white/20">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Nenhum usuário encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// src/pages/Dashboard.tsx — VoxMeet
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, List, Settings, Sparkles, LogOut, LogIn, HelpCircle } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { MeetingRecorder } from '../components/MeetingRecorder';
import { AuthModal } from '../components/AuthModal';
import { AudioRecovery } from '../components/AudioRecovery';
import { MeetingList } from '../components/MeetingList';
import { MeetingDetail } from '../components/MeetingDetail';
import { PremiumOverlay } from '../components/PremiumOverlay';
import { FAQView } from '../components/FAQView';
import { Meeting, TranscriptSegment, MeetingSource, UserProfile, SubscriptionPlan, PLAN_CONFIGS, calcExpiresAt } from '../types';
import { summarizeMeeting } from '../services/groqService';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

type View = 'recorder' | 'list' | 'detail' | 'faq' | 'settings';

export default function Dashboard() {
  const [view, setView] = useState<View>('recorder');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setIsLoading(false);
      if (user) {
        const userDoc = doc(db, 'users', user.uid);
        const snap = await getDoc(userDoc);
        if (!snap.exists()) {
          const newProfile: Omit<UserProfile, 'uid'> = {
            displayName: user.displayName || '',
            email: user.email || '',
            plan: 'starter',
            minutesUsed: 0,
            minutesLimit: PLAN_CONFIGS.starter.minutesPerMonth,
            language: 'pt-BR',
            createdAt: Date.now(),
          };
          await setDoc(userDoc, newProfile);
          setUserProfile({ uid: user.uid, ...newProfile });
        } else {
          setUserProfile({ uid: user.uid, ...(snap.data() as Omit<UserProfile, 'uid'>) });
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) { setMeetings([]); return; }
    const path = `users/${currentUser.uid}/meetings`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMeetings(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Meeting)));
    }, (error) => { handleFirestoreError(error, OperationType.LIST, path); });
    return () => unsubscribe();
  }, [currentUser]);

  const handleLogin = () => setShowAuth(true);

  const handleLogout = () => { signOut(auth); navigate('/'); };

  const handleSaveMeeting = async (segments: TranscriptSegment[], source: MeetingSource, audioBlob?: Blob | null) => {
    if (!currentUser) { setShowPremium(true); return; }
    const meetingId = Math.random().toString(36).substr(2, 9);
    const path = `users/${currentUser.uid}/meetings/${meetingId}`;
    const durationSecs = segments.length > 0
      ? Math.round((segments[segments.length - 1].timestamp - segments[0].timestamp) / 1000)
      : 0;
    const newMeeting: Record<string, any> = {
      title: `Reunião ${new Date().toLocaleDateString('pt-BR')}`,
      createdAt: Date.now(),
      duration: durationSecs,
      transcript: segments.map(s => ({ id: s.id, text: s.text, timestamp: s.timestamp, ...(s.speaker ? { speaker: s.speaker } : {}) })),
      source: source ?? 'mic',
      status: 'done',
      userId: currentUser.uid,
      transcriptClean: segmentsClean.map(s => ({
        id: s.id, text: s.text, timestamp: s.timestamp,
        ...(s.speaker ? { speaker: s.speaker } : {}),
      })),
      expiresAt: calcExpiresAt(userProfile?.plan ?? 'starter', Date.now()) ?? null,
    };
    try {
      await setDoc(doc(db, path), newMeeting);
      setSelectedMeeting({ id: meetingId, ...newMeeting } as Meeting);
      setView('detail');
      const mins = Math.ceil(durationSecs / 60);
      await updateDoc(doc(db, 'users', currentUser.uid), { minutesUsed: (userProfile?.minutesUsed || 0) + mins });
    } catch (error) { handleFirestoreError(error, OperationType.CREATE, path); }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!currentUser) return;
    const path = `users/${currentUser.uid}/meetings/${id}`;
    try {
      await deleteDoc(doc(db, path));
      setView('list');
      setSelectedMeeting(null);
    } catch (error) { handleFirestoreError(error, OperationType.DELETE, path); }
  };

  const handleRenameMeeting = async (id: string, newTitle: string) => {
    if (!currentUser || !newTitle.trim()) return;
    const path = `users/${currentUser.uid}/meetings/${id}`;
    try {
      await updateDoc(doc(db, path), { title: newTitle.trim() });
      setMeetings(prev => prev.map(m => m.id === id ? { ...m, title: newTitle.trim() } : m));
      if (selectedMeeting?.id === id) setSelectedMeeting(prev => prev ? { ...prev, title: newTitle.trim() } : prev);
    } catch (error) { handleFirestoreError(error, OperationType.UPDATE, path); }
  };

  const handleSummarizeMeeting = async (id: string) => {
    if (!currentUser) return;
    const meeting = meetings.find(m => m.id === id);
    if (!meeting || meeting.summary) return;
    setIsSummarizing(true);
    try {
      const activeLang = localStorage.getItem('voxmeet_lang') || userProfile?.language || 'pt-BR';
      const result = await summarizeMeeting(meeting.transcript, activeLang, userProfile?.apiKey);
      if (result) {
        const path = `users/${currentUser.uid}/meetings/${id}`;
        await updateDoc(doc(db, path), { summary: result.summary, actionItems: result.actionItems });
        setSelectedMeeting({ ...meeting, summary: result.summary, actionItems: result.actionItems });
      }
    } catch (e: any) { console.error('Summarize error:', e); }
    finally { setIsSummarizing(false); }
  };

  // Cor do plano — suporta planos novos e legados
  const getPlanColor = (plan: SubscriptionPlan): string => {
    const colors: Partial<Record<SubscriptionPlan, string>> = {
      starter: 'text-white/30',
      pro: 'text-blue-400',
      pro_monthly: 'text-blue-400',
      ultra: 'text-purple-400',
      pro_annual: 'text-purple-400',
      power: 'text-amber-400',
    };
    return colors[plan] ?? 'text-white/30';
  };

  const PlanBadge = () => {
    const plan = userProfile?.plan ?? 'starter';
    const config = PLAN_CONFIGS[plan];
    if (!config) return null;
    return (
      <span className={cn('text-[9px] font-bold uppercase tracking-widest', getPlanColor(plan))}>
        {config.name}
      </span>
    );
  };

  const MinutesIndicator = () => {
    if (!userProfile || userProfile.minutesLimit === null) return null;
    const pct = Math.min(100, ((userProfile.minutesUsed || 0) / userProfile.minutesLimit) * 100);
    const isWarning = pct >= 80;
    return (
      <div className="px-6 py-2 border-b border-white/5">
        <div className="flex justify-between text-[10px] text-white/20 mb-1">
          <span>Minutos este mês</span>
          <span className={isWarning ? 'text-amber-400' : ''}>{userProfile.minutesUsed || 0} / {userProfile.minutesLimit} min</span>
        </div>
        <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', isWarning ? 'bg-amber-400' : 'bg-white/20')} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
        <Sparkles className="w-12 h-12 text-white/20" />
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />

      {!currentUser && view !== 'recorder' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 relative z-10">
          <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center">
            <Mic className="w-10 h-10 text-white/50" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-serif italic text-white">Faça login para salvar suas reuniões</h2>
            <p className="text-white/40 max-w-xs mx-auto text-sm">Transcrições salvas com segurança na nuvem.</p>
          </div>
          <button onClick={handleLogin} className="btn-primary py-4 px-10 text-lg flex items-center gap-2">
            <LogIn className="w-5 h-5" /> Entrar com Google
          </button>
        </div>
      ) : (
        <>
          {currentUser && <AudioRecovery userProfile={userProfile} onRecover={(segments, segmentsClean, source) => handleSaveMeeting(segments, segmentsClean, source)} />}
          {currentUser && <MinutesIndicator />}
          <main className="flex-1 relative z-10">
            <AnimatePresence mode="wait">
              {view === 'recorder' && (
                <motion.div key="recorder" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="h-[calc(100vh-80px)]">
                  <MeetingRecorder onSave={handleSaveMeeting} userProfile={userProfile} />
                </motion.div>
              )}
              {view === 'list' && (
                <motion.div key="list" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="h-[calc(100vh-80px)] overflow-y-auto">
                  <MeetingList meetings={meetings} onSelect={(m) => { setSelectedMeeting(m); setView('detail'); }} onDelete={handleDeleteMeeting} onRename={handleRenameMeeting} />
                </motion.div>
              )}
              {view === 'detail' && selectedMeeting && (
                <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-[calc(100vh-80px)] overflow-y-auto">
                  <MeetingDetail meeting={selectedMeeting} onBack={() => setView('list')} onDelete={handleDeleteMeeting} onRename={handleRenameMeeting} onSummarize={handleSummarizeMeeting} isSummarizing={isSummarizing} userProfile={userProfile} />
                </motion.div>
              )}
              {view === 'faq' && (
                <motion.div key="faq" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-[calc(100vh-80px)] overflow-y-auto">
                  <FAQView />
                </motion.div>
              )}
              {view === 'settings' && (
                <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-[calc(100vh-80px)] overflow-y-auto p-6 max-w-lg mx-auto">
                  <h2 className="text-2xl font-serif italic text-white mb-6">Configurações</h2>
                  <div className="glass-card p-5 rounded-2xl border border-white/5 mb-4">
                    <div className="flex items-center gap-3">
                      {currentUser?.photoURL && <img src={currentUser.photoURL} className="w-12 h-12 rounded-full" alt="avatar" />}
                      <div>
                        <p className="text-sm font-medium text-white">{currentUser?.displayName || 'Usuário'}</p>
                        <p className="text-xs text-white/40">{currentUser?.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="glass-card p-5 rounded-2xl border border-white/5 mb-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Plano atual</span>
                      <PlanBadge />
                    </div>
                    <button onClick={() => setShowPremium(true)} className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-colors flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" /> Fazer upgrade
                    </button>
                  </div>
                  {userProfile?.plan === 'power' && (
                    <div className="glass-card p-5 rounded-2xl border border-white/5 mb-4 space-y-3">
                      <p className="text-sm text-white/60">Sua chave Groq (plano Power)</p>
                      <input type="password" defaultValue={userProfile?.apiKey ?? ''} placeholder="gsk_..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 focus:outline-none"
                        onBlur={async (e) => { if (!currentUser) return; await updateDoc(doc(db, 'users', currentUser.uid), { apiKey: e.target.value.trim() || null }); }}
                      />
                      <p className="text-[10px] text-white/20">Obtenha em console.groq.com/keys</p>
                    </div>
                  )}
                  <button onClick={handleLogout} className="w-full py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-400/10 transition-colors text-sm flex items-center justify-center gap-2">
                    <LogOut className="w-4 h-4" /> Sair da conta
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </>
      )}

      <nav className="h-20 glass border-t-0 p-4 relative z-20">
        <div className="max-w-md mx-auto flex items-center justify-around h-full">
          <NavButton active={view === 'recorder'} onClick={() => setView('recorder')} icon={<Mic className="w-6 h-6" />} label="Gravar" />
          <NavButton active={view === 'list' || view === 'detail'} onClick={() => setView('list')} icon={<List className="w-6 h-6" />} label="Reuniões" />
          <NavButton active={view === 'faq'} onClick={() => setView('faq')} icon={<HelpCircle className="w-6 h-6" />} label="FAQ" />
          <button onClick={() => setShowPremium(true)} className="flex flex-col items-center gap-1 text-white/40 hover:text-purple-400 transition-colors">
            <Sparkles className="w-6 h-6" />
            <span className="text-[10px] font-medium uppercase tracking-widest">Premium</span>
          </button>
          {currentUser ? (
            <NavButton active={view === 'settings'} onClick={() => setView('settings')} icon={<Settings className="w-6 h-6" />} label="Config" />
          ) : (
            <button onClick={handleLogin} className="flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors">
              <LogIn className="w-6 h-6" />
              <span className="text-[10px] font-medium uppercase tracking-widest">Login</span>
            </button>
          )}
        </div>
      </nav>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} />
      <PremiumOverlay isOpen={showPremium} onClose={() => setShowPremium(false)} currentPlan={userProfile?.plan ?? 'starter'} />
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1 transition-all rounded-xl px-3 py-1", active ? "text-white" : "text-white/30 hover:text-white/60")}>
      <div className={cn("transition-transform", active && "scale-110")}>{icon}</div>
      <span className={cn("text-[10px] font-medium uppercase tracking-widest transition-opacity", active ? "opacity-100" : "opacity-0")}>{label}</span>
      {active && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-white rounded-full mt-0.5" />}
    </button>
  );
}

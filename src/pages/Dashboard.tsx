import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, List, Settings, Sparkles, LogOut, LogIn, HelpCircle } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { MeetingRecorder } from '../components/MeetingRecorder';
import { MeetingList } from '../components/MeetingList';
import { MeetingDetail } from '../components/MeetingDetail';
import { PremiumOverlay } from '../components/PremiumOverlay';
import { FAQView } from '../components/FAQView';
import { Meeting, TranscriptSegment } from '../types';
import { summarizeMeeting } from '../services/geminiService';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

type View = 'recorder' | 'list' | 'detail' | 'faq';

export default function Dashboard() {
  const [view, setView] = useState<View>('recorder');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoading(false);
      if (user) {
        // Init profile if not exists
        const userDoc = doc(db, 'users', user.uid);
        getDoc(userDoc).then(docSnap => {
          if (!docSnap.exists()) {
            setDoc(userDoc, {
              subscriptionPlan: 'free',
              email: user.email,
              displayName: user.displayName,
            });
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setMeetings([]);
      return;
    }

    const path = `users/${currentUser.uid}/meetings`;
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meeting));
      setMeetings(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    navigate('/');
  };

  const handleSaveMeeting = async (segments: TranscriptSegment[], audioUrl?: string | null) => {
    if (!currentUser) {
      setShowPremium(true);
      return;
    }

    const meetingId = Math.random().toString(36).substr(2, 9);
    const path = `users/${currentUser.uid}/meetings/${meetingId}`;
    
    const newMeeting: Omit<Meeting, 'id'> & { userId: string } = {
      title: `Reunião ${meetings.length + 1}`,
      createdAt: Date.now(),
      duration: segments.length * 5,
      transcript: segments,
      userId: currentUser.uid,
      audioUrl: audioUrl || undefined,
    };

    try {
      await setDoc(doc(db, path), newMeeting);
      setView('detail');
      setSelectedMeeting({ id: meetingId, ...newMeeting });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (!currentUser) return;
    const path = `users/${currentUser.uid}/meetings/${id}`;
    try {
      await deleteDoc(doc(db, path));
      setView('list');
      setSelectedMeeting(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleSummarizeMeeting = async (id: string) => {
    if (!currentUser) return;
    const meeting = meetings.find(m => m.id === id);
    if (!meeting || meeting.summary) return;

    setIsSummarizing(true);
    const summary = await summarizeMeeting(meeting.transcript);
    
    if (summary) {
      const path = `users/${currentUser.uid}/meetings/${id}`;
      try {
        await updateDoc(doc(db, path), { summary });
        setSelectedMeeting({ ...meeting, summary });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
    setIsSummarizing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="w-12 h-12 text-white/20" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white/20 font-sans flex flex-col relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />
      
      {!currentUser && view !== 'recorder' ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 relative z-10">
          <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center">
            <Mic className="w-10 h-10 text-white/50" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-serif italic text-white">Faça login para salvar suas reuniões</h2>
            <p className="text-white/40 max-w-xs mx-auto">Suas transcrições são salvas com segurança na nuvem para você acessar de qualquer lugar.</p>
          </div>
          <button onClick={handleLogin} className="btn-primary py-4 px-10 text-lg">
            <LogIn className="w-5 h-5" /> Entrar com Google
          </button>
        </div>
      ) : (
        <main className="flex-1 relative z-10">
          <AnimatePresence mode="wait">
            {view === 'recorder' && (
              <motion.div
                key="recorder"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="h-[calc(100vh-80px)]"
              >
                <MeetingRecorder onSave={handleSaveMeeting} />
              </motion.div>
            )}

            {view === 'list' && (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-[calc(100vh-80px)] overflow-y-auto"
              >
                <MeetingList 
                  meetings={meetings} 
                  onSelect={(m) => { setSelectedMeeting(m); setView('detail'); }} 
                />
              </motion.div>
            )}

            {view === 'detail' && selectedMeeting && (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-[calc(100vh-80px)] overflow-y-auto"
              >
                <MeetingDetail
                  meeting={selectedMeeting}
                  onBack={() => setView('list')}
                  onDelete={handleDeleteMeeting}
                  onSummarize={handleSummarizeMeeting}
                  isSummarizing={isSummarizing}
                />
              </motion.div>
            )}

            {view === 'faq' && (
              <motion.div
                key="faq"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-[calc(100vh-80px)] overflow-y-auto"
              >
                <FAQView />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      )}

      {/* Navigation Rail */}
      <nav className="h-20 glass border-t-0 p-4 relative z-20">
        <div className="max-w-md mx-auto flex items-center justify-around h-full">
          <NavButton 
            active={view === 'recorder'} 
            onClick={() => setView('recorder')}
            icon={<Mic className="w-6 h-6" />}
            label="Gravar"
          />
          <NavButton 
            active={view === 'list' || view === 'detail'} 
            onClick={() => setView('list')}
            icon={<List className="w-6 h-6" />}
            label="Reuniões"
          />
          <NavButton 
            active={view === 'faq'} 
            onClick={() => setView('faq')}
            icon={<HelpCircle className="w-6 h-6" />}
            label="FAQ"
          />
          <button 
            onClick={() => setShowPremium(true)}
            className="flex flex-col items-center gap-1 text-white/40 hover:text-purple-400 transition-colors"
          >
            <Sparkles className="w-6 h-6" />
            <span className="text-[10px] font-medium uppercase tracking-widest">Premium</span>
          </button>
          
          {currentUser ? (
            <button 
              onClick={handleLogout}
              className="flex flex-col items-center gap-1 text-white/20 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-6 h-6" />
              <span className="text-[10px] font-medium uppercase tracking-widest">Sair</span>
            </button>
          ) : (
            <NavButton 
              active={false}
              onClick={handleLogin}
              icon={<Settings className="w-6 h-6" />}
              label="Login"
            />
          )}
        </div>
      </nav>

      <PremiumOverlay isOpen={showPremium} onClose={() => setShowPremium(false)} />
    </div>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all rounded-xl px-4 py-1",
        active ? "text-white" : "text-white/30 hover:text-white/60"
      )}
    >
      <div className={cn(
        "transition-transform",
        active && "scale-110"
      )}>
        {icon}
      </div>
      <span className={cn(
        "text-[10px] font-medium uppercase tracking-widest transition-opacity",
        active ? "opacity-100" : "opacity-0"
      )}>
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="nav-dot"
          className="w-1 h-1 bg-white rounded-full mt-0.5" 
        />
      )}
    </button>
  );
}

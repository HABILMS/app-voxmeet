// src/components/AuthModal.tsx — VoxMeet
// Login com email/senha + Google (web only)
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signInWithPopup,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Mode = 'login' | 'register' | 'reset';

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isNative = (window as any).Capacitor?.isNativePlatform?.();

  const getErrorMessage = (code: string): string => {
    const messages: Record<string, string> = {
      'auth/user-not-found': 'Email não encontrado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'Email ou senha incorretos.',
      'auth/email-already-in-use': 'Este email já está cadastrado.',
      'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres.',
      'auth/invalid-email': 'Email inválido.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet.',
    };
    return messages[code] || 'Erro ao processar. Tente novamente.';
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!email.trim()) { setError('Informe seu email.'); return; }
    if (mode !== 'reset' && !password) { setError('Informe sua senha.'); return; }
    if (mode === 'register' && !name.trim()) { setError('Informe seu nome.'); return; }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onSuccess();
      } else if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        onSuccess();
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim());
        setSuccess('Email de recuperação enviado! Verifique sua caixa de entrada.');
      }
    } catch (e: any) {
      setError(getErrorMessage(e.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess();
    } catch (e: any) {
      setError(getErrorMessage(e.code));
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setEmail(''); setPassword(''); setName('');
    setError(null); setSuccess(null);
  };

  const switchMode = (newMode: Mode) => {
    reset();
    setMode(newMode);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !isLoading && onClose()}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-[#080808] border border-white/10 rounded-[28px] overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Recuperar senha'}
                </h2>
                <p className="text-xs text-white/30 mt-0.5">VoxMeet</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-300">
                  {success}
                </div>
              )}

              {/* Nome (só no cadastro) */}
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-white/40">Nome completo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 focus:outline-none"
                  />
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/40">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  />
                </div>
              </div>

              {/* Senha */}
              {mode !== 'reset' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-white/40">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 focus:outline-none"
                      onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Botão principal */}
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="w-full py-3 rounded-2xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === 'login' ? (
                  <><LogIn className="w-4 h-4" /> Entrar</>
                ) : mode === 'register' ? (
                  <><UserPlus className="w-4 h-4" /> Criar conta</>
                ) : (
                  'Enviar email de recuperação'
                )}
              </button>

              {/* Google — só na versão web */}
              {!isNative && mode !== 'reset' && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-xs text-white/20">ou</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  <button
                    onClick={handleGoogle}
                    disabled={isLoading}
                    className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-medium text-sm hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continuar com Google
                  </button>
                </>
              )}

              {/* Links de navegação */}
              <div className="flex flex-col items-center gap-2 pt-2">
                {mode === 'login' && (
                  <>
                    <button onClick={() => switchMode('reset')} className="text-xs text-white/30 hover:text-white/60 transition-colors">
                      Esqueci minha senha
                    </button>
                    <button onClick={() => switchMode('register')} className="text-xs text-white/50 hover:text-white transition-colors">
                      Não tenho conta → <span className="text-blue-400">Criar conta grátis</span>
                    </button>
                  </>
                )}
                {mode === 'register' && (
                  <button onClick={() => switchMode('login')} className="text-xs text-white/50 hover:text-white transition-colors">
                    Já tenho conta → <span className="text-blue-400">Entrar</span>
                  </button>
                )}
                {mode === 'reset' && (
                  <button onClick={() => switchMode('login')} className="text-xs text-white/50 hover:text-white transition-colors">
                    ← Voltar para o login
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

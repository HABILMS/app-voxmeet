// src/pages/LandingPage.tsx — VoxMeet
import { useEffect, useState } from 'react';
import { AuthModal } from '../components/AuthModal';
import { DownloadAppButton } from '../components/DownloadAppButton';
import { motion } from 'motion/react';
import {
  ArrowRight, Mic, CheckCircle2, Sparkles, Brain,
  Clock, Shield, MessageSquare, Upload, Zap,
  Star, Crown, Bitcoin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { PLAN_CONFIGS } from '../types';

// Planos ativos para exibição na landing
const LANDING_PLANS = [
  { id: 'starter' as const, icon: <Zap className="w-5 h-5" />, color: 'text-white/40', highlight: false },
  { id: 'pro' as const, icon: <Star className="w-5 h-5" />, color: 'text-blue-400', highlight: true },
  { id: 'ultra' as const, icon: <Sparkles className="w-5 h-5" />, color: 'text-purple-400', highlight: false },
  { id: 'power' as const, icon: <Crown className="w-5 h-5" />, color: 'text-amber-400', highlight: false },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [showAuth, setShowAuth] = useState(false);

  // Redireciona se já estiver logado
  useEffect(() => {
    if (auth.currentUser) navigate('/app');
  }, []);

  const handleGetStarted = () => {
    if (auth.currentUser) { navigate('/app'); return; }
    setShowAuth(true);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden font-sans">

      {/* — HERO — */}
      <section className="relative pt-24 pb-32 px-6">
        <div className="absolute top-[-20%] left-[10%] w-[60%] h-[60%] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-purple-300 mb-8"
          >
            <Sparkles className="w-4 h-4" />
            <span>Powered by Groq Whisper — transcrição ultrarrápida</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-serif italic tracking-tight text-white mb-6 leading-[1.1]"
          >
            Nunca mais perca <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-sans not-italic font-bold">
              nenhum detalhe.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-white/50 mb-10 max-w-2xl mx-auto font-light leading-relaxed"
          >
            Grave reuniões, transcreva com IA em segundos e extraia resumos,
            atas e action items automaticamente. Funciona com WhatsApp, Meet, Zoom e Teams.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={handleGetStarted}
              className="w-full sm:w-auto px-8 py-4 bg-white text-black font-semibold rounded-2xl hover:bg-gray-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-lg"
            >
              <Mic className="w-5 h-5" />
              Começar Grátis
            </button>
            <p className="text-sm text-white/30 font-mono">Sem cartão de crédito</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 flex justify-center"
          >
            <DownloadAppButton variant="hero" />
          </motion.div>
        </div>
      </section>

      {/* — FEATURES — */}
      <section className="py-24 px-6 bg-[#030303] border-t border-white/5">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-serif italic text-white">Tudo que você precisa</h2>
            <p className="text-xl text-white/40 font-light">Para extrair o máximo de cada reunião.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="col-span-1 md:col-span-2 bg-[#080808] border border-white/5 rounded-[32px] p-8 md:p-12 relative overflow-hidden group hover:border-white/10 transition-all">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full group-hover:bg-blue-500/20 transition-all" />
              <div className="relative z-10">
                <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mb-8 border border-blue-500/20">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Funciona com WhatsApp</h3>
                <p className="text-white/50 leading-relaxed mb-6">
                  Grave sua chamada com o app de gravação do celular, faça upload do áudio e o VoxMeet
                  transcreve tudo com precisão. Compatível com MP3, M4A, WAV, OGG e WebM.
                </p>
                <div className="flex gap-3 flex-wrap">
                  {['WhatsApp', 'Google Meet', 'Zoom', 'Teams', 'Upload'].map((tag) => (
                    <span key={tag} className="flex items-center gap-1.5 text-xs font-bold text-white/30 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                      <CheckCircle2 className="w-3 h-3 text-blue-400" /> {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#080808] border border-white/5 rounded-[32px] p-8 relative overflow-hidden group hover:border-white/10 transition-all">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full group-hover:bg-purple-500/20 transition-all" />
              <div className="relative z-10">
                <div className="w-14 h-14 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center mb-8 border border-purple-500/20">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Chat com a Reunião</h3>
                <p className="text-white/50 leading-relaxed">
                  Pergunte qualquer coisa para a IA sobre o que foi discutido. Extraia tarefas,
                  traduza trechos ou gere uma ata formal em segundos.
                </p>
              </div>
            </div>

            <div className="bg-[#080808] border border-white/5 rounded-[32px] p-8 relative overflow-hidden group hover:border-white/10 transition-all">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full transition-all" />
              <div className="relative z-10">
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-8 border border-emerald-500/20">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Groq Whisper</h3>
                <p className="text-white/50 leading-relaxed">
                  O modelo de transcrição mais rápido do mundo. Resultados em segundos,
                  com suporte nativo ao português brasileiro.
                </p>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2 bg-[#080808] border border-white/5 rounded-[32px] p-8 md:p-12 relative overflow-hidden group hover:border-white/10 transition-all">
              <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[100px] rounded-full transition-all" />
              <div className="relative z-10">
                <div className="w-14 h-14 bg-orange-500/10 text-orange-400 rounded-2xl flex items-center justify-center mb-8 border border-orange-500/20">
                  <Brain className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Resumo + Action Items automáticos</h3>
                <p className="text-white/50 leading-relaxed">
                  Após cada reunião, o LLaMA 70B gera um resumo executivo e lista as tarefas identificadas —
                  tudo salvo automaticamente no histórico.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* — PLANOS — */}
      <section className="py-24 px-6 relative">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-serif italic text-white">Planos simples e transparentes</h2>
            <p className="text-white/40">Comece grátis, faça upgrade quando precisar</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {LANDING_PLANS.map(({ id, icon, color, highlight }) => {
              const p = PLAN_CONFIGS[id];
              if (!p) return null;
              return (
                <div
                  key={id}
                  className={`bg-[#080808] border rounded-[24px] p-6 flex flex-col gap-4 ${
                    highlight ? 'border-blue-500/30' : 'border-white/5'
                  }`}
                >
                  {highlight && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-blue-500/20 text-blue-300 font-bold w-fit">
                      Mais popular
                    </span>
                  )}
                  <div className={`flex items-center gap-2 ${color}`}>
                    {icon}
                    <span className="font-bold text-white text-sm">{p.name}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {p.priceMonthlyBRL === 0 ? 'Grátis' : `R$ ${p.priceMonthlyBRL.toFixed(2)}`}
                    </p>
                    <p className="text-xs text-white/30">
                      {p.priceMonthlyBRL === 0 ? 'para sempre' : '/mês'}
                    </p>
                  </div>
                  <ul className="space-y-1.5 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-white/50">
                        <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={handleGetStarted}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                      highlight
                        ? 'bg-white text-black hover:bg-white/90'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {p.priceMonthlyBRL === 0 ? 'Começar grátis' : 'Assinar'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <span className="text-xs text-white/20">Aceitamos:</span>
            <span className="flex items-center gap-1.5 text-xs text-white/30 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
              <Zap className="w-3 h-3 text-green-400" /> Pix
            </span>
            <span className="flex items-center gap-1.5 text-xs text-white/30 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
              <Bitcoin className="w-3 h-3 text-amber-400" /> USDT (TRC-20 / Polygon / BEP-20)
            </span>
          </div>
        </div>
      </section>

      {/* — BENEFÍCIOS — */}
      <section className="py-24 px-6 bg-[#030303] border-t border-white/5">
        <div className="max-w-5xl mx-auto text-center space-y-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white">Projetado para produtividade</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              { icon: <Clock />, title: 'Economize horas', desc: 'Sem anotar atas manualmente. A IA cuida de tudo enquanto você foca na conversa.' },
              { icon: <MessageSquare />, title: 'Fale com a reunião', desc: 'Pergunte qualquer coisa sobre o que foi discutido em linguagem natural.' },
              { icon: <Shield />, title: 'Seus dados, sua chave', desc: 'No plano Power, use sua própria chave API. Zero dependência de terceiros.' },
            ].map((f, i) => (
              <div key={i} className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/[0.07] transition-colors">
                <div className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center mb-6">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                <p className="text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* — CTA — */}
      <section className="py-32 px-6 bg-gradient-to-t from-purple-900/20 to-transparent border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-6xl font-serif italic text-white">Pronto para focar na conversa?</h2>
          <p className="text-xl text-white/50 font-light">
            Junte-se a profissionais que usam VoxMeet para nunca perder um detalhe importante.
          </p>
          <button
            onClick={handleGetStarted}
            className="px-10 py-5 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold rounded-2xl hover:scale-105 transition-transform flex items-center justify-center gap-3 text-xl mx-auto shadow-[0_0_50px_rgba(168,85,247,0.4)]"
          >
            Começar Agora
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-white/10 text-center text-white/20 text-sm">
        <p>© 2026 VoxMeet. Todos os direitos reservados.</p>
        <p className="mt-1 text-xs text-white/10">Powered by Groq Whisper + LLaMA 70B</p>
      </footer>
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} onSuccess={() => navigate('/app')} />
    </div>
  );
}

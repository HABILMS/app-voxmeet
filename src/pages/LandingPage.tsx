import { motion } from 'motion/react';
import { ArrowRight, Mic, CheckCircle2, Sparkles, Brain, Clock, Shield, MessageSquare, Monitor, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

export default function LandingPage() {
  const navigate = useNavigate();

  const handleGetStarted = async () => {
    try {
      if (auth.currentUser) {
        navigate('/app');
        return;
      }
      await signInWithPopup(auth, googleProvider);
      navigate('/app');
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/unauthorized-domain') {
        alert('Erro no Login: Este domínio não está autorizado no Firebase. Adicione ' + window.location.hostname + ' na lista de domínios autorizados no Firebase Console > Authentication > Settings > Authorized domains.');
        return;
      }
      // Fallback: still navigate if auth fails for some reason (users can use anonymously without saving)
      navigate('/app');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500/30 overflow-x-hidden font-sans">
      {/* Hero Section */}
      <section className="relative pt-24 pb-32 px-6">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-20%] left-[10%] w-[60%] h-[60%] bg-purple-600/10 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-purple-300 mb-8"
          >
            <Sparkles className="w-4 h-4" />
            <span>IA turbinada com NVIDIA e Gemini</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
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
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-xl text-white/50 mb-10 max-w-2xl mx-auto font-light leading-relaxed"
          >
            Grave suas telas e áudios, transcreva em tempo real com alta precisão e interaja 
            com nossa IA para obter resumos, atas e decisões em segundos. A ferramenta 
            definitiva para a era da IA.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={handleGetStarted}
              className="w-full sm:w-auto px-8 py-4 bg-white text-black font-semibold rounded-2xl hover:bg-gray-200 transition-all active:scale-95 flex items-center justify-center gap-2 text-lg shadow-[0_0_40px_rgba(255,255,255,0.1)]"
            >
              <Mic className="w-5 h-5" />
              Começar a Gravar Grátis
            </button>
            <div className="text-sm text-white/40 font-mono">
              Não requer cartão de crédito
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Showcase - Bento Grid Style */}
      <section className="py-24 px-6 bg-[#030303] relative border-t border-white/5">
        <div className="max-w-6xl mx-auto space-y-16">
          
          <div className="text-center space-y-4 max-w-2xl mx-auto border-b border-white/5 pb-10">
            <h2 className="text-4xl md:text-5xl font-serif italic text-white tracking-tight">O Fim das Anotações Manuais</h2>
            <p className="text-xl text-white/40 font-light">Tudo que você precisa para extrair o máximo das suas reuniões.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1: Captura Híbrida */}
            <div className="col-span-1 md:col-span-2 bg-[#080808] border border-white/5 rounded-[32px] p-8 md:p-12 relative overflow-hidden group hover:border-white/10 transition-all">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full group-hover:bg-blue-500/20 transition-all" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mb-8 border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                  <Monitor className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Captura Híbrida do Sistema</h3>
                <p className="text-white/50 leading-relaxed mb-8 flex-1">
                  Reuniões no Google Meet, Zoom ou Teams? Não importa. Capture o áudio interno do seu computador junto com seu microfone simultaneamente, garantindo a gravação de todos os participantes.
                </p>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/30 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                     <CheckCircle2 className="w-3 h-3 text-blue-400" /> Desktop
                   </div>
                   <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/30 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                     <CheckCircle2 className="w-3 h-3 text-blue-400" /> Web
                   </div>
                </div>
              </div>
            </div>

            {/* Feature 2: IA Chat */}
            <div className="col-span-1 bg-[#080808] border border-white/5 rounded-[32px] p-8 relative overflow-hidden group hover:border-white/10 transition-all">
               <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full group-hover:bg-purple-500/20 transition-all" />
               <div className="relative z-10">
                 <div className="w-14 h-14 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center mb-8 border border-purple-500/20">
                   <MessageSquare className="w-6 h-6" />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-4">Chat IA Exclusivo</h3>
                 <p className="text-white/50 leading-relaxed">
                   Converse com a transcrição! Peça para a IA <strong>separar por locutores</strong>, <strong>traduzir partes</strong>, extrair metas ou gerar um post para o LinkedIn baseado na reunião. Você no controle.
                 </p>
               </div>
            </div>

            {/* Feature 3: Transcricao */}
            <div className="col-span-1 bg-[#080808] border border-white/5 rounded-[32px] p-8 relative overflow-hidden group hover:border-white/10 transition-all">
               <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-all" />
               <div className="relative z-10">
                 <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-8 border border-emerald-500/20">
                   <Mic className="w-6 h-6" />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-4">Tempo Real</h3>
                 <p className="text-white/50 leading-relaxed">
                   Acompanhe as palavras sendo transcritas milissegundo a milissegundo. Suporte nativo para mais de 50 idiomas e reconhecimento preciso de sotaques intensos.
                 </p>
               </div>
            </div>

            {/* Feature 4: Resumos Meta & Gemini */}
            <div className="col-span-1 md:col-span-2 bg-[#080808] border border-white/5 rounded-[32px] p-8 md:p-12 relative overflow-hidden group hover:border-white/10 transition-all flex flex-col md:flex-row gap-8 items-center">
               <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 blur-[100px] rounded-full group-hover:bg-orange-500/20 transition-all" />
               <div className="relative z-10 flex-1">
                 <div className="w-14 h-14 bg-orange-500/10 text-orange-400 rounded-2xl flex items-center justify-center mb-8 border border-orange-500/20">
                   <Brain className="w-6 h-6" />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-4">Geração de Atas com NVIDIA & Gemini</h3>
                 <p className="text-white/50 leading-relaxed mb-6">
                   Modelos robustos como <strong>Llama 3.1 70B (NVIDIA)</strong> e <strong>Gemini 1.5 Pro</strong> organizam, classificam e preparam tarefas pendentes. Extraia a essência da reunião em 1 clique.
                 </p>
               </div>
               
               {/* Visual Element */}
               <div className="flex-1 w-full relative z-10">
                  <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl backdrop-blur-md shadow-2xl space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                       <FileText className="w-4 h-4 text-orange-400" />
                       <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Output IA</span>
                     </div>
                     <div className="h-4 w-3/4 bg-white/10 rounded" />
                     <div className="h-4 w-full bg-white/5 rounded" />
                     <div className="h-4 w-5/6 bg-white/5 rounded" />
                     <div className="h-4 w-1/2 bg-white/5 rounded" />
                  </div>
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* Benefits / Grid */}
      <section className="py-24 px-6 relative">
        <div className="max-w-6xl mx-auto text-center space-y-16">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold text-white">Projetado para Produtividade</h2>
            <p className="text-white/40 max-w-xl mx-auto">Tudo que você precisa para tornar suas reuniões ágeis e eficientes.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              { icon: <Clock />, title: "Economize Horas", desc: "Não perca mais tempo escrevendo atas manualmente, foque na conversa real." },
              { icon: <MessageSquare />, title: "Fale com a Reunião", desc: "Faça perguntas em linguagem natural para nossa IA sobre o que foi discutido." },
              { icon: <Sparkles />, title: "Multi Modelos", desc: "Usamos os melhores LLMs adequados para o seu momento." }
            ].map((feature, i) => (
              <div key={i} className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-colors">
                <div className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-white/50 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 bg-gradient-to-t from-purple-900/20 to-transparent border-t border-white/5">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-6xl font-serif italic text-white">Pronto para focar na conversa?</h2>
          <p className="text-xl text-white/50 font-light max-w-2xl mx-auto">
            Junte-se a profissionais focados e impulsione a tomada de decisão no seu negócio.
          </p>
          <div className="pt-8">
             <button
              onClick={handleGetStarted}
              className="px-10 py-5 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold rounded-2xl hover:scale-105 transition-transform flex items-center justify-center gap-3 text-xl shadow-[0_0_50px_rgba(168,85,247,0.4)] mx-auto"
            >
              Começar Agora
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/10 text-center text-white/30 text-sm">
        <p>© 2026 Transcrição Pro. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}

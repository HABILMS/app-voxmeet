// src/components/MeetingDetail.tsx — VoxMeet
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Download, Sparkles, Trash2,
  Loader2, MessageSquare, Brain, X, Send,
  FileText, CheckCircle2, Copy, Check
} from 'lucide-react';
import { Meeting, UserProfile } from '../types';
import ReactMarkdown from 'react-markdown';
import { chatWithTranscript } from '../services/groqService';

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onDelete: (id: string) => void;
  onSummarize: (id: string) => void;
  isSummarizing: boolean;
  userProfile?: UserProfile | null;
}

export function MeetingDetail({
  meeting, onBack, onDelete, onSummarize,
  isSummarizing, userProfile
}: MeetingDetailProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [copied, setCopied] = useState(false);
  const responseEndRef = useRef<HTMLDivElement>(null);

  const userApiKey = userProfile?.apiKey ?? null;
  const lang = userProfile?.language ?? 'pt-BR';

  // Exportar transcrição como TXT
  const exportTXT = () => {
    const lines = meeting.transcript.map(
      (s) => `[${new Date(s.timestamp).toLocaleTimeString()}]${s.speaker ? ` ${s.speaker}:` : ''} ${s.text}`
    );
    const content = [
      `VoxMeet — Transcrição`,
      `Reunião: ${meeting.title}`,
      `Data: ${new Date(meeting.createdAt).toLocaleString()}`,
      `Duração: ${Math.floor(meeting.duration / 60)}min ${meeting.duration % 60}s`,
      meeting.summary ? `\n━━ RESUMO ━━\n${meeting.summary}` : '',
      meeting.actionItems?.length
        ? `\n━━ ACTION ITEMS ━━\n${meeting.actionItems.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
        : '',
      `\n━━ TRANSCRIÇÃO COMPLETA ━━\n`,
      ...lines,
    ].filter(Boolean).join('\n');

    download(content, `voxmeet_${meeting.title}.txt`, 'text/plain');
  };

  // Copiar transcrição
  const copyTranscript = async () => {
    const text = meeting.transcript.map((s) => s.text).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Chat com IA sobre a reunião
  const handleChatRequest = async () => {
    if (!chatPrompt.trim() || meeting.transcript.length === 0) return;
    setIsProcessingAI(true);
    setChatResponse('');
    try {
      const response = await chatWithTranscript(
        meeting.transcript, chatPrompt, lang, userApiKey
      );
      setChatResponse(response);
      setTimeout(() => responseEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      setChatResponse(`Erro: ${err.message}`);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const exportChatResponse = () => {
    if (!chatResponse) return;
    download(chatResponse, `voxmeet_ia_${Date.now()}.txt`, 'text/plain');
  };

  const sourceLabel: Record<string, string> = {
    mic: 'Microfone',
    system: 'Meeting (sistema)',
    whatsapp: 'WhatsApp',
    meet: 'Google Meet',
    teams: 'Teams',
    zoom: 'Zoom',
    upload: 'Upload',
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-8 h-full flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between mb-8 gap-3 flex-wrap">
        <button onClick={onBack} className="p-2 glass rounded-2xl hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setIsChatOpen(true)}
            className="btn-secondary text-blue-400 flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Chat IA
          </button>

          <button
            onClick={() => onSummarize(meeting.id)}
            disabled={isSummarizing || !!meeting.summary}
            className="btn-secondary disabled:opacity-40 flex items-center gap-2"
          >
            {isSummarizing
              ? <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              : <Sparkles className="w-4 h-4 text-purple-400" />
            }
            {meeting.summary ? 'Resumido' : 'Resumir'}
          </button>

          <button onClick={copyTranscript} className="btn-secondary flex items-center gap-2">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>

          <button onClick={exportTXT} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            TXT
          </button>

          <button
            onClick={() => onDelete(meeting.id)}
            className="p-2.5 glass rounded-2xl text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto space-y-10 pb-20 scrollbar-hide">

        {/* Título e metadados */}
        <section className="space-y-2">
          <h1 className="text-4xl font-serif italic text-white leading-tight">
            {meeting.title || 'Nova Reunião'}
          </h1>
          <div className="flex items-center gap-3 text-white/30 font-mono text-xs uppercase tracking-widest flex-wrap">
            <span>{new Date(meeting.createdAt).toLocaleString()}</span>
            <span>·</span>
            <span>{Math.floor(meeting.duration / 60)}min {meeting.duration % 60}s</span>
            {meeting.source && (
              <>
                <span>·</span>
                <span>{sourceLabel[meeting.source] ?? meeting.source}</span>
              </>
            )}
          </div>
        </section>

        {/* Resumindo... */}
        {isSummarizing && (
          <div className="glass-card bg-purple-500/10 border-purple-500/20 p-8 flex flex-col items-center gap-4 text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
              <Sparkles className="w-8 h-8 text-purple-400" />
            </motion.div>
            <p className="text-purple-200 font-medium">Gerando resumo com Groq LLaMA...</p>
          </div>
        )}

        {/* Resumo */}
        {meeting.summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card bg-purple-500/5 border-purple-500/10 p-8 space-y-4"
          >
            <div className="flex items-center gap-2 text-purple-400 mb-4">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-bold uppercase tracking-widest text-xs">Resumo Executivo</h3>
            </div>
            <div className="prose prose-invert max-w-none prose-p:text-white/70 prose-headings:text-white">
              <ReactMarkdown>{meeting.summary}</ReactMarkdown>
            </div>
          </motion.div>
        )}

        {/* Action Items */}
        {meeting.actionItems && meeting.actionItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card bg-green-500/5 border-green-500/10 p-6 space-y-3"
          >
            <div className="flex items-center gap-2 text-green-400 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="font-bold uppercase tracking-widest text-xs">Action Items</h3>
            </div>
            <ul className="space-y-2">
              {meeting.actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-white/70 text-sm">
                  <span className="text-green-400 font-bold mt-0.5">{i + 1}.</span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Transcrição completa */}
        <section className="space-y-6">
          <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/20 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Transcrição Completa
          </h3>
          <div className="space-y-8">
            {meeting.transcript.map((segment) => (
              <div key={segment.id} className="flex gap-6 group">
                <div className="shrink-0 pt-1.5 space-y-0.5">
                  <span className="block text-[10px] font-mono text-white/20">
                    {new Date(segment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {segment.speaker && (
                    <span className="block text-[10px] font-mono text-blue-400/60">{segment.speaker}</span>
                  )}
                </div>
                <p className="text-xl font-light text-white/80 leading-relaxed group-hover:text-white transition-colors">
                  {segment.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Modal Chat IA */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !isProcessingAI && setIsChatOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[28px] overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Chat com a Reunião</h3>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">Groq LLaMA 70B</p>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white/40">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {chatResponse ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-white/5 rounded-xl text-sm text-white/50">{chatPrompt}</div>
                    <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                      <div className="prose prose-invert max-w-none prose-sm">
                        <ReactMarkdown>{chatResponse}</ReactMarkdown>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={exportChatResponse}
                        className="text-xs text-white/30 hover:text-green-400 flex items-center gap-1 transition-colors"
                      >
                        <Download className="w-3 h-3" /> Exportar TXT
                      </button>
                      <button
                        onClick={() => { setChatResponse(''); setChatPrompt(''); }}
                        className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1 ml-2"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Nova pergunta
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center gap-4 text-white/20 text-center">
                    <Brain className="w-10 h-10 opacity-10" />
                    <p className="text-sm">Faça perguntas sobre esta reunião</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        'Resuma os 3 pontos principais',
                        'Extraia as tarefas e responsáveis',
                        'Faça uma ata formal',
                        'Quais foram as decisões tomadas?',
                      ].map((p) => (
                        <button
                          key={p}
                          onClick={() => setChatPrompt(p)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded-full border border-white/5 transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={responseEndRef} />
              </div>

              <div className="p-4 border-t border-white/5 relative">
                <textarea
                  value={chatPrompt}
                  onChange={(e) => setChatPrompt(e.target.value)}
                  placeholder="Ex: Quais foram as decisões tomadas?"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 focus:outline-none resize-none h-20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleChatRequest();
                    }
                  }}
                />
                <button
                  onClick={handleChatRequest}
                  disabled={isProcessingAI || !chatPrompt.trim()}
                  className="absolute bottom-7 right-7 p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-20 transition-all"
                >
                  {isProcessingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

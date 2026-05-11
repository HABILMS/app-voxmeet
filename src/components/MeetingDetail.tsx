import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Download, Sparkles, Trash2, FileAudio, Loader2, MessageSquare, Brain, X, Send } from 'lucide-react';
import { Meeting } from '../types';
import ReactMarkdown from 'react-markdown';
import { convertBlobUrlToMp3 } from '../lib/audioUtils';
import { GoogleGenAI } from "@google/genai";

interface MeetingDetailProps {
  meeting: Meeting;
  onBack: () => void;
  onDelete: (id: string) => void;
  onSummarize: (id: string) => void;
  isSummarizing: boolean;
}

export function MeetingDetail({ meeting, onBack, onDelete, onSummarize, isSummarizing }: MeetingDetailProps) {
  const [isExportingMp3, setIsExportingMp3] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantResponse, setAssistantResponse] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const responseEndRef = useRef<HTMLDivElement>(null);

  const exportTranscription = () => {
    const text = meeting.transcript.map(s => `[${new Date(s.timestamp).toLocaleTimeString()}] ${s.text}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-${meeting.title || 'reuniao'}.txt`;
    a.click();
  };

  const checkAudioValid = async () => {
    if (!meeting.audioUrl) return false;
    if (meeting.audioUrl.startsWith('blob:')) {
      try {
        const res = await fetch(meeting.audioUrl, { method: 'HEAD' });
        if (!res.ok) return false;
        return true;
      } catch (e) {
        return false;
      }
    }
    return true;
  };

  const exportAudioWebm = async () => {
    if (!meeting.audioUrl) return;
    const isValid = await checkAudioValid();
    if (!isValid) {
       alert("O áudio não está mais disponível nesta sessão. Links de áudio temporário (WebM) são perdidos quando a página é recarregada para economizar armazenamento.");
       return;
    }
    const a = document.createElement('a');
    a.href = meeting.audioUrl;
    a.download = `audio-${meeting.title || 'reuniao'}.webm`;
    a.click();
  };

  const exportAudioMp3 = async () => {
    if (!meeting.audioUrl) return;
    setIsExportingMp3(true);
    try {
      const isValid = await checkAudioValid();
      if (!isValid) {
         alert("O áudio não está mais disponível nesta sessão. Links de áudio temporário (WebM) são perdidos quando a página é recarregada para economizar armazenamento.");
         return;
      }
      const mp3Blob = await convertBlobUrlToMp3(meeting.audioUrl);
      const url = URL.createObjectURL(mp3Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio-${meeting.title || 'reuniao'}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to convert to mp3', err);
      // fallback to standard export if somehow fails
      alert('Erro ao exportar como MP3. O arquivo original (WebM) pode estar indisponível ou corrompido.');
    } finally {
      setIsExportingMp3(false);
    }
  };

  const handleAssistantRequest = async () => {
    if (!assistantPrompt.trim() || meeting.transcript.length === 0) return;
    setIsProcessingAI(true);
    setAssistantResponse('');
    
    try {
        const apiKey = (process as any).env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
          throw new Error("A chave da API do Gemini não foi encontrada.");
        }

        const ai = new GoogleGenAI({ apiKey });
        const fullText = meeting.transcript.map(s => s.text).join('\n\n');

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            { text: `Você é um assistente de reuniões. Aqui está a transcrição da reunião:\n\n${fullText}\n\nO usuário solicitou: ${assistantPrompt}\n\nResponda de forma profissional e formatada (use markdown se necessário, mas mantenha limpo). Se pedirem para separar locutores, use sua melhor estimativa baseada no contexto. Se pedirem tradução, traduza preservando o tom.` }
          ]
        });

        if (response.text) {
          setAssistantResponse(response.text);
        }
    } catch (err: any) {
        console.error("Assistant error:", err);
        let msg = err.message || 'Falha ao processar solicitação';
        if (msg.includes('API_KEY_SERVICE_BLOCKED') || msg.includes('are blocked')) {
          msg = "Acesso Bloqueado: A chave da API do Gemini possui restrições ou a API (Generative Language) não está ativada no projeto do Render. Acesse aistudio.google.com/app/apikey para usar uma chave válida.";
        }
        alert(`Erro AI: ${msg}`);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const exportAssistantResponse = () => {
    if (!assistantResponse) return;
    const blob = new Blob([assistantResponse], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ia_reuniao_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-8 h-full flex flex-col">
      <header className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="p-2 glass rounded-2xl hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setIsAssistantOpen(true)}
            className="btn-secondary text-blue-400"
            title="Solicitações customizadas com IA"
          >
            <MessageSquare className="w-5 h-5" />
            IA Chat
          </button>
          
          {meeting.audioUrl && (
            <>
              <button 
                onClick={exportAudioMp3} 
                className="btn-secondary text-green-400 disabled:opacity-50"
                disabled={isExportingMp3}
                title="Exportar como MP3"
              >
                {isExportingMp3 ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileAudio className="w-5 h-5" />}
                MP3
              </button>
              <button onClick={exportAudioWebm} className="btn-secondary text-blue-400" title="Exportar como WebM">
                <FileAudio className="w-5 h-5" />
                WebM
              </button>
            </>
          )}
          <button 
            onClick={() => onSummarize(meeting.id)}
            disabled={isSummarizing || !!meeting.summary}
            className="btn-secondary disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5 text-purple-400" />
            AI Resumo
          </button>
          <button onClick={exportTranscription} className="btn-secondary">
            <Download className="w-5 h-5" />
            Exportar
          </button>
          <button onClick={() => onDelete(meeting.id)} className="p-3 glass rounded-2xl text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto space-y-12 pb-20 scrollbar-hide">
        <section className="space-y-2">
          <h1 className="text-4xl font-serif italic text-white leading-tight">
            {meeting.title || 'Nova Reunião'}
          </h1>
          <div className="flex items-center gap-4 text-white/40 font-mono text-xs uppercase tracking-widest">
            <span>{new Date(meeting.createdAt).toLocaleString()}</span>
            <span>•</span>
            <span>{Math.floor(meeting.duration / 60)}min {meeting.duration % 60}s</span>
          </div>
        </section>

        {isSummarizing && (
          <div className="glass-card bg-purple-500/10 border-purple-500/20 p-8 flex flex-col items-center gap-4 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-8 h-8 text-purple-400" />
            </motion.div>
            <p className="text-purple-200 font-medium tracking-wide">A IA está processando o resumo da sua reunião...</p>
          </div>
        )}

        {meeting.summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card bg-purple-500/5 border-purple-500/10 p-8 space-y-4"
          >
            <div className="flex items-center gap-2 text-purple-400 mb-4">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-bold uppercase tracking-widest text-xs">AI Resumo Executivo</h3>
            </div>
            <div className="prose prose-invert max-w-none prose-p:text-white/70 prose-headings:text-white">
              <ReactMarkdown>{meeting.summary}</ReactMarkdown>
            </div>
          </motion.div>
        )}

        <section className="space-y-8">
          <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-white/20">Transcrição Completa</h3>
          <div className="space-y-10">
            {meeting.transcript.map((segment) => (
              <div key={segment.id} className="flex gap-8 group">
                <span className="text-[10px] font-mono text-white/20 w-12 pt-2 shrink-0">
                  {new Date(segment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <p className="text-xl font-light text-white/80 leading-relaxed group-hover:text-white transition-colors">
                  {segment.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {isAssistantOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !isProcessingAI && setIsAssistantOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[32px] overflow-hidden flex flex-col max-h-[80vh] shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">IA Assistant</h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Custom Requests</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAssistantOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {assistantResponse ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <p className="text-sm text-white/50 mb-2 font-medium flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" /> Sua solicitação:
                      </p>
                      <p className="text-sm text-white/80">{assistantPrompt}</p>
                    </div>
                    <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl prose prose-invert max-w-none">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-white/90">
                        {assistantResponse}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-auto py-8 flex flex-col items-center justify-center text-center space-y-4 text-white/20">
                    <Brain className="w-12 h-12 opacity-10" />
                    <p className="text-sm px-10">Peça resumos específicos, traduções ou análises detalhadas da sua transcrição.</p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-4 px-4 max-w-lg">
                      {[
                        "Resuma os 3 pontos principais",
                        "Extraia as tarefas e responsáveis",
                        "Faça uma ata formal da reunião",
                        "Liste os tópicos discutidos principais"
                      ].map(prompt => (
                        <button
                          key={prompt}
                          onClick={() => setAssistantPrompt(prompt)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded-full border border-white/5 transition-colors text-left"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={responseEndRef} />
              </div>

              <div className="p-6 bg-white/[0.02] border-t border-white/5">
                {assistantResponse && (
                  <button
                    onClick={exportAssistantResponse}
                    className="mb-4 w-full py-3 px-4 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-wider"
                  >
                    <Download className="w-4 h-4" /> Exportar Resultado para TXT
                  </button>
                )}
                
                <div className="relative">
                  <textarea
                    value={assistantPrompt}
                    onChange={(e) => setAssistantPrompt(e.target.value)}
                    placeholder="Ex: Resuma os 3 pontos principais, Seque em Português, Separe quem falou o quê..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 focus:outline-none transition-all resize-none h-24"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAssistantRequest();
                      }
                    }}
                  />
                  <button
                    onClick={handleAssistantRequest}
                    disabled={isProcessingAI || !assistantPrompt.trim() || meeting.transcript.length === 0}
                    className="absolute bottom-3 right-3 p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all disabled:opacity-20 disabled:cursor-not-allowed group shadow-lg shadow-blue-500/20"
                  >
                    {isProcessingAI ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-white/20 text-center uppercase tracking-tighter">
                  Pressione Enter para enviar (Shift+Enter para nova linha)
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

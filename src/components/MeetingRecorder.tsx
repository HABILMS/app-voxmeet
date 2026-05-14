// src/components/MeetingRecorder.tsx — VoxMeet
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, Square, Save, Languages, Sparkles,
  Loader2, Brain, MessageSquare, X, Send,
  AlertCircle, CheckCircle2, Upload
} from 'lucide-react';
import { useTranscription } from '../hooks/useTranscription';
import { cn } from '../lib/utils';
import { TranscriptSegment, MeetingSource, UserProfile } from '../types';
import { summarizeMeeting, chatWithTranscript, transcribeAudio } from '../services/groqService';

const LANGUAGES = [
  { code: 'pt-BR', name: 'Português' },
  { code: 'en-US', name: 'English' },
  { code: 'es-ES', name: 'Español' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'it-IT', name: 'Italiano' },
];

interface MeetingRecorderProps {
  onSave: (segments: TranscriptSegment[], source: MeetingSource, audioBlob?: Blob | null) => void;
  userProfile?: UserProfile | null;
}

export function MeetingRecorder({ onSave, userProfile }: MeetingRecorderProps) {
  const [lang, setLang] = useState(() => localStorage.getItem('voxmeet_lang') || 'pt-BR');
  const userApiKey = userProfile?.apiKey ?? null;

  const {
    isRecording, isTranscribing, segments, setSegments,
    interimText, audioBlob, startRecording, stopRecording,
    captureMode, setCaptureMode, error, setError,
  } = useTranscription(lang, userApiKey);

  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Contador de tempo de gravação
  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    localStorage.setItem('voxmeet_lang', newLang);
  };

  // Upload de arquivo de áudio (WhatsApp, gravações externas)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg',
                     'audio/wav', 'audio/flac', 'audio/m4a', 'audio/x-m4a'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|m4a|wav|ogg|flac|webm|mp4)$/i)) {
      setError('Formato não suportado. Use MP3, M4A, WAV, OGG, FLAC ou WebM.');
      return;
    }

    setUploadLoading(true);
    setSegments([]);
    setError(null);

    try {
      const result = await transcribeAudio(file, lang.split('-')[0], userApiKey);
      setSegments(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao transcrever arquivo.');
    } finally {
      setUploadLoading(false);
      e.target.value = '';
    }
  };

  // Resumo + action items via Groq LLaMA
  const handleSummarize = async () => {
    if (segments.length === 0) return;
    setIsProcessingAI(true);
    try {
      const result = await summarizeMeeting(segments, lang, userApiKey);
      if (result?.summary) {
        setSegments(prev => [
          ...prev,
          {
            id: `summary_${Date.now()}`,
            text: `━━ RESUMO ━━\n\n${result.summary}${result.actionItems.length > 0
              ? '\n\n━━ ACTION ITEMS ━━\n' + result.actionItems.map((a, i) => `${i + 1}. ${a}`).join('\n')
              : ''}`,
            timestamp: Date.now(),
          }
        ]);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar resumo.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Chat com a transcrição
  const handleChatRequest = async () => {
    if (!chatPrompt.trim() || segments.length === 0) return;
    setIsProcessingAI(true);
    setChatResponse('');
    try {
      const response = await chatWithTranscript(segments, chatPrompt, lang, userApiKey);
      setChatResponse(response);
    } catch (err: any) {
      setError(err.message || 'Erro no chat com IA.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleSave = () => {
    const source: MeetingSource = captureMode === 'system' ? 'system' : 'mic';
    onSave(segments, source, audioBlob);
  };

  const isProcessing = isTranscribing || uploadLoading || isProcessingAI;
  const hasContent = segments.length > 0;

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto py-6">

      {/* Header */}
      <div className="flex items-center justify-between px-6 mb-4 flex-wrap gap-3">
        <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full transition-colors",
            isRecording ? "bg-red-500 animate-pulse" :
            isTranscribing ? "bg-blue-400 animate-pulse" :
            "bg-white/10"
          )} />
          {isRecording ? 'Gravando...' : isTranscribing ? 'Transcrevendo...' : 'Pronto'}
        </h2>

        <div className="flex items-center gap-2 flex-wrap">

          {/* Modo de captura */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setCaptureMode('mic')}
              disabled={isRecording}
              className={cn(
                "px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all",
                captureMode === 'mic' ? "bg-white text-black" : "text-white/40 hover:text-white/60"
              )}
            >
              Mic
            </button>
{!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && (
  <button
    onClick={() => setCaptureMode('system')}
    disabled={isRecording}
    className={cn(
      "px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all",
      captureMode === 'system' ? "bg-white text-black" : "text-white/40 hover:text-white/60"
    )}
  >
    Meeting
  </button>
)}          </div>

          {/* Idioma */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white/60">
            <Languages className="w-4 h-4" />
            <select
              value={lang}
              onChange={(e) => handleLangChange(e.target.value)}
              disabled={isRecording}
              className="bg-transparent outline-none cursor-pointer"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#050505]">
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Upload de áudio (WhatsApp / gravações externas) */}
          <label className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-xl border transition-all cursor-pointer",
            "bg-white/5 border-white/5 text-white/40 hover:text-white/70 hover:border-white/10",
            isRecording && "opacity-30 pointer-events-none"
          )}>
            <Upload className="w-3.5 h-3.5" />
            Upload
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleUpload}
              disabled={isRecording}
            />
          </label>
        </div>
      </div>

      {/* Aviso modo Meeting */}
      {captureMode === 'system' && !isRecording && (
        <div className="mx-6 mb-3 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Ao iniciar, marque "Compartilhar áudio do sistema" na janela do browser
        </div>
      )}

      {/* Aviso upload WhatsApp */}
      {captureMode === 'mic' && !isRecording && !hasContent && (
        <div className="mx-6 mb-3 px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-white/30 flex items-center gap-2">
          <Upload className="w-4 h-4 shrink-0" />
          Gravou uma chamada WhatsApp? Use o botão Upload para transcrever o áudio
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="mx-6 mb-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="flex-1 overflow-y-auto space-y-6 px-4 py-6 scrollbar-hide">

        {!hasContent && !interimText && !isRecording && !isProcessing && (
          <div className="h-full flex flex-col items-center justify-center text-white/20 text-center space-y-4">
            <Mic className="w-16 h-16 opacity-10" />
            <p className="text-xl font-medium">Toque no microfone para começar</p>
            <p className="text-sm text-white/10">ou faça upload de um áudio gravado</p>
          </div>
        )}

        {isProcessing && (
          <div className="h-full flex flex-col items-center justify-center text-white/50 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
            <p className="text-lg font-medium animate-pulse">
              {isTranscribing || uploadLoading ? 'Transcrevendo com Groq Whisper...' : 'Processando com IA...'}
            </p>
          </div>
        )}

        {!isProcessing && segments.map((segment) => (
          <motion.div
            key={segment.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-1"
          >
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
              {new Date(segment.timestamp).toLocaleTimeString()}
              {segment.speaker && ` · ${segment.speaker}`}
            </span>
            <p className="text-xl md:text-2xl font-light text-white/90 leading-relaxed whitespace-pre-wrap">
              {segment.text}
            </p>
          </motion.div>
        ))}

        {interimText && (
          <div className="flex flex-col gap-1 opacity-40">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
              ao vivo...
            </span>
            <p className="text-xl font-light text-white leading-relaxed italic">
              {interimText}
            </p>
          </div>
        )}
      </div>

      {/* Barra de ações */}
      <div className="p-4 md:p-6 glass-card bg-black/40 border-white/5 rounded-t-[40px] flex items-center justify-between gap-3">

        {/* Botão principal gravar/parar */}
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className="flex-1 btn-primary py-4 md:py-5 rounded-3xl flex flex-col items-center justify-center gap-1 bg-white text-black hover:bg-white/90 disabled:opacity-50"
          >
            <Mic className="w-5 h-5" />
            <span className="text-sm font-bold">Iniciar Gravação</span>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex-1 bg-red-500 text-white flex flex-col items-center justify-center gap-1 py-4 md:py-5 rounded-3xl active:scale-95 transition-all shadow-xl shadow-red-500/20"
          >
            <Square className="w-5 h-5 fill-white animate-pulse" />
            <span className="text-sm font-bold font-mono">{formatTime(elapsed)}</span>
          </button>
        )}

        {/* Ações secundárias */}
        <div className="flex items-center gap-2 shrink-0">

          {hasContent && !isRecording && (
            <button
              onClick={handleSummarize}
              disabled={isProcessing}
              className="w-14 h-14 glass rounded-2xl flex flex-col items-center justify-center text-purple-400 hover:bg-purple-400/10 transition-colors disabled:opacity-50 border border-white/5"
              title="Resumo + Action Items"
            >
              {isProcessingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
              <span className="text-[7px] uppercase font-bold mt-1">Resumo</span>
            </button>
          )}

          {hasContent && !isRecording && (
            <button
              onClick={() => setIsChatOpen(true)}
              disabled={isProcessing}
              className="w-14 h-14 glass rounded-2xl flex flex-col items-center justify-center text-blue-400 hover:bg-blue-400/10 transition-colors border border-white/5"
              title="Chat com IA"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-[7px] uppercase font-bold mt-1">Chat</span>
            </button>
          )}

          {hasContent && !isRecording && (
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="w-16 h-14 glass rounded-2xl flex flex-col items-center justify-center text-green-400 hover:bg-green-400/10 transition-colors border-2 border-green-400/20"
              title="Salvar Reunião"
            >
              <Save className="w-5 h-5" />
              <span className="text-[7px] uppercase font-black mt-1">Salvar</span>
            </button>
          )}
        </div>
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
                    <h3 className="font-bold text-white text-sm">Chat com a Transcrição</h3>
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
                    <div className="p-3 bg-white/5 rounded-xl text-sm text-white/60">{chatPrompt}</div>
                    <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                      {chatResponse}
                    </div>
                    <button
                      onClick={() => { setChatResponse(''); setChatPrompt(''); }}
                      className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Nova pergunta
                    </button>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center gap-4 text-white/20 text-center">
                    <Brain className="w-10 h-10 opacity-10" />
                    <p className="text-sm">Faça perguntas sobre a reunião</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        'Resuma os 3 pontos principais',
                        'Extraia as tarefas e responsáveis',
                        'Faça uma ata formal',
                        'Liste os tópicos discutidos',
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

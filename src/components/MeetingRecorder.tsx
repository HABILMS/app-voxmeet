// src/components/MeetingRecorder.tsx — VoxMeet
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, Square, Save, Languages, Sparkles,
  Loader2, Brain, MessageSquare, X, Send,
  AlertCircle, CheckCircle2, Upload, Pause, Play, Clock
} from 'lucide-react';
import { useTranscription } from '../hooks/useTranscription';
import { SpeakerphoneAlert } from './SpeakerphoneAlert';
import { cn } from '../lib/utils';
import { TranscriptSegment, MeetingSource, UserProfile, PLAN_CONFIGS } from '../types';
import { summarizeMeeting, chatWithTranscript, transcribeAudio } from '../services/groqService';

const LANGUAGES = [
  { code: 'pt-BR', name: 'Português' },
  { code: 'en-US', name: 'English' },
  { code: 'es-ES', name: 'Español' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'it-IT', name: 'Italiano' },
];

// Limite de gravação por plano em minutos
const PLAN_TIME_LIMITS: Record<string, number | null> = {
  starter: 60,
  pro: 300,
  pro_monthly: 300,
  ultra: null,
  pro_annual: null,
  power: null,
};

interface MeetingRecorderProps {
  onSave: (segments: TranscriptSegment[], segmentsClean: TranscriptSegment[], source: MeetingSource, audioBlob?: Blob | null) => void;
  userProfile?: UserProfile | null;
}

export function MeetingRecorder({ onSave, userProfile }: MeetingRecorderProps) {
  const [lang, setLang] = useState(() => localStorage.getItem('voxmeet_lang') || 'pt-BR');
  const userApiKey = userProfile?.apiKey ?? null;

  const {
    isRecording, isTranscribing, transcribeProgress,
    segments, setSegments,
    segmentsClean, setSegmentsClean,
    interimText, audioBlob, startRecording, stopRecording,
    captureMode, setCaptureMode, error, setError, isMobileDevice,
  } = useTranscription(lang, userApiKey);

  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showSpeakerAlert, setShowSpeakerAlert] = useState(false);
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Limite de minutos restantes do plano
  const plan = userProfile?.plan ?? 'starter';
  const minutesLimit = userProfile?.minutesLimit ?? PLAN_CONFIGS[plan]?.minutesPerMonth ?? 60;
  const minutesUsed = userProfile?.minutesUsed ?? 0;
  const minutesRemaining = minutesLimit === null ? null : Math.max(0, minutesLimit - minutesUsed);
  const maxRecordingSeconds = minutesRemaining === null ? null : minutesRemaining * 60;

  // Contador de tempo
  useEffect(() => {
    if (isRecording && !isPaused) {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setElapsed(s => {
            const next = s + 1;
            // Aviso aos 5min do limite
            if (maxRecordingSeconds && next === maxRecordingSeconds - 300) {
              setShowLimitWarning(true);
            }
            // Para automaticamente ao atingir o limite
            if (maxRecordingSeconds && next >= maxRecordingSeconds) {
              stopRecording();
              return s;
            }
            return next;
          });
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording, isPaused, maxRecordingSeconds]);

  // Mostra alerta de viva-voz no mobile ao iniciar
  useEffect(() => {
    if (isRecording && isMobileDevice) {
      setShowSpeakerAlert(true);
    }
    if (!isRecording) {
      setShowSpeakerAlert(false);
    }
  }, [isRecording]);

  // Reset ao parar gravação
  useEffect(() => {
    if (!isRecording) {
      setElapsed(0);
      setIsPaused(false);
      setShowLimitWarning(false);
    }
  }, [isRecording]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  // Porcentagem do tempo usado
  const timerPercent = maxRecordingSeconds ? Math.min(100, (elapsed / maxRecordingSeconds) * 100) : 0;
  const timerColor = timerPercent > 90 ? 'text-red-400' : timerPercent > 75 ? 'text-amber-400' : 'text-white';

  const handlePause = useCallback(() => {
    if (!isRecording) return;
    const mr = (window as any).__voxmeetMediaRecorder;
    if (!mr) return;

    if (isPaused) {
      mr.resume();
      setIsPaused(false);
    } else {
      mr.pause();
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);

  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    localStorage.setItem('voxmeet_lang', newLang);
  };

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
      const result = await transcribeAudio(file, lang.split('-')[0], userApiKey,
        (current, total) => { if (total > 1) setError(`Transcrevendo parte ${current} de ${total}...`); }
      );
      setError(null);
      setSegments(result.raw);
      setSegmentsClean(result.clean);
    } catch (err: any) {
      setError(err.message || 'Erro ao transcrever arquivo.');
    } finally {
      setUploadLoading(false);
      e.target.value = '';
    }
  };

  const handleSummarize = async () => {
    if (segments.length === 0) return;
    setIsProcessingAI(true);
    try {
      const result = await summarizeMeeting(segments, lang, userApiKey);
      if (result?.summary) {
        setSegments(prev => [...prev, {
          id: `summary_${Date.now()}`,
          text: `━━ RESUMO ━━\n\n${result.summary}${result.actionItems.length > 0
            ? '\n\n━━ ACTION ITEMS ━━\n' + result.actionItems.map((a, i) => `${i + 1}. ${a}`).join('\n')
            : ''}`,
          timestamp: Date.now(),
        }]);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar resumo.');
    } finally {
      setIsProcessingAI(false);
    }
  };

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
    onSave(segments, segmentsClean, source, audioBlob);
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
            isPaused ? "bg-amber-400" :
            isRecording ? "bg-red-500 animate-pulse" :
            isTranscribing ? "bg-blue-400 animate-pulse" :
            "bg-white/10"
          )} />
          {isPaused ? 'Pausado' : isRecording ? 'Gravando...' : isTranscribing ? 'Transcrevendo...' : 'Pronto'}
        </h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Modo de captura */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            <button onClick={() => setCaptureMode('mic')} disabled={isRecording}
              className={cn("px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all",
                captureMode === 'mic' ? "bg-white text-black" : "text-white/40 hover:text-white/60"
              )}>Mic</button>
            <button onClick={() => setCaptureMode('system')} disabled={isRecording || isMobileDevice}
              className={cn("px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all",
                captureMode === 'system' ? "bg-white text-black" : "text-white/40 hover:text-white/60",
                isMobileDevice && "hidden"
              )}>Meeting</button>
          </div>

          {/* Seletor de idioma */}
          <div className="relative">
            <Languages className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <select value={lang} onChange={e => handleLangChange(e.target.value)} disabled={isRecording}
              className="bg-white/5 border border-white/5 rounded-xl pl-7 pr-3 py-2 text-xs text-white/60 focus:outline-none cursor-pointer">
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </div>

          {/* Upload */}
          <label className={cn("w-10 h-10 glass rounded-2xl flex items-center justify-center text-white/30 hover:text-white/60 cursor-pointer transition-colors border border-white/5",
            (isRecording || isProcessing) && "opacity-30 pointer-events-none"
          )}>
            <Upload className="w-4 h-4" />
            <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.webm" className="hidden" onChange={handleUpload} disabled={isRecording || isProcessing} />
          </label>
        </div>
      </div>

      {/* Aviso viva-voz — mobile only */}
      <SpeakerphoneAlert isVisible={showSpeakerAlert} onDismiss={() => setShowSpeakerAlert(false)} />

      {/* Aviso de limite próximo */}
      <AnimatePresence>
        {showLimitWarning && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-6 mb-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-sm text-amber-300">
            <Clock className="w-4 h-4 shrink-0" />
            Menos de 5 minutos restantes no seu plano! Salve a reunião em breve.
            <button onClick={() => setShowLimitWarning(false)} className="ml-auto text-amber-400/50 hover:text-amber-400">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Erro */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-6 mb-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400/50 hover:text-red-400">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcrevendo... */}
      {(isTranscribing || uploadLoading) && (
        <div className="mx-6 mb-3 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 text-sm text-blue-300">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          {transcribeProgress
            ? `Transcrevendo parte ${transcribeProgress.current} de ${transcribeProgress.total}...`
            : isProcessingAI ? 'Processando com IA...' : 'Transcrevendo com Groq Whisper...'}
        </div>
      )}

      {/* Área de transcrição */}
      <div className="flex-1 overflow-y-auto px-6 space-y-6 py-4 scrollbar-hide">
        {!hasContent && !isRecording && !isProcessing && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-20 h-20 bg-white/5 rounded-[32px] flex items-center justify-center">
              <Mic className="w-10 h-10 text-white/20" />
            </div>
            <div className="space-y-2">
              <p className="text-white/40 text-lg font-light">Pronto para gravar</p>
              <p className="text-white/20 text-sm">
                {minutesRemaining !== null
                  ? `${minutesRemaining} min disponíveis no seu plano`
                  : 'Gravação ilimitada'}
              </p>
            </div>
          </div>
        )}

        {segments.map((segment) => (
          <motion.div key={segment.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1">
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
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">ao vivo...</span>
            <p className="text-xl font-light text-white leading-relaxed italic">{interimText}</p>
          </div>
        )}
      </div>

      {/* Barra de ações */}
      <div className="p-4 md:p-6 glass-card bg-black/40 border-white/5 rounded-t-[40px] flex items-center justify-between gap-3">

        {/* Botão principal */}
        {!isRecording ? (
          <button onClick={startRecording} disabled={isProcessing || (minutesRemaining !== null && minutesRemaining <= 0)}
            className="flex-1 btn-primary py-4 md:py-5 rounded-3xl flex flex-col items-center justify-center gap-1 bg-white text-black hover:bg-white/90 disabled:opacity-50">
            <Mic className="w-5 h-5" />
            <span className="text-sm font-bold">
              {minutesRemaining !== null && minutesRemaining <= 0 ? 'Limite atingido' : 'Iniciar Gravação'}
            </span>
          </button>
        ) : (
          <div className="flex-1 flex gap-2">
            {/* Botão Pausar/Retomar */}
            <button onClick={handlePause}
              className={cn(
                "flex-none w-14 flex flex-col items-center justify-center gap-1 py-4 rounded-3xl transition-all",
                isPaused
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              )}>
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              <span className="text-[8px] uppercase font-bold">{isPaused ? 'Retomar' : 'Pausar'}</span>
            </button>

            {/* Botão Parar com contador e barra de progresso */}
            <button onClick={stopRecording}
              className="flex-1 bg-red-500 text-white flex flex-col items-center justify-center gap-1 py-4 rounded-3xl active:scale-95 transition-all shadow-xl shadow-red-500/20 relative overflow-hidden">
              {/* Barra de progresso do limite */}
              {maxRecordingSeconds && (
                <div className="absolute bottom-0 left-0 h-1 bg-white/20 transition-all"
                  style={{ width: `${timerPercent}%` }} />
              )}
              <Square className="w-5 h-5 fill-white" />
              <span className={cn("text-sm font-bold font-mono", timerColor)}>
                {formatTime(elapsed)}
                {isPaused && ' ⏸'}
              </span>
              {maxRecordingSeconds && (
                <span className="text-[9px] text-white/50 font-mono">
                  / {formatTime(maxRecordingSeconds)}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Ações secundárias */}
        <div className="flex items-center gap-2 shrink-0">
          {hasContent && !isRecording && (
            <button onClick={handleSummarize} disabled={isProcessing}
              className="w-14 h-14 glass rounded-2xl flex flex-col items-center justify-center text-purple-400 hover:bg-purple-400/10 transition-colors disabled:opacity-50 border border-white/5"
              title="Resumo + Action Items">
              {isProcessingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
              <span className="text-[7px] uppercase font-bold mt-1">Resumo</span>
            </button>
          )}
          {hasContent && !isRecording && (
            <button onClick={() => setIsChatOpen(true)} disabled={isProcessing}
              className="w-14 h-14 glass rounded-2xl flex flex-col items-center justify-center text-blue-400 hover:bg-blue-400/10 transition-colors border border-white/5">
              <MessageSquare className="w-5 h-5" />
              <span className="text-[7px] uppercase font-bold mt-1">Chat</span>
            </button>
          )}
          {hasContent && !isRecording && (
            <button onClick={handleSave} disabled={isProcessing}
              className="w-16 h-14 glass rounded-2xl flex flex-col items-center justify-center text-green-400 hover:bg-green-400/10 transition-colors border-2 border-green-400/20">
              <Save className="w-5 h-5" />
              <span className="text-[7px] uppercase font-black mt-1">Salvar</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal Chat IA */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !isProcessingAI && setIsChatOpen(false)}>
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[28px] overflow-hidden flex flex-col max-h-[80vh]">
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
                    <button onClick={() => { setChatResponse(''); setChatPrompt(''); }}
                      className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Nova pergunta
                    </button>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center gap-4 text-white/20 text-center">
                    <Brain className="w-10 h-10 opacity-10" />
                    <p className="text-sm">Faça perguntas sobre a reunião</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {['Resuma os 3 pontos principais', 'Extraia as tarefas e responsáveis', 'Faça uma ata formal', 'Liste os tópicos discutidos'].map((p) => (
                        <button key={p} onClick={() => setChatPrompt(p)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded-full border border-white/5 transition-colors">
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-white/5 relative">
                <textarea value={chatPrompt} onChange={(e) => setChatPrompt(e.target.value)}
                  placeholder="Ex: Quais foram as decisões tomadas?"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 focus:outline-none resize-none h-20"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatRequest(); } }}
                />
                <button onClick={handleChatRequest} disabled={isProcessingAI || !chatPrompt.trim()}
                  className="absolute bottom-7 right-7 p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-20 transition-all">
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

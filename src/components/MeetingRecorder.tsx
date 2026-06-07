// src/components/MeetingRecorder.tsx — VoxMeet
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, Square, Languages,
  Loader2, X,
  AlertCircle, Upload, Pause, Play, Clock,
  Trash2, PlusCircle, Check
} from 'lucide-react';
import { useTranscription } from '../hooks/useTranscription';
import { SpeakerphoneAlert } from './SpeakerphoneAlert';
import { cn } from '../lib/utils';
import { TranscriptSegment, MeetingSource, UserProfile, PLAN_CONFIGS } from '../types';
import { transcribeAudio } from '../services/groqService';

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
  onSave: (
    segments: TranscriptSegment[],
    segmentsClean: TranscriptSegment[],
    source: MeetingSource,
    audioBlob?: Blob | null,
    appendToMeetingId?: string | null,
    navigateToDetail?: boolean
  ) => Promise<string | null>;
  onFinish?: () => void;
  userProfile?: UserProfile | null;
}

export function MeetingRecorder({ onSave, onFinish, userProfile }: MeetingRecorderProps) {
  const [lang, setLang] = useState(() => localStorage.getItem('voxmeet_lang') || 'pt-BR');
  const userApiKey = userProfile?.apiKey ?? null;

  const {
    isRecording, isTranscribing, transcribeProgress,
    segments, setSegments,
    segmentsClean, setSegmentsClean,
    interimText, audioBlob, startRecording, stopRecording,
    captureMode, setCaptureMode, error, setError, isMobileDevice,
  } = useTranscription(lang, userApiKey);

  const [uploadLoading, setUploadLoading] = useState(false);
  // Fluxo de gravação segmentada
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null); // reunião em andamento
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [justSaved, setJustSaved] = useState(false); // trecho recém-salvo, aguardando ação
  const uploadJustFinished = useRef(false);
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
      uploadJustFinished.current = true; // dispara auto-save no effect
    } catch (err: any) {
      setError(err.message || 'Erro ao transcrever arquivo.');
    } finally {
      setUploadLoading(false);
      e.target.value = '';
    }
  };

  const source: MeetingSource = captureMode === 'system' ? 'system' : 'mic';

  // Salva o trecho atual (cria reunião nova na 1ª vez, anexa nas seguintes)
  const persistSegment = useCallback(async () => {
    if (segments.length === 0) return;
    setIsSaving(true);
    try {
      const id = await onSave(segments, segmentsClean, source, audioBlob, currentMeetingId, false);
      if (id) setCurrentMeetingId(id);
      setJustSaved(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar trecho.');
    } finally {
      setIsSaving(false);
    }
  }, [segments, segmentsClean, source, audioBlob, currentMeetingId, onSave]);

  // Auto-salva quando a transcrição de um trecho termina (parada manual ou automática)
  const prevTranscribing = useRef(false);
  useEffect(() => {
    // transição de "transcrevendo" -> "parou de transcrever" com conteúdo novo
    const transcribeFinished = prevTranscribing.current && !isTranscribing;
    const uploadFinished = uploadJustFinished.current && !uploadLoading;
    if ((transcribeFinished || uploadFinished) && segments.length > 0 && !justSaved && !isRecording) {
      uploadJustFinished.current = false;
      persistSegment();
    }
    prevTranscribing.current = isTranscribing;
  }, [isTranscribing, uploadLoading, segments.length, isRecording, justSaved, persistSegment]);

  // Continuar gravando: limpa o trecho atual da tela e inicia nova gravação,
  // mantendo o currentMeetingId para anexar
  const handleContinue = useCallback(() => {
    setSegments([]);
    setSegmentsClean([]);
    setJustSaved(false);
    setError(null);
    startRecording();
  }, [setSegments, setSegmentsClean, startRecording, setError]);

  // Concluir reunião: finaliza e vai para o detalhe
  const handleFinish = useCallback(() => {
    const id = currentMeetingId;
    // limpa estado local do gravador
    setSegments([]);
    setSegmentsClean([]);
    setJustSaved(false);
    setCurrentMeetingId(null);
    if (id) onFinish?.();
  }, [currentMeetingId, setSegments, setSegmentsClean, onFinish]);

  // Descartar: remove o trecho atual. Se for o único trecho da reunião, descarta tudo.
  const handleDiscard = useCallback(() => {
    setShowDiscardConfirm(false);
    // Descarta o trecho atual da tela. O backup no IndexedDB (se houver) será
    // sobrescrito na próxima gravação. Trechos já salvos na reunião permanecem.
    setSegments([]);
    setSegmentsClean([]);
    setJustSaved(false);
    setError(null);
  }, [setSegments, setSegmentsClean, setError]);

  const isProcessing = isTranscribing || uploadLoading || isSaving;
  const hasContent = segments.length > 0;
  // mostra as ações pós-parada quando: não está gravando, tem conteúdo e o trecho foi salvo
  const showPostStopActions = !isRecording && !isProcessing && justSaved && hasContent;

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
            : isSaving ? 'Salvando trecho...' : 'Transcrevendo com Groq Whisper...'}
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
        {showPostStopActions ? (
          /* Pós-parada: Continuar · Concluir · Descartar */
          <div className="flex-1 flex gap-2">
            <button onClick={handleContinue}
              className="flex-1 py-4 rounded-3xl flex flex-col items-center justify-center gap-1 bg-white/10 text-white hover:bg-white/20 transition-all border border-white/10">
              <PlusCircle className="w-5 h-5" />
              <span className="text-xs font-bold">Continuar</span>
            </button>
            <button onClick={handleFinish}
              className="flex-1 py-4 rounded-3xl flex flex-col items-center justify-center gap-1 bg-green-500 text-white hover:bg-green-600 transition-all shadow-xl shadow-green-500/20">
              <Check className="w-5 h-5" />
              <span className="text-xs font-bold">Concluir</span>
            </button>
            <button onClick={() => setShowDiscardConfirm(true)}
              className="flex-none w-14 py-4 rounded-3xl flex flex-col items-center justify-center gap-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all border border-red-500/20"
              title="Descartar este trecho">
              <Trash2 className="w-5 h-5" />
              <span className="text-[8px] uppercase font-bold">Descartar</span>
            </button>
          </div>
        ) : !isRecording ? (
          <button onClick={startRecording} disabled={isProcessing || (minutesRemaining !== null && minutesRemaining <= 0)}
            className="flex-1 btn-primary py-4 md:py-5 rounded-3xl flex flex-col items-center justify-center gap-1 bg-white text-black hover:bg-white/90 disabled:opacity-50">
            <Mic className="w-5 h-5" />
            <span className="text-sm font-bold">
              {minutesRemaining !== null && minutesRemaining <= 0 ? 'Limite atingido'
                : currentMeetingId ? 'Iniciar Gravação' : 'Iniciar Gravação'}
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

        {/* Indicador de salvamento automático */}
        {isSaving && (
          <div className="flex items-center gap-2 shrink-0 text-green-400 text-xs px-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
          </div>
        )}
      </div>

      {/* Modal de confirmação de descarte */}
      <AnimatePresence>
        {showDiscardConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDiscardConfirm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-[28px] p-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Descartar este trecho?</h3>
                <p className="text-sm text-white/40 mt-1">
                  {currentMeetingId
                    ? 'O trecho atual será descartado. As partes já salvas na reunião continuam.'
                    : 'Não dá para desfazer. Tudo que foi gravado neste trecho será perdido.'}
                </p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={() => setShowDiscardConfirm(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/5 text-white hover:bg-white/10 transition-colors text-sm font-medium">
                  Cancelar
                </button>
                <button onClick={handleDiscard}
                  className="flex-1 py-3 rounded-2xl bg-red-500 text-white hover:bg-red-600 transition-colors text-sm font-bold">
                  Descartar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

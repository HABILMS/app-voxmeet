// src/hooks/useTranscription.ts — VoxMeet
import { useState, useCallback, useRef, useEffect } from 'react';
import { TranscriptSegment } from '../types';
import { transcribeAudio } from '../services/groqService';

const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ─────────────────────────────────────────────
// IndexedDB — salva áudio localmente como backup
// ─────────────────────────────────────────────
const DB_NAME = 'voxmeet_audio_backup';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudioBackup(blob: Blob, mimeType: string): Promise<string> {
  const db = await openDB();
  const id = `rec_${Date.now()}`;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ id, blob, mimeType, savedAt: Date.now() });
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAudioBackups(): Promise<{ id: string; blob: Blob; mimeType: string; savedAt: number }[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAudioBackup(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function useTranscription(lang: string = 'pt-BR', userApiKey?: string | null) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{ current: number; total: number } | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);         // crua
  const [segmentsClean, setSegmentsClean] = useState<TranscriptSegment[]>([]); // otimizada
  const [interimText, setInterimText] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [captureMode, setCaptureMode] = useState<'mic' | 'system'>('mic');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) interim += event.results[i][0].transcript;
      }
      setInterimText(interim);
    };
    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') { setError('Acesso ao microfone negado.'); setIsRecording(false); }
    };
    recognition.onend = () => {
      if (isRecordingRef.current) { try { recognition.start(); } catch (e) {} }
    };
    recognitionRef.current = recognition;
    return () => { try { recognitionRef.current?.stop(); } catch (e) {} };
  }, [lang]);

  const startRecording = useCallback(async () => {
    setError(null);
    setSegments([]);
    setSegmentsClean([]);
    setInterimText('');
    setAudioBlob(null);

    try {
      let stream: MediaStream;
      const mobile = isMobileDevice();

      if (captureMode === 'system' && !mobile) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        setError(null);
        setSegments([]);
        setSegmentsClean([]);
        setInterimText('');
        setAudioBlob(null);

        if (screenStream.getAudioTracks().length === 0) {
          screenStream.getTracks().forEach(t => t.stop());
          throw new Error('Nenhuma trilha de áudio capturada. Marque "Compartilhar áudio" ao selecionar a janela.');
        }
        stream = new MediaStream(screenStream.getAudioTracks());
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        await processTranscription(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      (window as any).__voxmeetMediaRecorder = mediaRecorder; // exposto para pausa
      mediaRecorder.start(1000);
      isRecordingRef.current = true;
      setIsRecording(true);
      try { recognitionRef.current?.start(); } catch (e) {}

    } catch (err: any) {
      console.error('Erro ao iniciar gravação:', err);
      setError(err.message || 'Erro ao acessar microfone.');
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, [captureMode, userApiKey, lang]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    (window as any).__voxmeetMediaRecorder = null;
    setInterimText('');
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    try { recognitionRef.current?.stop(); } catch (e) {}
  }, []);

  const processTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    setTranscribeProgress(null);
    setSegments([]);
    setSegmentsClean([]);

    // Salva backup antes de tentar transcrever
    let backupId: string | null = null;
    try {
      backupId = await saveAudioBackup(blob, blob.type);
      console.log('Backup de áudio salvo:', backupId);
    } catch (e) {
      console.warn('Falha ao salvar backup (IndexedDB):', e);
    }

    try {
      const result = await transcribeAudio(
        blob, lang.split('-')[0], userApiKey,
        (current, total) => setTranscribeProgress({ current, total })
      );
      setSegments(result.raw);
      setSegmentsClean(result.clean);
      console.log(`Transcrição: ${result.raw.length} segmentos → ${result.clean.length} otimizados`);
      // Remove backup após transcrição bem-sucedida
      if (backupId) await deleteAudioBackup(backupId).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Erro ao transcrever áudio. O áudio foi salvo — clique em Recuperar para tentar novamente.');
    } finally {
      setIsTranscribing(false);
      setTranscribeProgress(null);
    }
  };

  const retranscribe = useCallback(async () => {
    if (!audioBlob) return;
    await processTranscription(audioBlob);
  }, [audioBlob, userApiKey, lang]);

  return {
    isRecording, isTranscribing, transcribeProgress,
    segments, setSegments,
    segmentsClean, setSegmentsClean,
    interimText, audioBlob,
    startRecording, stopRecording, retranscribe,
    captureMode, setCaptureMode,
    isMobileDevice: isMobileDevice(),
    error, setError,
  };
}

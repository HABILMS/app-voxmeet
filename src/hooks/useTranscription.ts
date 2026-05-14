// src/hooks/useTranscription.ts — VoxMeet
// Usa Web Speech API em tempo real (feedback visual)
// + Groq Whisper no final para transcrição precisa

import { useState, useCallback, useRef, useEffect } from 'react';
import { TranscriptSegment } from '../types';
import { transcribeAudio } from '../services/groqService';

// Detecta mobile
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function useTranscription(lang: string = 'pt-BR', userApiKey?: string | null) {
  const mobile = isMobile();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [captureMode, setCaptureMode] = useState<'mic' | 'system'>('mic');
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [captureMode, setCaptureMode] = useState<'mic' | 'system'>('mic');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);

  // Web Speech API — feedback em tempo real (interim)
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
        if (!event.results[i].isFinal) {
          interim += event.results[i][0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError('Acesso ao microfone negado.');
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognitionRef.current?.stop(); } catch (e) {}
    };
  }, [lang]);

  const startRecording = useCallback(async () => {
    setError(null);
    setSegments([]);
    setInterimText('');
    setAudioBlob(null);

    try {
      let stream: MediaStream;

      if (captureMode === 'system' && !mobile) {
        // Captura áudio do sistema (meetings no computador)
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();

        // Tenta capturar áudio da tela
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        if (screenStream.getAudioTracks().length > 0) {
          const sysSource = audioContext.createMediaStreamSource(screenStream);
          sysSource.connect(destination);
        }

        // Mistura com microfone
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const micSource = audioContext.createMediaStreamSource(micStream);
          micSource.connect(destination);
        } catch (e) {
          console.warn('Microfone não disponível para mix', e);
        }

        stream = destination.stream;
      } else {
        // Apenas microfone
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;

      // Determina o melhor formato suportado
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        // Auto-transcreve com Groq Whisper ao parar
        await processTranscription(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      isRecordingRef.current = true;
      setIsRecording(true);

      // Inicia feedback visual em tempo real
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
    setInterimText('');

    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    try { recognitionRef.current?.stop(); } catch (e) {}
  }, []);

  // Transcrição com Groq Whisper
  const processTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    setTranscribeProgress(null);
    setSegments([]);
    try {
      const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
      console.log(`Iniciando transcricao: ${sizeMB}MB`);
      const result = await transcribeAudio(
        blob,
        lang.split("-")[0],
        userApiKey,
        (current, total) => setTranscribeProgress({ current, total })
      );
      setSegments(result);
    } catch (err: any) {
      console.error("Erro na transcricao Groq:", err);
      setError(err.message || "Erro ao transcrever audio.");
    } finally {
      setIsTranscribing(false);
      setTranscribeProgress(null);
    }
  };













  // Re-transcrever manualmente (se precisar)
  const retranscribe = useCallback(async () => {
    if (!audioBlob) return;
    await processTranscription(audioBlob);
  }, [audioBlob, userApiKey, lang]);

  return {
    isMobileDevice: mobile,
    isRecording,
    isTranscribing,
    transcribeProgress,
    segments,
    setSegments,
    interimText,
    audioBlob,
    startRecording,
    stopRecording,
    retranscribe,
    captureMode,
    setCaptureMode,
    error,
    setError,
  };
}

// src/hooks/useTranscription.ts — VoxMeet
import { useState, useCallback, useRef, useEffect } from 'react';
import { TranscriptSegment } from '../types';
import { transcribeAudio } from '../services/groqService';

const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function useTranscription(lang: string = 'pt-BR', userApiKey?: string | null) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{ current: number; total: number } | null>(null);
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

  // Web Speech API — feedback em tempo real
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
    return () => { try { recognitionRef.current?.stop(); } catch (e) {} };
  }, [lang]);

  const startRecording = useCallback(async () => {
    setError(null);
    setSegments([]);
    setInterimText('');
    setAudioBlob(null);

    try {
      let stream: MediaStream;
      const mobile = isMobileDevice();

      if (captureMode === 'system' && !mobile) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        if (screenStream.getAudioTracks().length > 0) {
          audioContext.createMediaStreamSource(screenStream).connect(destination);
        }
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioContext.createMediaStreamSource(micStream).connect(destination);
        } catch (e) { console.warn('Mic não disponível para mix', e); }
        stream = destination.stream;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      // 32kbps = qualidade suficiente para voz, ~14MB/hora vs ~150MB/hora no padrao
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 32000,
      });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        await processTranscription(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
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
    try {
      const sizeMB = (blob.size / 1024 / 1024).toFixed(1);
      console.log(`Iniciando transcrição: ${sizeMB}MB`);
      const result = await transcribeAudio(
        blob,
        lang.split('-')[0],
        userApiKey,
        (current, total) => setTranscribeProgress({ current, total })
      );
      setSegments(result);
    } catch (err: any) {
      console.error('Erro na transcrição Groq:', err);
      setError(err.message || 'Erro ao transcrever áudio.');
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
    isMobileDevice: isMobileDevice(),
    error,
    setError,
  };
}

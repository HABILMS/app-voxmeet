// src/services/groqService.ts — VoxMeet
// Groq Whisper (transcrição) + Gemini (resumo/chat) via servidor seguro

import { TranscriptSegment } from '../types';

const GROQ_API = 'https://api.groq.com/openai/v1';
const MAX_CHUNK_SIZE = 24 * 1024 * 1024; // 24MB — evita dividir WebM (limite Groq 25MB)

// Base URL — usa Vercel em produção/Capacitor, relativo em dev
const isCapacitor = (window as any).Capacitor?.isNativePlatform?.() === true;
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isCapacitor ? 'https://voxmeet.vercel.app' : '';

function resolveApiKey(userApiKey?: string | null): string {
  if (userApiKey?.trim()) return userApiKey.trim();
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) throw new Error('Chave Groq não configurada. Adicione VITE_GROQ_API_KEY no .env.local');
  return key;
}

// Chamada ao Gemini via servidor seguro (chave nunca exposta no browser)
async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userPrompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Erro Gemini: ${res.statusText}`);
  }
  const data = await res.json();
  return data.text || '';
}

// ─────────────────────────────────────────────
// LIMPEZA INTELIGENTE DE TRANSCRIÇÃO (Opção C)
// ─────────────────────────────────────────────
export function cleanTranscriptSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  const NOISE = new Set([
    'o', 'a', 'e', 'é', 'é...', 'é.', 'ah', 'ah.', 'ah,', 'ah...', 'ahn',
    'hm', 'hm...', 'hmm', 'uh', 'eh', 'ih', 'oh',
    'tá', 'tá.', 'tá,', 'ok', 'ok.', 'sim', 'não',
    'entendeu?', 'né?', 'né', 'né.', 'né,',
    'então', 'então.', 'então,', 'então...', 'aí', 'aí.',
  ]);

  const cleaned: TranscriptSegment[] = [];
  let buffer = '';
  let bufferTimestamp = 0;
  let bufferId = '';

  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text || text.length <= 1) continue;
    if (NOISE.has(text.toLowerCase())) continue;
    if (/^[oaeiouáéíóúàãõâêîôûäëïöü\s,\.!\?]+$/i.test(text) && text.length < 4) continue;

    if (text.length < 25 && !text.match(/[.!?]$/)) {
      if (!buffer) {
        buffer = text;
        bufferTimestamp = seg.timestamp;
        bufferId = seg.id;
      } else {
        buffer += ' ' + text;
      }
    } else {
      if (buffer) {
        const fullText = buffer + ' ' + text;
        cleaned.push({ id: bufferId, text: fullText.trim(), timestamp: bufferTimestamp, speaker: seg.speaker });
        buffer = '';
      } else {
        cleaned.push(seg);
      }
    }
  }

  if (buffer) {
    cleaned.push({ id: bufferId, text: buffer.trim(), timestamp: bufferTimestamp });
  }

  return cleaned;
}

// ─────────────────────────────────────────────
// DIVISÃO EM CHUNKS
// ─────────────────────────────────────────────
async function splitAudioIntoChunks(blob: Blob): Promise<Blob[]> {
  if (blob.size <= MAX_CHUNK_SIZE) return [blob];

  const chunks: Blob[] = [];
  let offset = 0;
  while (offset < blob.size) {
    const end = Math.min(offset + MAX_CHUNK_SIZE, blob.size);
    chunks.push(blob.slice(offset, end, blob.type));
    offset = end;
  }

  console.log(`Áudio dividido em ${chunks.length} chunks de ~${Math.round(MAX_CHUNK_SIZE / 1024 / 1024)}MB`);
  return chunks; // ✅ CORREÇÃO: estava faltando o return
}

// ─────────────────────────────────────────────
// TRANSCRIÇÃO — Groq Whisper
// ─────────────────────────────────────────────
async function transcribeChunk(
  chunk: Blob, lang: string, apiKey: string,
  chunkIndex: number, baseTimestamp: number
): Promise<TranscriptSegment[]> {
  const ext = chunk.type.includes('mp4') ? 'mp4'
    : chunk.type.includes('ogg') ? 'ogg'
    : chunk.type.includes('wav') ? 'wav'
    : chunk.type.includes('flac') ? 'flac'
    : chunk.type.includes('m4a') ? 'm4a'
    : 'webm';

  const isLocalDev = isLocalhost && !isCapacitor;
  let res: Response;

  if (isLocalDev && apiKey) {
    const fd = new FormData();
    fd.append('file', chunk, `chunk_${chunkIndex}.${ext}`);
    fd.append('model', 'whisper-large-v3-turbo');
    fd.append('language', lang);
    fd.append('response_format', 'verbose_json');
    fd.append('timestamp_granularities[]', 'segment');
    res = await fetch(`${GROQ_API}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });
  } else {
    const formData = new FormData();
    formData.append('file', chunk, `chunk_${chunkIndex}.${ext}`);
    formData.append('language', lang);
    res = await fetch(`${API_BASE}/api/transcribe`, { method: 'POST', body: formData });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.error || `Erro Groq Whisper (chunk ${chunkIndex}): ${res.statusText}`);
  }

  const data = await res.json();
  if (!data) return [];

  if (data.segments && Array.isArray(data.segments) && data.segments.length > 0) {
    return data.segments.map((seg: any, i: number) => ({
      id: `seg_${chunkIndex}_${i}_${Math.random().toString(36).substr(2, 6)}`,
      text: (seg.text || '').trim(),
      timestamp: baseTimestamp + Math.round((seg.start || 0) * 1000),
    }));
  }

  if (data.text) {
    return [{
      id: `seg_${chunkIndex}_0_${Math.random().toString(36).substr(2, 6)}`,
      text: data.text.trim(),
      timestamp: baseTimestamp,
    }];
  }

  return [];
}

export async function transcribeAudio(
  audioBlob: Blob,
  lang: string = 'pt',
  userApiKey?: string | null,
  onProgress?: (current: number, total: number) => void
): Promise<{ raw: TranscriptSegment[]; clean: TranscriptSegment[] }> {
  const apiKey = resolveApiKey(userApiKey);
  const langCode = lang.split('-')[0];

  console.log(`Transcrevendo áudio: ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB`);

  const chunks = await splitAudioIntoChunks(audioBlob);

  // Proteção: garante que chunks é um array válido
  if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('Falha ao processar o áudio. Tente um arquivo diferente.');
  }

  const allSegments: TranscriptSegment[] = [];
  const totalSize = audioBlob.size;

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);
    const chunkStartRatio = chunks.slice(0, i).reduce((acc, c) => acc + c.size, 0) / totalSize;
    const baseTimestamp = Date.now() + Math.round(chunkStartRatio * 600 * 1000);

    try {
      const segments = await transcribeChunk(chunks[i], langCode, apiKey, i, baseTimestamp);
      if (segments && Array.isArray(segments)) {
        allSegments.push(...segments);
        console.log(`Chunk ${i + 1}/${chunks.length}: ${segments.length} segmentos`);
      }
    } catch (chunkError) {
      console.error(`Erro no chunk ${i}:`, chunkError);
      // Se for o único chunk, propaga o erro; senão continua
      if (chunks.length === 1) throw chunkError;
    }

    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  console.log(`Total de segmentos: ${allSegments.length}`);

  return {
    raw: allSegments,
    clean: cleanTranscriptSegments(allSegments),
  };
}

// ─────────────────────────────────────────────
// RESUMO + ACTION ITEMS — via Gemini
// ─────────────────────────────────────────────
export async function summarizeMeeting(
  transcript: TranscriptSegment[],
  lang: string = 'pt-BR',
  userApiKey?: string | null
): Promise<{ summary: string; actionItems: string[] } | undefined> {
  const cleanSegments = cleanTranscriptSegments(transcript);
  const fullText = cleanSegments.map(s => s.text).join('\n');
  if (!fullText.trim()) return undefined;

  const language = lang === 'pt-BR' ? 'português do Brasil' : 'English';
  const systemPrompt = `Você é um assistente especializado em reuniões. Responda em ${language}. Retorne APENAS JSON válido sem markdown nem blocos de código.`;
  const userPrompt = `Analise esta transcrição e retorne JSON com: {"summary": "resumo executivo em 3-5 parágrafos", "actionItems": ["tarefa1", "tarefa2"]}\n\n${fullText}`;

  const raw = await callGemini(systemPrompt, userPrompt);

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      summary: parsed.summary || '',
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    };
  } catch {
    return { summary: raw, actionItems: [] };
  }
}

// ─────────────────────────────────────────────
// CHAT — via Gemini
// ─────────────────────────────────────────────
export async function chatWithTranscript(
  transcript: TranscriptSegment[],
  userPrompt: string,
  lang: string = 'pt-BR',
  userApiKey?: string | null
): Promise<string> {
  const cleanSegments = cleanTranscriptSegments(transcript);
  const fullText = cleanSegments.map(s => s.text).join('\n');
  const language = lang === 'pt-BR' ? 'português do Brasil' : 'English';

  const systemPrompt = `Você é um assistente executivo especializado em gestão de reuniões corporativas. Responda em ${language}.

Ao elaborar atas formais, siga este modelo:

# ATA DE REUNIÃO

**Data:** [data da reunião]
**Participantes:** [identificados na transcrição]

---

## 1. ABERTURA
## 2. ASSUNTOS TRATADOS
### 2.1 [Primeiro assunto]
## 3. DECISÕES TOMADAS
## 4. PRÓXIMOS PASSOS
| Ação | Responsável | Prazo |
|------|-------------|-------|
## 5. ENCERRAMENTO

---
*Ata elaborada automaticamente pelo VoxMeet*

Use markdown rico para outros formatos. Seja detalhado e profissional.`;

  const prompt = `Transcrição:\n\n${fullText}\n\nSolicitação: ${userPrompt}`;
  return await callGemini(systemPrompt, prompt);
}

// ─────────────────────────────────────────────
// VALIDAR CHAVE
// ─────────────────────────────────────────────
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${GROQ_API}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    return res.ok;
  } catch { return false; }
}
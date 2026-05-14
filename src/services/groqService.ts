// src/services/groqService.ts — VoxMeet
// Groq Whisper + LLaMA — direto do browser, sem passar pelo servidor

import { TranscriptSegment } from '../types';

const GROQ_API = 'https://api.groq.com/openai/v1';
const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB por chunk (limite Groq é 25MB)
const MAX_CHUNK_DURATION = 10 * 60; // 10 minutos por chunk em segundos

function resolveApiKey(userApiKey?: string | null): string {
  if (userApiKey?.trim()) return userApiKey.trim();
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) throw new Error('Chave Groq não configurada. Adicione VITE_GROQ_API_KEY no .env.local');
  return key;
}

// Divide blob grande em chunks de no máximo MAX_CHUNK_SIZE
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
  return chunks;
}

// Transcreve um único chunk
async function transcribeChunk(
  chunk: Blob,
  lang: string,
  apiKey: string,
  chunkIndex: number,
  baseTimestamp: number
): Promise<TranscriptSegment[]> {
  const ext = chunk.type.includes('mp4') ? 'mp4'
    : chunk.type.includes('ogg') ? 'ogg'
    : chunk.type.includes('wav') ? 'wav'
    : chunk.type.includes('flac') ? 'flac'
    : chunk.type.includes('m4a') ? 'm4a'
    : 'webm';

  const formData = new FormData();
  formData.append('file', chunk, `chunk_${chunkIndex}.${ext}`);
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('language', lang);
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  const res = await fetch(`${GROQ_API}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro Groq Whisper (chunk ${chunkIndex}): ${res.statusText}`);
  }

  const data = await res.json();

  if (data.segments?.length > 0) {
    return data.segments.map((seg: any, i: number) => ({
      id: `seg_${chunkIndex}_${i}_${Math.random().toString(36).substr(2, 6)}`,
      text: seg.text.trim(),
      timestamp: baseTimestamp + Math.round(seg.start * 1000),
      speaker: undefined,
    }));
  }

  return [{
    id: `seg_${chunkIndex}_0_${Math.random().toString(36).substr(2, 6)}`,
    text: data.text?.trim() || '',
    timestamp: baseTimestamp,
  }];
}

// ─────────────────────────────────────────────
// TRANSCRIÇÃO PRINCIPAL — com suporte a áudios longos
// ─────────────────────────────────────────────
export async function transcribeAudio(
  audioBlob: Blob,
  lang: string = 'pt',
  userApiKey?: string | null,
  onProgress?: (current: number, total: number) => void
): Promise<TranscriptSegment[]> {
  const apiKey = resolveApiKey(userApiKey);
  const langCode = lang.split('-')[0];

  console.log(`Transcrevendo áudio: ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB`);

  const chunks = await splitAudioIntoChunks(audioBlob);
  const allSegments: TranscriptSegment[] = [];

  // Estima duração por chunk baseado no tamanho proporcional
  const totalSize = audioBlob.size;

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);
    console.log(`Transcrevendo chunk ${i + 1}/${chunks.length}...`);

    // Estima timestamp base para este chunk
    const chunkStartRatio = chunks.slice(0, i).reduce((acc, c) => acc + c.size, 0) / totalSize;
    const baseTimestamp = Date.now() + Math.round(chunkStartRatio * MAX_CHUNK_DURATION * 1000 * chunks.length);

    const segments = await transcribeChunk(chunks[i], langCode, apiKey, i, baseTimestamp);
    allSegments.push(...segments);

    // Pequena pausa entre chunks para não sobrecarregar a API
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return allSegments;
}

// ─────────────────────────────────────────────
// RESUMO + ACTION ITEMS
// ─────────────────────────────────────────────
export async function summarizeMeeting(
  transcript: TranscriptSegment[],
  lang: string = 'pt-BR',
  userApiKey?: string | null
): Promise<{ summary: string; actionItems: string[] } | undefined> {
  const apiKey = resolveApiKey(userApiKey);
  const fullText = transcript.map(s => s.text).join('\n');
  if (!fullText.trim()) return undefined;

  const language = lang === 'pt-BR' ? 'português do Brasil' : 'English';

  const res = await fetch(`${GROQ_API}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `Você é um assistente especializado em reuniões. Responda em ${language}. Retorne APENAS JSON sem markdown.` },
        { role: 'user', content: `Analise esta transcrição e retorne JSON com: {"summary": "resumo executivo em 3-5 parágrafos", "actionItems": ["tarefa1", "tarefa2"]}\n\n${fullText}` },
      ],
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro Groq LLaMA: ${res.statusText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return undefined;

  try {
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || '',
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    };
  } catch {
    return { summary: content, actionItems: [] };
  }
}

// ─────────────────────────────────────────────
// CHAT COM A TRANSCRIÇÃO
// ─────────────────────────────────────────────
export async function chatWithTranscript(
  transcript: TranscriptSegment[],
  userPrompt: string,
  lang: string = 'pt-BR',
  userApiKey?: string | null
): Promise<string> {
  const apiKey = resolveApiKey(userApiKey);
  const fullText = transcript.map(s => s.text).join('\n');
  const language = lang === 'pt-BR' ? 'português do Brasil' : 'English';

  const res = await fetch(`${GROQ_API}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `Você é um assistente de reuniões. Responda em ${language}. Use markdown quando ajudar.` },
        { role: 'user', content: `Transcrição:\n\n${fullText}\n\nSolicitação: ${userPrompt}` },
      ],
      temperature: 0.5,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro Groq Chat: ${res.statusText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'Sem resposta da IA.';
}

// ─────────────────────────────────────────────
// VALIDAR CHAVE DO CLIENTE
// ─────────────────────────────────────────────
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${GROQ_API}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    return res.ok;
  } catch { return false; }
}

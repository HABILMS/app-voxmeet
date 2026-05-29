// src/services/groqService.ts — VoxMeet
// Groq Whisper + LLaMA — direto do browser, sem passar pelo servidor

import { TranscriptSegment } from '../types';

const GROQ_API = 'https://api.groq.com/openai/v1';
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_CHUNK_SIZE = 24 * 1024 * 1024;

function resolveGeminiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new Error('Chave Gemini não configurada. Adicione VITE_GEMINI_API_KEY no .env.local');
  return key;
}

// Chamada genérica ao Gemini
async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = resolveGeminiKey();
  const res = await fetch(`${GEMINI_API}/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro Gemini: ${res.statusText}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
} // 24MB — cobre até ~1h40min a 32kbps

function resolveApiKey(userApiKey?: string | null): string {
  if (userApiKey?.trim()) return userApiKey.trim();
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) throw new Error('Chave Groq não configurada. Adicione VITE_GROQ_API_KEY no .env.local');
  return key;
}

// ─────────────────────────────────────────────
// LIMPEZA INTELIGENTE DE TRANSCRIÇÃO (Opção C)
// Remove ruídos, hesitações e fragmentos
// mantendo o conteúdo semântico completo
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

    // Ignora segmentos de ruído puro
    if (!text || text.length <= 1) continue;
    if (NOISE.has(text.toLowerCase())) continue;

    // Ignora segmentos que são só vogais/pontuação (artefatos do Whisper)
    if (/^[oaeiouáéíóúàãõâêîôûäëïöü\s,\.!\?]+$/i.test(text) && text.length < 4) continue;

    // Acumula fragmentos curtos com o próximo
    if (text.length < 25 && !text.match(/[.!?]$/)) {
      if (!buffer) {
        buffer = text;
        bufferTimestamp = seg.timestamp;
        bufferId = seg.id;
      } else {
        buffer += ' ' + text;
      }
    } else {
      // Flush do buffer acumulado
      if (buffer) {
        const fullText = buffer + ' ' + text;
        cleaned.push({
          id: bufferId,
          text: fullText.trim(),
          timestamp: bufferTimestamp,
          speaker: seg.speaker,
        });
        buffer = '';
      } else {
        cleaned.push(seg);
      }
    }
  }

  // Flush final do buffer
  if (buffer) {
    cleaned.push({
      id: bufferId,
      text: buffer.trim(),
      timestamp: bufferTimestamp,
    });
  }

  return cleaned;
}

// Converte segments para texto truncado para o Groq
function buildTextForAI(segments: TranscriptSegment[], maxChars = 18000): string {
  const text = segments.map(s => s.text).join('\n');
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  return (
    text.slice(0, half) +
    '\n\n[... trecho intermediário omitido ...]\n\n' +
    text.slice(-half)
  );
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
  return chunks;
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
    }));
  }

  return [{
    id: `seg_${chunkIndex}_0_${Math.random().toString(36).substr(2, 6)}`,
    text: data.text?.trim() || '',
    timestamp: baseTimestamp,
  }];
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
  const allSegments: TranscriptSegment[] = [];
  const totalSize = audioBlob.size;

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(i + 1, chunks.length);
    const chunkStartRatio = chunks.slice(0, i).reduce((acc, c) => acc + c.size, 0) / totalSize;
    const baseTimestamp = Date.now() + Math.round(chunkStartRatio * 600 * 1000);
    const segments = await transcribeChunk(chunks[i], langCode, apiKey, i, baseTimestamp);
    allSegments.push(...segments);
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  // Retorna crua E otimizada
  return {
    raw: allSegments,
    clean: cleanTranscriptSegments(allSegments),
  };
}

// ─────────────────────────────────────────────
// RESUMO + ACTION ITEMS — usa transcrição limpa
// ─────────────────────────────────────────────
export async function summarizeMeeting(
  transcript: TranscriptSegment[],
  lang: string = 'pt-BR',
  userApiKey?: string | null
): Promise<{ summary: string; actionItems: string[] } | undefined> {
  const cleanSegments = cleanTranscriptSegments(transcript);
  // Gemini tem 1M tokens — sem truncamento necessário
  const fullText = cleanSegments.map(s => s.text).join('\n');
  if (!fullText.trim()) return undefined;

  const language = lang === 'pt-BR' ? 'português do Brasil' : 'English';

  const systemPrompt = `Você é um assistente especializado em reuniões. Responda em ${language}. Retorne APENAS JSON válido sem markdown nem blocos de código.`;
  const userPrompt = `Analise esta transcrição e retorne JSON com: {"summary": "resumo executivo em 3-5 parágrafos", "actionItems": ["tarefa1", "tarefa2"]}\n\n${fullText}`;

  const raw = await callGemini(systemPrompt, userPrompt);

  try {
    // Remove possíveis blocos de código do JSON
    const clean = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
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
// CHAT — usa transcrição limpa
// ─────────────────────────────────────────────
export async function chatWithTranscript(
  transcript: TranscriptSegment[],
  userPrompt: string,
  lang: string = 'pt-BR',
  userApiKey?: string | null
): Promise<string> {
  const cleanSegments = cleanTranscriptSegments(transcript);
  // Gemini tem 1M tokens — sem truncamento necessário
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

// Mantido para compatibilidade — não usado diretamente
async function _chatWithGroq(
  transcript: TranscriptSegment[],
  userPrompt: string,
  lang: string = 'pt-BR',
  userApiKey?: string | null
): Promise<string> {
  const apiKey = resolveApiKey(userApiKey);
  const cleanSegments = cleanTranscriptSegments(transcript);
  const fullText = buildTextForAI(cleanSegments);
  const language = lang === 'pt-BR' ? 'português do Brasil' : 'English';

  const res = await fetch(`${GROQ_API}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `Assistente de reuniões. Responda em ${language}.

Ao elaborar atas formais, siga rigorosamente este modelo:

# ATA DE REUNIÃO

**Data:** [data da reunião]
**Hora de início:** [hora]  
**Hora de término:** [hora]
**Participantes:** [nomes identificados na transcrição ou "Participantes não identificados"]

---

## 1. ABERTURA
[Como a reunião foi aberta e objetivo inicial]

## 2. ASSUNTOS TRATADOS
[Liste cada assunto discutido em subseções numeradas com detalhes relevantes]

### 2.1 [Primeiro assunto]
[Descrição detalhada, argumentos apresentados, valores mencionados]

### 2.2 [Segundo assunto]
...

## 3. DECISÕES TOMADAS
[Liste em bullets todas as decisões concretas tomadas]
- **Decisão 1:** descrição
- **Decisão 2:** descrição

## 4. PENDÊNCIAS E PRÓXIMOS PASSOS
[Tarefas, responsáveis e prazos mencionados]
| Ação | Responsável | Prazo |
|------|-------------|-------|
| ... | ... | ... |

## 5. ENCERRAMENTO
[Como a reunião foi encerrada]

---
*Ata elaborada automaticamente pelo VoxMeet*

Para resumos, análises e outros formatos, use markdown rico com títulos, subtítulos, tabelas e bullets conforme necessário. Nunca retorne texto simples sem formatação.` },
        { role: 'user', content: `Transcrição da reunião:\n\n${fullText}\n\nSolicitação do usuário: ${userPrompt}\n\nIMPORTANTE: Seja detalhado, profissional e use formatação markdown rica. Extraia o máximo de informação da transcrição.` },
      ],
      temperature: 0.5,
      max_tokens: 4096,
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
// VALIDAR CHAVE
// ─────────────────────────────────────────────
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${GROQ_API}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    return res.ok;
  } catch { return false; }
}

// src/services/groqService.ts
// VoxMeet — Groq AI Service (Whisper + LLaMA)
// Substitui geminiService.ts e a integração NVIDIA

import { TranscriptSegment } from '../types';

// Resolve a chave: usa a do cliente (plano Power) ou a chave mestra do ambiente
function resolveApiKey(userApiKey?: string | null): string {
  if (userApiKey && userApiKey.trim().length > 0) {
    return userApiKey.trim();
  }
  // Chave mestra sua — definida no .env como VITE_GROQ_API_KEY
  const masterKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!masterKey) {
    throw new Error(
      'Chave da API Groq não encontrada. Configure VITE_GROQ_API_KEY no arquivo .env'
    );
  }
  return masterKey;
}

// ─────────────────────────────────────────────
// TRANSCRIÇÃO DE ÁUDIO — Groq Whisper
// ─────────────────────────────────────────────
export async function transcribeAudio(
  audioBlob: Blob,
  lang: string = 'pt',
  userApiKey?: string | null
): Promise<TranscriptSegment[]> {
  const apiKey = resolveApiKey(userApiKey);

  // Groq Whisper aceita: flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-large-v3-turbo'); // melhor custo-benefício
  formData.append('language', lang.split('-')[0]); // 'pt' de 'pt-BR'
  formData.append('response_format', 'verbose_json'); // retorna timestamps por segmento
  formData.append('timestamp_granularities[]', 'segment');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Erro Groq Whisper: ${res.statusText}`);
  }

  const data = await res.json();

  // verbose_json retorna segments com start/end/text
  if (data.segments && data.segments.length > 0) {
    return data.segments.map((seg: any, i: number) => ({
      id: `seg_${i}_${Math.random().toString(36).substr(2, 6)}`,
      text: seg.text.trim(),
      timestamp: Date.now() + Math.round(seg.start * 1000),
      speaker: undefined, // diarização futura
    }));
  }

  // Fallback: texto simples sem timestamps
  return [
    {
      id: `seg_0_${Math.random().toString(36).substr(2, 6)}`,
      text: data.text?.trim() || '',
      timestamp: Date.now(),
    },
  ];
}

// ─────────────────────────────────────────────
// RESUMO + ACTION ITEMS — Groq LLaMA
// ─────────────────────────────────────────────
export async function summarizeMeeting(
  transcript: TranscriptSegment[],
  lang: string = 'pt-BR',
  userApiKey?: string | null
): Promise<{ summary: string; actionItems: string[] } | undefined> {
  const apiKey = resolveApiKey(userApiKey);

  const fullText = transcript.map((s) => s.text).join('\n');
  if (!fullText.trim()) return undefined;

  const systemPrompt = `Você é um assistente especializado em reuniões corporativas. 
Sempre responda em ${lang === 'pt-BR' ? 'português do Brasil' : 'inglês'}.
Seja conciso e profissional.`;

  const userPrompt = `Analise a transcrição abaixo e retorne um JSON com exatamente este formato:
{
  "summary": "resumo executivo em 3-5 parágrafos",
  "actionItems": ["tarefa 1", "tarefa 2", "tarefa 3"]
}

Transcrição:
${fullText}

Retorne APENAS o JSON, sem markdown, sem explicações.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
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
    // Se o JSON vier malformado, retorna o texto bruto como summary
    return { summary: content, actionItems: [] };
  }
}

// ─────────────────────────────────────────────
// CHAT COM A TRANSCRIÇÃO — Groq LLaMA
// ─────────────────────────────────────────────
export async function chatWithTranscript(
  transcript: TranscriptSegment[],
  userPrompt: string,
  lang: string = 'pt-BR',
  userApiKey?: string | null
): Promise<string> {
  const apiKey = resolveApiKey(userApiKey);

  const fullText = transcript.map((s) => s.text).join('\n');

  const systemPrompt = `Você é um assistente de reuniões. 
Responda em ${lang === 'pt-BR' ? 'português do Brasil' : 'inglês'}.
Use markdown quando ajudar na legibilidade (listas, negrito).
Seja direto e profissional.`;

  const contextPrompt = `Transcrição da reunião:\n\n${fullText}\n\nSolicitação do usuário: ${userPrompt}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextPrompt },
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
// VALIDAR CHAVE DO CLIENTE (plano Power)
// ─────────────────────────────────────────────
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

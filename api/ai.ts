// api/ai.ts — Vercel Serverless Function
// Proxy seguro para Gemini — chave nunca exposta no browser
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-2.5-flash';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — permite chamadas do app Capacitor (origin https://localhost)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Chave Gemini não configurada no servidor.' });

  const { systemPrompt, userPrompt } = req.body;
  if (!userPrompt) return res.status(400).json({ error: 'Prompt não fornecido.' });

  try {
    const geminiRes = await fetch(`${GEMINI_API}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 16384 },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      return res.status(geminiRes.status).json({ error: err?.error?.message || 'Erro Gemini' });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ text });
  } catch (err: any) {
    console.error('AI error:', err);
    return res.status(500).json({ error: err.message || 'Erro ao processar IA.' });
  }
}
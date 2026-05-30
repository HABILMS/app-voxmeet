// api/transcribe.ts — Vercel Serverless Function
// Proxy seguro para Groq Whisper — chave nunca exposta no browser
import type { VercelRequest, VercelResponse } from '@vercel/node';
import formidable from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Chave Groq não configurada no servidor.' });

  try {
    const form = formidable({ maxFileSize: 25 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const lang = (Array.isArray(fields.language) ? fields.language[0] : fields.language) || 'pt';
    const langCode = lang.split('-')[0];

    const fileBuffer = fs.readFileSync(file.filepath);
    const ext = (file.originalFilename || 'audio.webm').split('.').pop() || 'webm';
    const mimeType = file.mimetype || 'audio/webm';

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', langCode);
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    fs.unlinkSync(file.filepath);

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json({ error: err?.error?.message || 'Erro Groq Whisper' });
    }

    return res.status(200).json(await groqRes.json());
  } catch (err: any) {
    console.error('Transcribe error:', err);
    return res.status(500).json({ error: err.message || 'Erro ao transcrever.' });
  }
}

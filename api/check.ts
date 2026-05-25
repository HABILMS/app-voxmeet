// api/check.ts — Vercel Serverless Function
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ASAAS_API = 'https://api.asaas.com/v3';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { paymentId } = req.query;
  const ASAAS_KEY = process.env.ASAAS_API_KEY;

  if (!ASAAS_KEY || !paymentId) return res.status(400).json({ error: 'Dados inválidos.' });

  try {
    const r = await fetch(`${ASAAS_API}/payments/${paymentId}`, {
      headers: { access_token: ASAAS_KEY },
    });
    const data = await r.json();
    return res.status(200).json({ status: data.status, value: data.value });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

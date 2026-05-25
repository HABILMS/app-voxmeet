// api/checkout.ts — Vercel Serverless Function
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ASAAS_API = 'https://api.asaas.com/v3';

const PLAN_PRICES: Record<string, number> = {
  pro: 9.99,
  ultra: 19.99,
  power: 49.99,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan, userId, userEmail, userName } = req.body;

  if (!plan || !userId || !userEmail) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  const ASAAS_KEY = process.env.ASAAS_API_KEY;
  if (!ASAAS_KEY) {
    return res.status(500).json({ error: 'Chave Asaas não configurada.' });
  }

  const price = PLAN_PRICES[plan];
  if (!price) {
    return res.status(400).json({ error: 'Plano inválido.' });
  }

  try {
    // Busca ou cria cliente
    let customerId: string;
    const searchRes = await fetch(`${ASAAS_API}/customers?email=${encodeURIComponent(userEmail)}`, {
      headers: { access_token: ASAAS_KEY },
    });
    const searchData = await searchRes.json();

    if (searchData.data?.length > 0) {
      customerId = searchData.data[0].id;
    } else {
      const createRes = await fetch(`${ASAAS_API}/customers`, {
        method: 'POST',
        headers: { access_token: ASAAS_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName || userEmail,
          email: userEmail,
          externalReference: userId,
        }),
      });
      const customer = await createRes.json();
      if (!customer.id) throw new Error('Erro ao criar cliente no Asaas');
      customerId = customer.id;
    }

    // Cria cobrança Pix
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const chargeRes = await fetch(`${ASAAS_API}/payments`, {
      method: 'POST',
      headers: { access_token: ASAAS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: customerId,
        billingType: 'PIX',
        value: price,
        dueDate: dueDateStr,
        description: `VoxMeet — Plano ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
        externalReference: `${userId}:${plan}`,
      }),
    });

    const charge = await chargeRes.json();
    if (!charge.id) throw new Error(charge.errors?.[0]?.description || 'Erro ao criar cobrança');

    // QR Code Pix
    const pixRes = await fetch(`${ASAAS_API}/payments/${charge.id}/pixQrCode`, {
      headers: { access_token: ASAAS_KEY },
    });
    const pixData = await pixRes.json();

    return res.status(200).json({
      paymentId: charge.id,
      pixCode: pixData.payload,
      pixQrCode: pixData.encodedImage,
      value: price,
      plan,
    });

  } catch (err: any) {
    console.error('Asaas checkout error:', err);
    return res.status(500).json({ error: err.message || 'Erro ao gerar cobrança.' });
  }
}

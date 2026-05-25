// api/webhook.ts — Vercel Serverless Function
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PLAN_MINUTES: Record<string, number | null> = {
  pro: 300,
  ultra: null,
  power: null,
};

function getAdminDb() {
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
    return getFirestore();
  } catch (e) {
    console.error('Firebase Admin init error:', e);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Valida token
  const webhookToken = req.headers['asaas-access-token'] as string;
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (expectedToken && webhookToken !== expectedToken) {
    console.warn('Webhook token inválido');
    return res.status(401).json({ error: 'Token inválido' });
  }

  const event = req.body;
  console.log('Asaas webhook:', event.event, event.payment?.id);

  if (event.event !== 'PAYMENT_RECEIVED' && event.event !== 'PAYMENT_CONFIRMED') {
    return res.status(200).json({ received: true });
  }

  const payment = event.payment;
  if (!payment?.externalReference) return res.status(200).json({ received: true });

  const [userId, plan] = payment.externalReference.split(':');
  if (!userId || !plan) return res.status(200).json({ received: true });

  const adminDb = getAdminDb();
  if (adminDb) {
    try {
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await adminDb.collection('users').doc(userId).update({
        plan,
        minutesLimit: PLAN_MINUTES[plan] ?? null,
        minutesUsed: 0,
        planExpiresAt: expiresAt,
      });
      await adminDb.collection('payments').add({
        userId, plan,
        amount: payment.value,
        currency: 'BRL',
        method: 'pix',
        status: 'confirmed',
        asaasPaymentId: payment.id,
        createdAt: Date.now(),
        paidAt: Date.now(),
      });
      console.log(`Plano ${plan} ativado para ${userId}`);
    } catch (e) {
      console.error('Firestore update error:', e);
    }
  }

  return res.status(200).json({ received: true });
}

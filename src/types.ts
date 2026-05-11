// src/types.ts — VoxMeet

export interface Meeting {
  id: string;
  title: string;
  createdAt: number;
  duration: number;
  transcript: TranscriptSegment[];
  summary?: string;
  actionItems?: string[];
  speakers?: string[];
  source?: MeetingSource;
  status?: MeetingStatus;
  audioStoragePath?: string;
  audioUrl?: string;
  userId?: string;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  speaker?: string;
}

export type MeetingSource =
  | 'mic'
  | 'system'
  | 'whatsapp'
  | 'meet'
  | 'teams'
  | 'zoom'
  | 'upload';

export type MeetingStatus =
  | 'recording'
  | 'processing'
  | 'done'
  | 'error';

// ─────────────────────────────────────────────
// PLANOS
// ─────────────────────────────────────────────
export type SubscriptionPlan =
  | 'starter'   // free
  | 'pro_monthly'
  | 'pro_annual'
  | 'power';    // traga sua API

export interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  priceMonthlyBRL: number;
  priceMonthlyUSD: number;
  minutesPerMonth: number | null; // null = ilimitado
  maxSavedMeetings: number | null;
  features: string[];
}

export const PLAN_CONFIGS: Record<SubscriptionPlan, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthlyBRL: 0,
    priceMonthlyUSD: 0,
    minutesPerMonth: 60,
    maxSavedMeetings: 5,
    features: ['60 min/mês', '5 reuniões salvas', 'Resumo por IA', 'Exportar TXT'],
  },
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro',
    priceMonthlyBRL: 39,
    priceMonthlyUSD: 7.9,
    minutesPerMonth: 600,
    maxSavedMeetings: null,
    features: ['600 min/mês', 'Reuniões ilimitadas', 'Resumo + action items', 'Exportar TXT/PDF/DOCX', 'Identificação de speakers'],
  },
  pro_annual: {
    id: 'pro_annual',
    name: 'Pro Anual',
    priceMonthlyBRL: 329,
    priceMonthlyUSD: 66,
    minutesPerMonth: null,
    maxSavedMeetings: null,
    features: ['IA ilimitada no 1º ano', 'Tudo do Pro', 'Acesso beta a novas features', 'Prioridade no suporte'],
  },
  power: {
    id: 'power',
    name: 'Power',
    priceMonthlyBRL: 59,
    priceMonthlyUSD: 11.9,
    minutesPerMonth: null,
    maxSavedMeetings: null,
    features: ['Áudio ilimitado', 'API própria (Groq/OpenAI)', 'Zero custo de IA pra você', 'Todos os exports'],
  },
};

// ─────────────────────────────────────────────
// PERFIL DO USUÁRIO
// ─────────────────────────────────────────────
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  plan: SubscriptionPlan;
  planExpiresAt?: number;
  minutesUsed: number;
  minutesLimit: number | null;
  apiProvider?: 'groq' | 'openai';
  apiKey?: string | null; // chave do cliente — plano Power
  language: string;
  createdAt: number;
}

// ─────────────────────────────────────────────
// PAGAMENTOS
// ─────────────────────────────────────────────
export type PaymentMethod =
  | 'stripe_card'
  | 'stripe_pix'
  | 'usdt_trc20'
  | 'usdt_polygon'
  | 'usdt_bep20';

export type PaymentStatus =
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'refunded';

export interface Payment {
  id: string;
  userId: string;
  method: PaymentMethod;
  plan: SubscriptionPlan;
  amount: number;
  currency: 'BRL' | 'USD' | 'USDT';
  status: PaymentStatus;
  txHash?: string; // hash da transação cripto
  stripeSessionId?: string;
  createdAt: number;
}

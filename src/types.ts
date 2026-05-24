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
  | 'mic' | 'system' | 'whatsapp' | 'meet' | 'teams' | 'zoom' | 'upload';

export type MeetingStatus =
  | 'recording' | 'processing' | 'done' | 'error';

// ─────────────────────────────────────────────
// PLANOS
// ─────────────────────────────────────────────
export type SubscriptionPlan =
  | 'starter'     // free
  | 'pro'         // R$ 9,99/mês
  | 'ultra'       // R$ 19,99/mês
  | 'power';      // R$ 49,99/mês — API própria

export interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  priceMonthlyBRL: number;
  minutesPerMonth: number | null;
  maxSavedMeetings: number | null;
  features: string[];
  asaasProductId?: string; // ID do produto/plano no Asaas
}

export const PLAN_CONFIGS: Record<SubscriptionPlan, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthlyBRL: 0,
    minutesPerMonth: 60,
    maxSavedMeetings: 5,
    features: ['60 min/mês', '5 reuniões salvas', 'Exportar TXT'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthlyBRL: 9.99,
    minutesPerMonth: 300,
    maxSavedMeetings: 30,
    features: ['300 min/mês', '30 reuniões salvas', 'Resumo por IA', 'Chat IA', 'Exportar TXT e PDF'],
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    priceMonthlyBRL: 19.99,
    minutesPerMonth: null,
    maxSavedMeetings: null,
    features: ['Áudio ilimitado', 'Reuniões ilimitadas', 'Resumo + action items', 'Chat IA', 'Identificação de speakers', 'Exportar TXT, PDF e DOCX'],
  },
  power: {
    id: 'power',
    name: 'Power',
    priceMonthlyBRL: 49.99,
    minutesPerMonth: null,
    maxSavedMeetings: null,
    features: ['Tudo do Ultra', 'API própria (Groq/OpenAI)', 'Zero custo de IA pra você', 'Prioridade no suporte'],
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
  apiKey?: string | null;
  language: string;
  createdAt: number;
  asaasCustomerId?: string; // ID do cliente no Asaas
}

// ─────────────────────────────────────────────
// PAGAMENTOS
// ─────────────────────────────────────────────
export type PaymentMethod = 'pix' | 'credit_card' | 'boleto';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded' | 'overdue';

export interface Payment {
  id: string;
  userId: string;
  method: PaymentMethod;
  plan: SubscriptionPlan;
  amount: number;
  currency: 'BRL';
  status: PaymentStatus;
  asaasPaymentId?: string;
  asaasPixCode?: string;
  asaasPixQrCode?: string;
  createdAt: number;
  paidAt?: number;
}

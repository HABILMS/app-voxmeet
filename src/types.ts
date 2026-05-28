// src/types.ts — VoxMeet

export interface Meeting {
  id: string;
  title: string;
  createdAt: number;
  duration: number;
  transcript: TranscriptSegment[];        // transcrição crua original
  transcriptClean?: TranscriptSegment[];  // transcrição otimizada (sem ruídos)
  summary?: string;
  actionItems?: string[];
  speakers?: string[];
  source?: MeetingSource;
  status?: MeetingStatus;
  audioStoragePath?: string;
  audioUrl?: string;
  userId?: string;
  expiresAt?: number; // timestamp de expiração baseado no plano
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
  | 'starter'       // free
  | 'pro'           // R$ 9,99/mês
  | 'ultra'         // R$ 19,99/mês
  | 'power'         // R$ 49,99/mês
  | 'pro_monthly'   // legado
  | 'pro_annual';   // legado

export interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  priceMonthlyBRL: number;
  minutesPerMonth: number | null;
  maxSavedMeetings: number | null;
  retentionDays: number | null; // null = ilimitado
  features: string[];
}

export const PLAN_CONFIGS: Record<SubscriptionPlan, PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthlyBRL: 0,
    minutesPerMonth: 60,
    maxSavedMeetings: 5,
    retentionDays: 7,
    features: ['60 min/mês', '5 reuniões salvas', 'Reuniões por 7 dias', 'Exportar TXT'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthlyBRL: 9.99,
    minutesPerMonth: 300,
    maxSavedMeetings: 30,
    retentionDays: 90,
    features: ['300 min/mês', '30 reuniões salvas', 'Reuniões por 90 dias', 'Resumo por IA', 'Chat IA', 'Exportar TXT e PDF'],
  },
  ultra: {
    id: 'ultra',
    name: 'Ultra',
    priceMonthlyBRL: 19.99,
    minutesPerMonth: null,
    maxSavedMeetings: null,
    retentionDays: 365,
    features: ['Áudio ilimitado', 'Reuniões ilimitadas', 'Reuniões por 1 ano', 'Resumo + action items', 'Chat IA', 'Identificação de speakers', 'Exportar TXT, PDF e DOCX'],
  },
  power: {
    id: 'power',
    name: 'Power',
    priceMonthlyBRL: 49.99,
    minutesPerMonth: null,
    maxSavedMeetings: null,
    retentionDays: null,
    features: ['Tudo do Ultra', 'Retenção ilimitada', 'API própria (Groq/OpenAI)', 'Zero custo de IA pra você', 'Prioridade no suporte'],
  },
  // Legado
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro',
    priceMonthlyBRL: 9.99,
    minutesPerMonth: 300,
    maxSavedMeetings: 30,
    retentionDays: 90,
    features: ['300 min/mês', '30 reuniões salvas', 'Resumo por IA', 'Chat IA'],
  },
  pro_annual: {
    id: 'pro_annual',
    name: 'Ultra',
    priceMonthlyBRL: 19.99,
    minutesPerMonth: null,
    maxSavedMeetings: null,
    retentionDays: 365,
    features: ['Áudio ilimitado', 'Reuniões ilimitadas', 'Resumo por IA', 'Chat IA'],
  },
};

// Retorna dias de retenção do plano (compatível com legado)
export function getPlanRetentionDays(plan: SubscriptionPlan): number | null {
  return PLAN_CONFIGS[plan]?.retentionDays ?? 7;
}

// Calcula timestamp de expiração baseado no plano
export function calcExpiresAt(plan: SubscriptionPlan, createdAt: number): number | null {
  const days = getPlanRetentionDays(plan);
  if (days === null) return null;
  return createdAt + days * 24 * 60 * 60 * 1000;
}

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
  asaasCustomerId?: string;
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

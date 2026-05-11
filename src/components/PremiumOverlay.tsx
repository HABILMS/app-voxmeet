// src/components/PremiumOverlay.tsx — VoxMeet
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Check, Zap, Star, Crown, Sparkles,
  CreditCard, QrCode, Bitcoin, ChevronDown, ExternalLink
} from 'lucide-react';
import { PLAN_CONFIGS, SubscriptionPlan, PaymentMethod } from '../types';
import { cn } from '../lib/utils';

interface PremiumOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: SubscriptionPlan;
}

const PLAN_ICONS: Record<SubscriptionPlan, React.ReactNode> = {
  starter: <Zap className="w-5 h-5" />,
  pro_monthly: <Star className="w-5 h-5" />,
  pro_annual: <Sparkles className="w-5 h-5" />,
  power: <Crown className="w-5 h-5" />,
};

const PLAN_COLORS: Record<SubscriptionPlan, string> = {
  starter: 'text-white/40',
  pro_monthly: 'text-blue-400',
  pro_annual: 'text-purple-400',
  power: 'text-amber-400',
};

const USDT_NETWORKS = [
  { id: 'usdt_trc20' as PaymentMethod, label: 'TRC-20 (Tron)', fee: '~$0.00', recommended: true },
  { id: 'usdt_polygon' as PaymentMethod, label: 'Polygon (MATIC)', fee: '~$0.01', recommended: false },
  { id: 'usdt_bep20' as PaymentMethod, label: 'BEP-20 (BSC)', fee: '~$0.10', recommended: false },
];

export function PremiumOverlay({ isOpen, onClose, currentPlan = 'starter' }: PremiumOverlayProps) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('pro_monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [usdtNetwork, setUsdtNetwork] = useState<PaymentMethod>('usdt_trc20');
  const [showNetworks, setShowNetworks] = useState(false);
  const [step, setStep] = useState<'plans' | 'payment'>('plans');

  const plan = PLAN_CONFIGS[selectedPlan];
  const isAnnual = selectedPlan === 'pro_annual';
  const isUpgrade = selectedPlan !== currentPlan && selectedPlan !== 'starter';

  const priceLabel = () => {
    if (plan.priceMonthlyBRL === 0) return 'Grátis';
    if (isAnnual) return `R$ ${plan.priceMonthlyBRL}/ano`;
    return `R$ ${plan.priceMonthlyBRL}/mês`;
  };

  const priceUSD = () => {
    if (plan.priceMonthlyUSD === 0) return '';
    if (isAnnual) return `US$ ${plan.priceMonthlyUSD}/yr`;
    return `US$ ${plan.priceMonthlyUSD}/mo`;
  };

  const handleCheckout = () => {
    if (!paymentMethod) return;
    // TODO: integrar Stripe / NOWPayments
    // Por enquanto abre a URL de checkout
    if (paymentMethod === 'stripe_card' || paymentMethod === 'stripe_pix') {
      window.open('https://voxmeet.app/checkout?plan=' + selectedPlan, '_blank');
    } else {
      window.open('https://voxmeet.app/crypto?plan=' + selectedPlan + '&network=' + usdtNetwork, '_blank');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-[#080808] border border-white/10 rounded-[28px] overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {step === 'plans' ? 'Escolha seu plano' : 'Finalizar pagamento'}
                </h2>
                <p className="text-xs text-white/30 mt-0.5">
                  {step === 'plans' ? 'Cancele quando quiser' : plan.name + ' · ' + priceLabel()}
                </p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step: Planos */}
            {step === 'plans' && (
              <div className="p-5 space-y-3">

                {/* Banner marketing */}
                <div className="px-4 py-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-xs text-purple-300 flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>🎉 Plano Anual: <strong>IA ilimitada no 1º ano</strong> — sem custos extras de API</span>
                </div>

                {(Object.keys(PLAN_CONFIGS) as SubscriptionPlan[]).map((planId) => {
                  const p = PLAN_CONFIGS[planId];
                  const isSelected = selectedPlan === planId;
                  const isCurrent = currentPlan === planId;

                  return (
                    <button
                      key={planId}
                      onClick={() => setSelectedPlan(planId)}
                      className={cn(
                        "w-full p-4 rounded-2xl border text-left transition-all",
                        isSelected
                          ? "border-white/30 bg-white/5"
                          : "border-white/5 bg-white/[0.02] hover:border-white/10"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={PLAN_COLORS[planId]}>{PLAN_ICONS[planId]}</span>
                          <span className="font-bold text-white text-sm">{p.name}</span>
                          {isCurrent && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/40">
                              atual
                            </span>
                          )}
                          {planId === 'pro_annual' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                              -30%
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold text-sm">{
                            p.priceMonthlyBRL === 0 ? 'Grátis' :
                            planId === 'pro_annual' ? `R$ ${p.priceMonthlyBRL}/ano` :
                            `R$ ${p.priceMonthlyBRL}/mês`
                          }</p>
                          {p.priceMonthlyUSD > 0 && (
                            <p className="text-white/30 text-[10px]">{
                              planId === 'pro_annual'
                                ? `US$ ${p.priceMonthlyUSD}/yr`
                                : `US$ ${p.priceMonthlyUSD}/mo`
                            }</p>
                          )}
                        </div>
                      </div>
                      <ul className="space-y-1">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-xs text-white/50">
                            <Check className="w-3 h-3 text-green-400 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}

                <button
                  onClick={() => isUpgrade && setStep('payment')}
                  disabled={!isUpgrade}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold text-sm transition-all mt-2",
                    isUpgrade
                      ? "bg-white text-black hover:bg-white/90 active:scale-98"
                      : "bg-white/5 text-white/20 cursor-not-allowed"
                  )}
                >
                  {isUpgrade ? `Assinar ${plan.name} →` : 'Você já está neste plano'}
                </button>
              </div>
            )}

            {/* Step: Pagamento */}
            {step === 'payment' && (
              <div className="p-5 space-y-4">

                <button
                  onClick={() => setStep('plans')}
                  className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1 mb-2"
                >
                  ← Voltar aos planos
                </button>

                <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Cartão / Pix</p>

                {/* Cartão */}
                <button
                  onClick={() => setPaymentMethod('stripe_card')}
                  className={cn(
                    "w-full p-4 rounded-2xl border flex items-center gap-3 transition-all text-left",
                    paymentMethod === 'stripe_card'
                      ? "border-blue-500/50 bg-blue-500/5"
                      : "border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Cartão de crédito</p>
                    <p className="text-xs text-white/30">Visa, Mastercard, Elo — até 12x</p>
                  </div>
                </button>

                {/* Pix */}
                <button
                  onClick={() => setPaymentMethod('stripe_pix')}
                  className={cn(
                    "w-full p-4 rounded-2xl border flex items-center gap-3 transition-all text-left",
                    paymentMethod === 'stripe_pix'
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Pix</p>
                    <p className="text-xs text-white/30">Aprovação instantânea</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-full bg-green-500/20 text-green-400 font-bold">
                    5% off
                  </span>
                </button>

                <p className="text-xs text-white/40 uppercase tracking-widest mt-4 mb-3">
                  Criptomoeda (USDT)
                  <span className="ml-2 text-white/20 normal-case tracking-normal">Sem IOF</span>
                </p>

                {/* USDT */}
                <button
                  onClick={() => { setPaymentMethod(usdtNetwork); setShowNetworks(true); }}
                  className={cn(
                    "w-full p-4 rounded-2xl border flex items-center gap-3 transition-all text-left",
                    paymentMethod && ['usdt_trc20','usdt_polygon','usdt_bep20'].includes(paymentMethod)
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Bitcoin className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">USDT Stablecoin</p>
                    <p className="text-xs text-white/30">Sem variação cambial</p>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-white/30 transition-transform",
                    showNetworks && "rotate-180"
                  )} />
                </button>

                {/* Redes USDT */}
                <AnimatePresence>
                  {showNetworks && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-4 space-y-2 pb-2">
                        {USDT_NETWORKS.map((net) => (
                          <button
                            key={net.id}
                            onClick={() => { setUsdtNetwork(net.id); setPaymentMethod(net.id); }}
                            className={cn(
                              "w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all",
                              usdtNetwork === net.id
                                ? "border-amber-500/40 bg-amber-500/5"
                                : "border-white/5 hover:border-white/10"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white/70">{net.label}</span>
                              {net.recommended && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                                  recomendado
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-white/30">{net.fee}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Resumo e botão final */}
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Plano</span>
                    <span className="text-white font-medium">{plan.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">Total</span>
                    <div className="text-right">
                      <p className="text-white font-bold">{priceLabel()}</p>
                      {priceUSD() && <p className="text-white/30 text-xs">{priceUSD()}</p>}
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={!paymentMethod}
                    className={cn(
                      "w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                      paymentMethod
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-white/5 text-white/20 cursor-not-allowed"
                    )}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ir para pagamento seguro
                  </button>

                  <p className="text-[10px] text-white/20 text-center">
                    Pagamentos processados por Stripe (cartão/Pix) e NOWPayments (USDT)
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

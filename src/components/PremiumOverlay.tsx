// src/components/PremiumOverlay.tsx — VoxMeet
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Zap, Star, Crown, Sparkles, QrCode, Copy, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { PLAN_CONFIGS, SubscriptionPlan } from '../types';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';

interface PremiumOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: SubscriptionPlan;
}

const PLAN_ICONS: Record<SubscriptionPlan, React.ReactNode> = {
  starter: <Zap className="w-5 h-5" />,
  pro: <Star className="w-5 h-5" />,
  ultra: <Sparkles className="w-5 h-5" />,
  power: <Crown className="w-5 h-5" />,
};

const PLAN_COLORS: Record<SubscriptionPlan, string> = {
  starter: 'text-white/40',
  pro: 'text-blue-400',
  ultra: 'text-purple-400',
  power: 'text-amber-400',
};

type Step = 'plans' | 'pix' | 'success';

interface PixData {
  paymentId: string;
  pixCode: string;
  pixQrCode: string;
  value: number;
  plan: string;
}

export function PremiumOverlay({ isOpen, onClose, currentPlan = 'starter' }: PremiumOverlayProps) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('pro');
  const [step, setStep] = useState<Step>('plans');
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkCount, setCheckCount] = useState(0);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const plan = PLAN_CONFIGS[selectedPlan];
  const isUpgrade = selectedPlan !== 'starter' && selectedPlan !== currentPlan;

  // Verifica pagamento a cada 5s após gerar Pix
  useEffect(() => {
    if (step === 'pix' && pixData) {
      checkIntervalRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/asaas/check/${pixData.paymentId}`);
          const data = await r.json();
          setCheckCount(c => c + 1);
          if (data.status === 'RECEIVED' || data.status === 'CONFIRMED') {
            clearInterval(checkIntervalRef.current!);
            setStep('success');
          }
        } catch (e) {}
      }, 5000);
    }
    return () => { if (checkIntervalRef.current) clearInterval(checkIntervalRef.current); };
  }, [step, pixData]);

  const handleGeneratePix = async () => {
    const user = auth.currentUser;
    if (!user) { setError('Faça login primeiro.'); return; }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/asaas/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          userId: user.uid,
          userEmail: user.email,
          userName: user.displayName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar Pix');

      setPixData(data);
      setStep('pix');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyPix = async () => {
    if (!pixData?.pixCode) return;
    await navigator.clipboard.writeText(pixData.pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    setStep('plans');
    setPixData(null);
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={step !== 'pix' ? handleClose : undefined}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-[#080808] border border-white/10 rounded-[28px] overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {step === 'plans' ? 'Escolha seu plano' : step === 'pix' ? 'Pagar com Pix' : 'Pagamento confirmado!'}
                </h2>
                <p className="text-xs text-white/30 mt-0.5">
                  {step === 'plans' ? 'Cancele quando quiser' : step === 'pix' ? `${plan.name} · R$ ${plan.priceMonthlyBRL.toFixed(2)}/mês` : 'Seu plano foi ativado'}
                </p>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-white/5 rounded-full text-white/40">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step: Planos */}
            {step === 'plans' && (
              <div className="p-5 space-y-3">
                {error && (
                  <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
                    {error}
                  </div>
                )}

                {(Object.keys(PLAN_CONFIGS) as SubscriptionPlan[]).map((planId) => {
                  const p = PLAN_CONFIGS[planId];
                  const isSelected = selectedPlan === planId;
                  const isCurrent = currentPlan === planId;

                  return (
                    <button
                      key={planId}
                      onClick={() => planId !== 'starter' && setSelectedPlan(planId)}
                      disabled={planId === 'starter'}
                      className={cn(
                        "w-full p-4 rounded-2xl border text-left transition-all",
                        planId === 'starter' ? "opacity-40 cursor-not-allowed border-white/5" :
                        isSelected ? "border-white/30 bg-white/5" : "border-white/5 hover:border-white/10"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={PLAN_COLORS[planId]}>{PLAN_ICONS[planId]}</span>
                          <span className="font-bold text-white text-sm">{p.name}</span>
                          {isCurrent && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/40">atual</span>}
                          {planId === 'pro' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">mais popular</span>}
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold text-sm">
                            {p.priceMonthlyBRL === 0 ? 'Grátis' : `R$ ${p.priceMonthlyBRL.toFixed(2)}/mês`}
                          </p>
                        </div>
                      </div>
                      <ul className="space-y-1">
                        {p.features.map(f => (
                          <li key={f} className="flex items-center gap-2 text-xs text-white/50">
                            <Check className="w-3 h-3 text-green-400 shrink-0" /> {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}

                <button
                  onClick={handleGeneratePix}
                  disabled={!isUpgrade || isLoading}
                  className={cn(
                    "w-full py-4 rounded-2xl font-bold text-sm transition-all mt-2 flex items-center justify-center gap-2",
                    isUpgrade && !isLoading ? "bg-white text-black hover:bg-white/90" : "bg-white/5 text-white/20 cursor-not-allowed"
                  )}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                  {isLoading ? 'Gerando Pix...' : isUpgrade ? `Pagar com Pix — R$ ${plan.priceMonthlyBRL.toFixed(2)}` : 'Selecione um plano'}
                </button>

                <p className="text-[10px] text-white/20 text-center">Pagamento processado por Asaas · Pix instantâneo</p>
              </div>
            )}

            {/* Step: Pix */}
            {step === 'pix' && pixData && (
              <div className="p-5 space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-sm text-white/60">Escaneie o QR Code ou copie o código Pix</p>
                  <p className="text-2xl font-bold text-white">R$ {pixData.value.toFixed(2)}</p>
                </div>

                {/* QR Code */}
                {pixData.pixQrCode && (
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-2xl">
                      <img
                        src={`data:image/png;base64,${pixData.pixQrCode}`}
                        alt="QR Code Pix"
                        className="w-48 h-48"
                      />
                    </div>
                  </div>
                )}

                {/* Código Pix copia e cola */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Pix copia e cola</p>
                  <p className="text-xs text-white/60 break-all font-mono leading-relaxed">
                    {pixData.pixCode?.substring(0, 60)}...
                  </p>
                  <button
                    onClick={copyPix}
                    className="mt-3 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm text-white/70 hover:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar código Pix'}
                  </button>
                </div>

                {/* Status verificação */}
                <div className="flex items-center justify-center gap-2 text-sm text-white/30">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Aguardando pagamento... ({checkCount} verificações)
                </div>

                <p className="text-[10px] text-white/20 text-center">
                  O plano é ativado automaticamente após confirmação do Pix
                </p>
              </div>
            )}

            {/* Step: Sucesso */}
            {step === 'success' && (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Plano ativado!</h3>
                  <p className="text-sm text-white/50">
                    Seu plano <strong className="text-white">{plan.name}</strong> foi ativado com sucesso.
                    Recarregue a página para ver as novas funcionalidades.
                  </p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-3 rounded-2xl bg-white text-black font-bold text-sm hover:bg-white/90 transition-colors"
                >
                  Recarregar app
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

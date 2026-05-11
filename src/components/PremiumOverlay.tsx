import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, Calendar, Youtube, Globe, FileText, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface PremiumOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PremiumOverlay({ isOpen, onClose }: PremiumOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col overflow-y-auto px-6 py-12"
        >
          <div className="max-w-md mx-auto w-full relative">
            <button
              onClick={onClose}
              className="absolute -top-4 -right-2 p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-white/50" />
            </button>

            <header className="text-center mb-10 mt-4">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
                  <Mic className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold uppercase tracking-widest text-white mb-2">
                DESTRAVE O PREMIUM
              </h1>
              <p className="text-xl font-medium text-white/80">ACESSE ILIMITADO</p>
            </header>

            <div className="space-y-6 mb-12">
              <FeatureItem
                icon={<Mic className="w-6 h-6 text-blue-400" />}
                title="Transcreva qualquer áudio"
                description="instantaneamente — sem limites"
              />
              <FeatureItem
                icon={<Calendar className="w-6 h-6 text-orange-400" />}
                title="Gravar e organizar"
                description="todas as reuniões"
              />
              <FeatureItem
                icon={<Youtube className="w-6 h-6 text-red-500" />}
                title="Resumir vídeos do YouTube"
                description="em segundos"
              />
              <FeatureItem
                icon={<Globe className="w-6 h-6 text-green-400" />}
                title="Entenda o mundo"
                description="em mais de 120 idiomas"
              />
              <FeatureItem
                icon={<FileText className="w-6 h-6 text-blue-200" />}
                title="Enviar conteúdo"
                description="áudio, PDF, YouTube e mais"
              />
            </div>

            <div className="space-y-4">
              <PricingCard
                title="Anual Ilimitado"
                price="R$ 159,99"
                period="por ano"
                isBestValue
              />
              <PricingCard
                title="Semanal Ilimitado"
                price="R$ 19,99"
                period="por semana"
              />
            </div>

            <footer className="mt-10 text-center space-y-6">
              <p className="text-sm text-white/40 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> CANCELAR A QUALQUER MOMENTO
              </p>
              
              <button 
                onClick={onClose}
                className="w-full btn-primary py-4 text-lg"
              >
                Continuar
              </button>

              <div className="flex justify-center gap-8 text-xs text-white/30">
                <a href="#" className="hover:text-white/60">Termos de Serviço</a>
                <a href="#" className="hover:text-white/60">Política de Privacidade</a>
              </div>
            </footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-1">{icon}</div>
      <div>
        <p className="text-white font-semibold flex items-center gap-2">
          {title} <span className="text-white/60 font-normal">— {description}</span>
        </p>
      </div>
    </div>
  );
}

function PricingCard({ title, price, period, isBestValue }: { title: string; price: string; period: string; isBestValue?: boolean }) {
  return (
    <div className={cn(
      "relative p-5 rounded-2xl glass transition-all border-2",
      isBestValue ? "border-purple-500 bg-white/5" : "border-white/5"
    )}>
      {isBestValue && (
        <div className="absolute -top-3 left-4 px-3 py-0.5 bg-purple-500 text-[10px] font-bold text-white rounded-full uppercase tracking-wider">
          Melhor Valor
        </div>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <p className="text-sm text-white/50">Só {price} {period}</p>
        </div>
        <div className="w-6 h-6 rounded-full border-2 border-white/20" />
      </div>
    </div>
  );
}

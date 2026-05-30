// src/components/SpeakerphoneAlert.tsx — VoxMeet
// Aviso de viva-voz — aparece apenas no mobile ao iniciar gravação
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, X } from 'lucide-react';

interface SpeakerphoneAlertProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export function SpeakerphoneAlert({ isVisible, onDismiss }: SpeakerphoneAlertProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring', damping: 20 }}
          className="mx-4 mb-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Volume2 className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-300">
                Vai gravar uma chamada?
              </p>
              <p className="text-xs text-amber-400/70 mt-0.5 leading-relaxed">
                Ative o <strong className="text-amber-300">viva-voz</strong> e aumente o volume para capturar a voz de todos os participantes com qualidade.
              </p>
            </div>
            <button
              onClick={onDismiss}
              className="text-amber-500/40 hover:text-amber-400 transition-colors shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

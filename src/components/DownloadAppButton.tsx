// src/components/DownloadAppButton.tsx — VoxMeet
// Botão reutilizável para baixar o APK Android
import { Download, Smartphone } from 'lucide-react';
import { cn } from '../lib/utils';

interface DownloadAppButtonProps {
  variant?: 'hero' | 'menu' | 'compact';
  className?: string;
}

export function DownloadAppButton({ variant = 'hero', className }: DownloadAppButtonProps) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/voxmeet.apk';
    link.download = 'voxmeet.apk';
    link.click();
  };

  if (variant === 'compact') {
    return (
      <button
        onClick={handleDownload}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors",
          className
        )}
        title="Baixar app Android"
      >
        <Smartphone className="w-4 h-4" />
        App Android
      </button>
    );
  }

  if (variant === 'menu') {
    return (
      <button
        onClick={handleDownload}
        className={cn(
          "flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-left",
          className
        )}
      >
        <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Baixar app Android</p>
          <p className="text-xs text-white/40">APK · 3.3 MB</p>
        </div>
        <Download className="w-4 h-4 text-white/30" />
      </button>
    );
  }

  // hero
  return (
    <button
      onClick={handleDownload}
      className={cn(
        "group flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all hover:scale-[1.02]",
        className
      )}
    >
      <Smartphone className="w-5 h-5 text-green-400" />
      <div className="text-left">
        <p className="text-sm font-bold text-white">Baixar para Android</p>
        <p className="text-[10px] text-white/40 uppercase tracking-wider">APK direto · 3.3 MB</p>
      </div>
      <Download className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
    </button>
  );
}

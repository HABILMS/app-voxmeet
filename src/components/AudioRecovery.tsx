// src/components/AudioRecovery.tsx — VoxMeet
// Banner de recuperação de áudio salvo no IndexedDB
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HardDrive, RefreshCw, Trash2, X, Loader2 } from 'lucide-react';
import { transcribeAudio } from '../services/groqService';
import { getAudioBackups as getBackups, deleteAudioBackup as deleteBackup } from '../hooks/useTranscription';
import type { TranscriptSegment, MeetingSource, UserProfile } from '../types';

interface AudioRecoveryProps {
  userProfile?: UserProfile | null;
  onRecover: (segments: TranscriptSegment[], segmentsClean: TranscriptSegment[], source: MeetingSource) => void;
}

interface Backup {
  id: string;
  blob: Blob;
  mimeType: string;
  savedAt: number;
}

export function AudioRecovery({ userProfile, onRecover }: AudioRecoveryProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isTranscribing, setIsTranscribing] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    getBackups().then(setBackups).catch(() => {});
  }, []);

  if (backups.length === 0 || dismissed) return null;

  const handleRecover = async (backup: Backup) => {
    setIsTranscribing(backup.id);
    try {
      const lang = userProfile?.language?.split('-')[0] || 'pt';
      const result = await transcribeAudio(backup.blob, lang, userProfile?.apiKey);
      await deleteBackup(backup.id);
      setBackups(prev => prev.filter(b => b.id !== backup.id));
      onRecover(result.raw, result.clean, 'mic');
    } catch (err: any) {
      alert(`Erro ao transcrever: ${err.message}`);
    } finally {
      setIsTranscribing(null);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteBackup(id).catch(() => {});
    setBackups(prev => prev.filter(b => b.id !== id));
  };

  const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  const formatAge = (ts: number) => {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 60) return `${mins}min atrás`;
    return `${Math.round(mins / 60)}h atrás`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="mx-4 mb-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-300">
            <HardDrive className="w-4 h-4" />
            <span className="text-sm font-bold">
              {backups.length === 1 ? 'Gravação não transcrita encontrada' : `${backups.length} gravações não transcritas`}
            </span>
          </div>
          <button onClick={() => setDismissed(true)} className="text-amber-400/40 hover:text-amber-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {backups.map(backup => (
          <div key={backup.id} className="flex items-center justify-between gap-3 bg-white/5 rounded-xl p-3">
            <div className="text-xs text-white/50 space-y-0.5">
              <p className="text-white/70 font-medium">Áudio salvo {formatAge(backup.savedAt)}</p>
              <p>{formatSize(backup.blob.size)} · {backup.mimeType.split('/')[1]?.toUpperCase()}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRecover(backup)}
                disabled={!!isTranscribing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {isTranscribing === backup.id
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Transcrevendo...</>
                  : <><RefreshCw className="w-3 h-3" /> Recuperar</>
                }
              </button>
              <button
                onClick={() => handleDelete(backup.id)}
                disabled={!!isTranscribing}
                className="p-1.5 text-white/20 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}

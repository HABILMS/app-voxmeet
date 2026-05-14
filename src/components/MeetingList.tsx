// src/components/MeetingList.tsx — VoxMeet
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileAudio, Calendar, Clock, ChevronRight, Search, Trash2, Pencil, Check, X } from 'lucide-react';
import { Meeting } from '../types';
import { cn } from '../lib/utils';

interface MeetingListProps {
  meetings: Meeting[];
  onSelect: (meeting: Meeting) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

export function MeetingList({ meetings, onSelect, onDelete, onRename }: MeetingListProps) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = meetings.filter(m =>
    m.title?.toLowerCase().includes(search.toLowerCase()) ||
    m.transcript?.some(s => s.text.toLowerCase().includes(search.toLowerCase()))
  );

  const startEdit = (m: Meeting) => {
    setEditingId(m.id);
    setEditTitle(m.title || '');
  };

  const confirmEdit = (id: string) => {
    if (editTitle.trim()) onRename(id, editTitle);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const sourceLabel: Record<string, string> = {
    mic: '🎙 Mic', system: '🖥 Meeting', whatsapp: '📱 WhatsApp',
    meet: '🟢 Meet', teams: '🔵 Teams', zoom: '🟣 Zoom', upload: '📁 Upload',
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-8">
      <header className="mb-8 space-y-4">
        <h2 className="text-3xl font-serif italic text-white/90">Suas Reuniões</h2>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-white/50 transition-colors" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar reuniões ou transcrições..."
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 pl-12 pr-6 outline-none focus:border-white/20 transition-all placeholder:text-white/20 text-sm"
          />
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-white/20 text-center gap-4 border-2 border-dashed border-white/5 rounded-[40px]">
          <Calendar className="w-16 h-16 opacity-10" />
          <p className="text-lg">{search ? 'Nenhum resultado encontrado.' : 'Nenhuma reunião gravada ainda.'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((meeting) => (
            <div key={meeting.id} className="group relative">
              <AnimatePresence>
                {confirmDeleteId === meeting.id && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute inset-0 z-10 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between px-5"
                  >
                    <p className="text-sm text-red-300">Excluir esta reunião?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { onDelete(meeting.id); setConfirmDeleteId(null); }}
                        className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-xl font-bold hover:bg-red-600 transition-colors"
                      >
                        Excluir
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1.5 bg-white/10 text-white/60 text-xs rounded-xl hover:bg-white/20 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={cn(
                "flex items-center gap-4 p-4 glass-card bg-white/5 border-white/5 transition-all hover:bg-white/[0.07] rounded-2xl",
                confirmDeleteId === meeting.id && "opacity-0"
              )}>
                {/* Ícone */}
                <div
                  onClick={() => editingId !== meeting.id && onSelect(meeting)}
                  className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform cursor-pointer shrink-0"
                >
                  <FileAudio className={cn("w-5 h-5", meeting.summary ? "text-purple-400" : "text-white/40")} />
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  {editingId === meeting.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') confirmEdit(meeting.id); if (e.key === 'Escape') cancelEdit(); }}
                        className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500/50"
                      />
                      <button onClick={() => confirmEdit(meeting.id)} className="p-1.5 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEdit} className="p-1.5 text-white/40 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <h3
                      onClick={() => onSelect(meeting)}
                      className="text-base font-bold text-white truncate mb-1 cursor-pointer hover:text-white/80 transition-colors"
                    >
                      {meeting.title || 'Reunião sem título'}
                    </h3>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-white/30 font-mono uppercase tracking-widest flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(meeting.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.floor(meeting.duration / 60)}min {meeting.duration % 60}s
                    </span>
                    {meeting.source && (
                      <span>{sourceLabel[meeting.source] ?? meeting.source}</span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(meeting)}
                    className="p-2 text-white/20 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                    title="Editar título"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(meeting.id)}
                    className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => onSelect(meeting)} className="p-2 text-white/20 group-hover:text-white/60 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

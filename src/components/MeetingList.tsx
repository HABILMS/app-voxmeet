import { motion } from 'motion/react';
import { FileAudio, Calendar, Clock, ChevronRight, Search } from 'lucide-react';
import { Meeting } from '../types';
import { cn } from '../lib/utils';

interface MeetingListProps {
  meetings: Meeting[];
  onSelect: (meeting: Meeting) => void;
}

export function MeetingList({ meetings, onSelect }: MeetingListProps) {
  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-8">
      <header className="mb-10 space-y-6">
        <h2 className="text-3xl font-serif italic text-white/90">Suas Reuniões</h2>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-white/50 transition-colors" />
          <input
            type="text"
            placeholder="Buscar por reuniões, datas ou transcrições..."
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-6 outline-none focus:border-white/20 transition-all placeholder:text-white/20"
          />
        </div>
      </header>

      {meetings.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-white/20 text-center gap-4 border-2 border-dashed border-white/5 rounded-[40px]">
          <Calendar className="w-16 h-16 opacity-10" />
          <p className="text-lg">Nenhuma reunião gravada ainda.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {meetings.map((meeting) => (
            <motion.button
              key={meeting.id}
              whileHover={{ x: 8 }}
              onClick={() => onSelect(meeting)}
              className="group flex items-center gap-6 p-5 glass-card bg-white/5 border-white/5 text-left transition-all hover:bg-white/10"
            >
              <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileAudio className={cn(
                  "w-6 h-6",
                  meeting.summary ? "text-purple-400" : "text-white/40"
                )} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate mb-1">
                  {meeting.title || 'Reunião sem título'}
                </h3>
                <div className="flex items-center gap-4 text-xs text-white/40 font-mono uppercase tracking-widest">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    {new Date(meeting.createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {Math.floor(meeting.duration / 60)}min {meeting.duration % 60}s
                  </span>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-white transition-colors" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

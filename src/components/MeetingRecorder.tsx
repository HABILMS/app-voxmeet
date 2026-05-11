import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  Square, 
  Save, 
  RotateCcw, 
  Languages, 
  Sparkles, 
  Loader2, 
  Brain, 
  MessageSquare, 
  X, 
  Send, 
  Download,
  Share2
} from 'lucide-react';
import { useTranscription } from '../hooks/useTranscription';
import { cn } from '../lib/utils';
import { TranscriptSegment } from '../types';
import { GoogleGenAI } from "@google/genai";

const LANGUAGES = [
  { code: 'pt-BR', name: 'Português' },
  { code: 'en-US', name: 'English' },
  { code: 'es-ES', name: 'Español' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'it-IT', name: 'Italiano' },
];

interface MeetingRecorderProps {
  onSave: (segments: TranscriptSegment[], audioUrl?: string | null) => void;
}

export function MeetingRecorder({ onSave }: MeetingRecorderProps) {
  const [lang, setLang] = useState(() => localStorage.getItem('pro_lang') || 'pt-BR');
  const { isRecording, segments, setSegments, interimText, audioUrl, audioBlob, startRecording, stopRecording, captureMode, setCaptureMode } = useTranscription(lang);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [assistantResponse, setAssistantResponse] = useState('');
  const responseEndRef = useRef<HTMLDivElement>(null);

  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    localStorage.setItem('pro_lang', newLang);
  };

  const handleTranscribeWithAI = async () => {
    if (!audioBlob) return;
    setIsProcessingAI(true);
    
    try {
        const apiKey = (process as any).env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
          throw new Error("A chave da API do Gemini não foi encontrada. Certifique-se de que o ambiente está configurado corretamente.");
        }

        const ai = new GoogleGenAI({ apiKey });
        
        // Convert Blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });

        const base64Data = await base64Promise;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: audioBlob.type || 'audio/webm',
              },
            },
            { text: `Transcreva este áudio com precisão. Importante: Forneça APENAS o texto da transcrição sem blocos markdown ou formatação extra. O idioma provável é ${lang || 'pt-BR'}. Adicione quebras de parágrafo naturais.` }
          ]
        });

        if (response.text) {
          // Create a new segment representing the full AI transcription
          setSegments([{
            id: Math.random().toString(36).substr(2, 9),
            text: response.text,
            timestamp: Date.now(),
          }]);
        }
    } catch (err: any) {
        console.error("Transcription error:", err);
        let msg = err.message || 'Erro ao processar áudio com IA';
        if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
          msg = "A chave de API configurada é inválida.";
        } else if (msg.includes('API_KEY_SERVICE_BLOCKED') || msg.includes('are blocked')) {
          msg = "Acesso Bloqueado: A chave da API do Gemini inserida possui restrições ou a 'Generative Language API' não está ativada no seu Google Cloud Project. Habilite a API no Google Cloud Console ou crie uma chave sem restrições no AI Studio (aistudio.google.com/app/apikey).";
        }
        alert(`Erro: ${msg}`);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleSummarizeWithNvidia = async () => {
    if (segments.length === 0) return;
    setIsProcessingAI(true);
    try {
      const fullText = segments.map(s => s.text).join('\n\n');
      
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText, lang })
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
         throw new Error("O servidor retornou um erro (HTML). Se estiver no Render, certifique-se de implantar como 'Web Service' (Node) e não 'Static Site'.");
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Falha na API da NVIDIA (Status ${res.status})`);
      }
      
      const data = await res.json();
      
      if (data.summary) {
        setSegments(prev => [
          ...prev, 
          {
            id: Math.random().toString(36).substr(2, 9),
            text: `=== RESUMO (NVIDIA AI) ===\n\n${data.summary}`,
            timestamp: Date.now(),
          }
        ]);
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao resumir transcrição. Verifique se a NVIDIA_API_KEY está configurada.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleAssistantRequest = async () => {
    if (!assistantPrompt.trim() || segments.length === 0) return;
    setIsProcessingAI(true);
    setAssistantResponse('');
    
    try {
        const apiKey = (process as any).env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
          throw new Error("A chave da API do Gemini não foi encontrada.");
        }

        const ai = new GoogleGenAI({ apiKey });
        const fullText = segments.map(s => s.text).join('\n\n');

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            { text: `Você é um assistente de reuniões. Aqui está a transcrição da reunião:\n\n${fullText}\n\nO usuário solicitou: ${assistantPrompt}\n\nResponda de forma profissional e formatada (use markdown se necessário, mas mantenha limpo). Se pedirem para separar locutores, use sua melhor estimativa baseada no contexto. Se pedirem tradução, traduza preservando o tom.` }
          ]
        });

        if (response.text) {
          setAssistantResponse(response.text);
        }
    } catch (err: any) {
        console.error("Assistant error:", err);
        let msg = err.message || 'Falha ao processar solicitação';
        if (msg.includes('API_KEY_SERVICE_BLOCKED') || msg.includes('are blocked')) {
          msg = "Acesso Bloqueado: A chave da API do Gemini possui restrições ou a API (Generative Language) não está ativada no projeto. Acesse aistudio.google.com/app/apikey para usar uma chave válida.";
        }
        alert(`Erro AI: ${msg}`);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const exportAssistantResponse = () => {
    if (!assistantResponse) return;
    const blob = new Blob([assistantResponse], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ia_reuniao_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto py-8">
      {/* Header with Selectors */}
      <div className="flex items-center justify-between px-6 mb-4 flex-wrap gap-4">
        <h2 className="text-sm font-mono uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", isRecording ? "bg-red-500 animate-pulse" : "bg-white/10")} />
          {isRecording ? "Gravando" : "Pronto para gravar"}
        </h2>

        <div className="flex items-center gap-2">
          {/* Capture Mode Toggle */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => setCaptureMode('mic')}
                disabled={isRecording}
                className={cn(
                  "px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all",
                  captureMode === 'mic' ? "bg-white text-black" : "text-white/40 hover:text-white/60"
                )}
              >
                Mic
              </button>
              <button
                onClick={() => setCaptureMode('system')}
                disabled={isRecording}
                className={cn(
                  "px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all",
                  captureMode === 'system' ? "bg-white text-black" : "text-white/40 hover:text-white/60",
                  !(typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && "opacity-30"
                )}
              >
                Meeting
              </button>
            </div>
            {captureMode === 'system' && !isRecording && (
              <span className="text-[9px] text-blue-400 font-medium animate-pulse">
                Marque "Compartilhar áudio" ao iniciar
              </span>
            )}
            {!(typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && !isRecording && (
               <span className="text-[9px] text-white/20">Apenas Desktop</span>
            )}
          </div>

          <div className="relative group">
            <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white/60 focus-within:border-white/20 transition-all">
              <Languages className="w-4 h-4" />
              <select 
                value={lang} 
                onChange={(e) => handleLangChange(e.target.value)}
                disabled={isRecording}
                className="bg-transparent outline-none cursor-pointer disabled:cursor-not-allowed pr-4"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#050505]">
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 px-4 scrollbar-hide py-10">
        {segments.length === 0 && !interimText && !isRecording && (
          <div className="h-full flex flex-col items-center justify-center text-white/20 text-center space-y-4">
            <Mic className="w-16 h-16 opacity-10" />
            <p className="text-xl font-medium">Toque no microfone para começar</p>
          </div>
        )}

        {isProcessingAI && (
          <div className="h-full flex flex-col items-center justify-center text-white/50 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
            <p className="text-lg font-medium animate-pulse">Processando áudio com IA. Isso pode levar alguns minutos...</p>
          </div>
        )}

        {!isProcessingAI && segments.map((segment) => (
          <motion.div
            key={segment.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-1"
          >
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
              {new Date(segment.timestamp).toLocaleTimeString()}
            </span>
            <p className="text-xl md:text-2xl font-light text-white/90 leading-relaxed whitespace-pre-wrap">
              {segment.text}
            </p>
          </motion.div>
        ))}

        {interimText && (
          <div className="flex flex-col gap-1 opacity-50">
            <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
              Em tempo real {captureMode === 'system' && '(Apenas seu microfone)'}
            </span>
            <p className="text-xl md:text-2xl font-light text-white leading-relaxed italic">
              {interimText}
            </p>
          </div>
        )}
      </div>

      <div className="p-4 md:p-8 glass-card bg-black/40 border-white/5 rounded-t-[40px] flex items-center justify-between gap-3 md:gap-8">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex-1 btn-primary py-4 md:py-6 rounded-3xl group flex flex-col items-center justify-center gap-1 md:gap-2 bg-white text-black hover:bg-white/90 min-w-0"
          >
            <Mic className="text-black w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
            <span className="text-sm md:text-lg font-bold truncate w-full px-2">Iniciar Gravação</span>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex-1 bg-red-500 text-white flex flex-col items-center justify-center gap-1 md:gap-2 py-4 md:py-6 rounded-3xl active:scale-95 transition-all shadow-xl shadow-red-500/20 min-w-0"
          >
            <Square className="w-5 h-5 md:w-6 md:h-6 fill-white animate-pulse" />
            <span className="text-sm md:text-lg font-bold truncate w-full px-2">Parar Gravação</span>
          </button>
        )}

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {audioBlob && !isRecording && (
            <button
              onClick={handleTranscribeWithAI}
              disabled={isProcessingAI}
              className="w-12 h-12 md:w-16 md:h-16 glass rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-blue-400 hover:bg-blue-400/10 transition-colors disabled:opacity-50 group border border-white/5"
              title="Transcrever com IA"
            >
              {isProcessingAI ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Sparkles className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />}
              <span className="text-[7px] md:text-[8px] uppercase font-bold mt-1">IA Trans</span>
            </button>
          )}

          {segments.length > 0 && !isRecording && (
            <button
              onClick={() => setIsAssistantOpen(true)}
              className="w-12 h-12 md:w-16 md:h-16 glass rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-blue-400 hover:bg-blue-400/10 transition-colors border border-white/5 group shadow-lg shadow-blue-500/5"
              title="Solicitações customizadas com IA"
            >
              <MessageSquare className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[7px] md:text-[8px] uppercase font-bold mt-1">IA Chat</span>
            </button>
          )}

          {segments.length > 0 && !isRecording && (
            <button
              onClick={handleSummarizeWithNvidia}
              disabled={isProcessingAI}
              className="w-12 h-12 md:w-16 md:h-16 glass rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-purple-400 hover:bg-purple-400/10 transition-colors disabled:opacity-50 group border border-white/5"
              title="Resumir com IA"
            >
              {isProcessingAI ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Brain className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />}
              <span className="text-[7px] md:text-[8px] uppercase font-bold mt-1">Resumo</span>
            </button>
          )}

          {(segments.length > 0 || audioBlob) && !isRecording && (
            <button
              onClick={() => onSave(segments, audioUrl)}
              className="w-14 h-12 md:w-20 md:h-16 glass rounded-xl md:rounded-2xl flex flex-col items-center justify-center text-green-400 hover:bg-green-400/10 transition-colors group border-2 border-green-400/20 shadow-[0_0_20px_rgba(74,222,128,0.1)]"
              title="Salvar Reunião"
            >
              <Save className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
              <span className="text-[8px] md:text-[9px] uppercase font-black mt-0.5 md:mt-1">SALVAR</span>
            </button>
          )}
        </div>
      </div>

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {isAssistantOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !isProcessingAI && setIsAssistantOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[32px] overflow-hidden flex flex-col max-h-[80vh] shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">IA Assistant</h3>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Custom Requests</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAssistantOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {assistantResponse ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                      <p className="text-sm text-white/50 mb-2 font-medium flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" /> Sua solicitação:
                      </p>
                      <p className="text-sm text-white/80">{assistantPrompt}</p>
                    </div>
                    <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl prose prose-invert max-w-none">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-white/90">
                        {assistantResponse}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-auto py-8 flex flex-col items-center justify-center text-center space-y-4 text-white/20">
                    <Brain className="w-12 h-12 opacity-10" />
                    <p className="text-sm px-10">Peça resumos específicos, traduções ou análises detalhadas da sua transcrição.</p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-4 px-4 max-w-lg">
                      {[
                        "Resuma os 3 pontos principais",
                        "Extraia as tarefas e responsáveis",
                        "Faça uma ata formal da reunião",
                        "Liste os tópicos discutidos principais"
                      ].map(prompt => (
                        <button
                          key={prompt}
                          onClick={() => setAssistantPrompt(prompt)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs rounded-full border border-white/5 transition-colors text-left"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={responseEndRef} />
              </div>

              <div className="p-6 bg-white/[0.02] border-t border-white/5">
                {assistantResponse && (
                  <button
                    onClick={exportAssistantResponse}
                    className="mb-4 w-full py-3 px-4 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-wider"
                  >
                    <Download className="w-4 h-4" /> Exportar Resultado para TXT
                  </button>
                )}
                
                <div className="relative">
                  <textarea
                    value={assistantPrompt}
                    onChange={(e) => setAssistantPrompt(e.target.value)}
                    placeholder="Ex: Resuma os 3 pontos principais, Seque em Português, Separe quem falou o quê..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-blue-500/50 focus:outline-none transition-all resize-none h-24"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAssistantRequest();
                      }
                    }}
                  />
                  <button
                    onClick={handleAssistantRequest}
                    disabled={isProcessingAI || !assistantPrompt.trim() || segments.length === 0}
                    className="absolute bottom-3 right-3 p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all disabled:opacity-20 disabled:cursor-not-allowed group shadow-lg shadow-blue-500/20"
                  >
                    {isProcessingAI ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-white/20 text-center uppercase tracking-tighter">
                  Pressione Enter para enviar (Shift+Enter para nova linha)
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

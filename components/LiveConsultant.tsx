
import React, { useState, useRef, useEffect } from 'react';
import { doTextCompletion } from '../services/doClient';
import { Mic, MicOff, Volume2, VolumeX, MessageCircle, Info, Sparkles, Loader2, PlayCircle, ShieldCheck } from 'lucide-react';

interface LiveConsultantProps {
  initialPrompt?: string;
  onProposalExtracted?: (text: string) => void;
}

export const LiveConsultant: React.FC<LiveConsultantProps> = ({ initialPrompt, onProposalExtracted }) => {
  const [isActive, setIsActive] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [transcriptionHistory, setTranscriptionHistory] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const toggleSession = async () => {
    if (isActive) {
      setIsActive(false);
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (speechUtteranceRef.current) {
        window.speechSynthesis.cancel();
        speechUtteranceRef.current = null;
      }
      return;
    }

    try {
      setIsTyping(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setIsActive(true);
      setTranscriptionHistory(prev => [...prev, 'You: [microphone connected]'].slice(-10));

      try {
        const system = 'You are Kaseddie, a professional and warm career consultant for GlobalPath. Keep responses concise and supportive.';
        const user = 'Greet the user briefly (one sentence) and prompt them to describe their skills.';
        const reply = await doTextCompletion(system, user).catch(() => 'Hello! Tell me about your skills and target country.');
        setTranscriptionHistory(prev => [...prev, `AI: ${reply}`].slice(-10));
        if (!isMuted && 'speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(reply);
          utter.rate = 1;
          utter.pitch = 1;
          speechUtteranceRef.current = utter;
          window.speechSynthesis.speak(utter);
        }
      } catch {
        // Fallback handled above
      } finally {
        setIsTyping(false);
      }
    } catch (e) {
      console.error(e);
      setIsTyping(false);
    }
  };

  useEffect(() => {
    const sanitizeProposal = (text: string) => {
      let t = text || '';
      t = t.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, '$1');
      t = t.replace(/^\s*(here\s+is\s+your\s+proposal[:\-]?\s*)/i, '');
      t = t.replace(/^\s*(Assistant|AI)\s*:\s*/i, '');
      const m = t.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          const obj = JSON.parse(m[0]);
          const extracted =
            obj?.proposal?.pitches?.[0] ||
            obj?.proposal?.pitch ||
            obj?.proposal;
          if (typeof extracted === 'string' && extracted.trim()) {
            t = extracted;
          }
        } catch {}
      }
      t = t.trim();
      if (!/GlobalPath/i.test(t)) {
        t = `${t}\n\n— GlobalPath`;
      }
      return t;
    };
    const runStructuredProposal = async () => {
      if (!initialPrompt || initialPrompt.trim() === '') return;
      setIsTyping(true);
      try {
        const system =
          "You are a professional Recruitment Officer. When given a job description, output ONLY the final B2B proposal. Do not include introductory text, JSON tags, or the user's original prompt. Start immediately with 'To: [Company]' and end with the GlobalPath signature.";
        const user = initialPrompt;
        const raw = await doTextCompletion(system, user);
        const clean = sanitizeProposal(raw);
        if (clean && clean.trim()) {
          setTranscriptionHistory(prev => [...prev, `AI: Clean copy ready.`].slice(-10));
          onProposalExtracted?.(clean);
        } else {
          setTranscriptionHistory(prev => [...prev, `AI: Unable to produce clean copy.`].slice(-10));
        }
      } catch (error) {
        console.error('CHATBOT ERROR:', error);
        setTranscriptionHistory(prev => [...prev, `AI: Uplink error - ${error}`].slice(-10));
      } finally {
        setIsTyping(false);
      }
    };
    runStructuredProposal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-12">
      <div className="bg-slate-900 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden flex flex-col items-center">
         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-500/50 to-transparent"></div>
         
         <div className="z-10 text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-500/10 border border-brand-500/20 rounded-full mb-6">
               <Sparkles size={14} className="text-brand-400" />
               <span className="text-[10px] font-black uppercase tracking-widest text-brand-400">Live AI Voice Consulting</span>
            </div>
            <h2 className="text-5xl font-black mb-4 tracking-tighter">Talk to Kaseddie</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
              Real-time voice consultation for your next career move. No typing required—just speak to the agent.
            </p>
         </div>

         <div className="relative z-10 flex flex-col items-center gap-8">
            <button 
              onClick={toggleSession}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${
                isActive 
                ? 'bg-red-600 shadow-[0_0_60px_rgba(220,38,38,0.5)] animate-pulse scale-110' 
                : 'bg-brand-600 shadow-[0_0_40px_rgba(14,165,233,0.3)] hover:scale-105'
              }`}
            >
               {isTyping ? <Loader2 className="animate-spin" size={40} /> : (isActive ? <MicOff size={48} /> : <Mic size={48} />)}
            </button>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
               {isTyping ? 'Generating greeting…' : (isActive ? 'Session Live - Speak Now' : 'Click to start consultation')}
            </div>
         </div>

         {isActive && (
           <div className="mt-12 w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md animate-slideUp">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-4">
                 <div className="flex items-center gap-2">
                    <Volume2 size={16} className="text-brand-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audio Stream Active</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Processing...</span>
                 </div>
              </div>
              <div className="space-y-3 h-32 overflow-y-auto scrollbar-hide text-[11px] font-medium text-slate-300">
                 {transcriptionHistory.map((t, i) => <div key={`${t}-${i}`} className="animate-fadeIn">{t}</div>)}
              </div>
           </div>
         )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
            <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl mb-4"><ShieldCheck size={24} /></div>
            <h4 className="font-black text-xs uppercase tracking-widest mb-2">Private Uplink</h4>
            <p className="text-[10px] text-slate-400 font-bold leading-relaxed">Encrypted audio channel ensures your career plans remain confidential.</p>
         </div>
         <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
            <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl mb-4"><PlayCircle size={24} /></div>
            <h4 className="font-black text-xs uppercase tracking-widest mb-2">Zero Latency</h4>
            <p className="text-[10px] text-slate-400 font-bold leading-relaxed">Human-like responses with context-aware intelligence.</p>
         </div>
         <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center text-center">
            <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl mb-4"><Info size={24} /></div>
            <h4 className="font-black text-xs uppercase tracking-widest mb-2">Multi-lingual</h4>
            <p className="text-[10px] text-slate-400 font-bold leading-relaxed">Kaseddie understands professional and local nuances.</p>
         </div>
      </div>
    </div>
  );
};

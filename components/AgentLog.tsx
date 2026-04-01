
import React, { useEffect, useRef } from 'react';
import { AgentLogEntry } from '../types';
import { Terminal, Activity, CheckCircle, AlertTriangle, Zap, ChevronRight } from 'lucide-react';

interface AgentLogProps {
  logs: AgentLogEntry[];
}

export const AgentLog: React.FC<AgentLogProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-white/5 backdrop-blur-xl text-slate-100 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl h-96 flex flex-col relative">
      {/* Background Glow */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-500/50 to-transparent"></div>
      
      <div className="bg-black/20 backdrop-blur-md p-5 border-b border-white/10 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Terminal size={18} className="text-brand-500" />
          <span className="text-[10px] font-black font-mono text-brand-400 tracking-[0.3em] uppercase">Oversight_Uplink_Kaseddie</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">
           <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
           <span>Full-Spectrum Scan</span>
        </div>
      </div>

      {/* Overflow Scroll for Mobile/Desktop */}
      <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] space-y-4 scrollbar-hide">
        {logs.slice().reverse().map((log) => (
          <div key={log.id} className={`flex gap-4 animate-fadeIn border-l-2 pl-4 transition-colors ${
            log.type === 'warning' ? 'border-amber-500/50 bg-amber-500/5' : 
            log.type === 'error' ? 'border-red-500/50 bg-red-500/5' : 
            'border-slate-800 hover:border-brand-500/50'
          }`}>
            <div className="text-slate-600 text-[9px] whitespace-nowrap pt-1 font-black">
              [{log.timestamp.toLocaleTimeString([], { hour12: false })}]
            </div>
            <div className="flex-1 pb-3">
               <div className="flex items-center gap-2 mb-1.5">
                 {log.type === 'thinking' && <Activity size={10} className="text-brand-400 animate-pulse" />}
                 {log.type === 'success' && <CheckCircle size={10} className="text-emerald-400" />}
                 {log.type === 'warning' && <AlertTriangle size={10} className="text-amber-400" />}
                 
                 <span className={`text-[9px] font-black uppercase tracking-widest ${
                   log.type === 'thinking' ? 'text-brand-400' :
                   log.type === 'success' ? 'text-emerald-400' :
                   log.type === 'error' ? 'text-red-400' : 
                   log.type === 'warning' ? 'text-amber-400' :
                   'text-slate-500'
                 }`}>
                   {log.step}
                 </span>
               </div>
               
               <p className={`leading-relaxed text-[12px] ${
                 log.type === 'warning' ? 'text-amber-100 font-bold' : 'text-slate-300'
               }`}>
                 {log.message}
               </p>

               {log.actionable && (
                 <button 
                  onClick={log.onAction}
                  className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                 >
                   {log.actionLabel || "Execute Action"} <ChevronRight size={12} />
                 </button>
               )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-3 bg-black/20 border-t border-white/10 flex justify-center">
         <div className="text-[8px] text-slate-600 font-black uppercase tracking-[0.5em]">
           GlobalPath Kaseddie ASR System V5.0
         </div>
      </div>
    </div>
  );
};

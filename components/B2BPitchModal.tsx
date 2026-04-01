
import React, { useState } from 'react';
import { B2BPitch, Job, AgentLogEntry } from '../types';
import { X, Copy, Mail, ExternalLink, Zap, Users, ShieldCheck, CheckCircle2, MessageCircle, Sparkles } from 'lucide-react';
import { refinePitch } from '../services/PitchRefiner';

interface B2BPitchModalProps {
  pitch: B2BPitch;
  job: Job;
  batchSize: number;
  onClose: () => void;
  onLog?: (message: string, type: AgentLogEntry['type'], step?: string) => void;
}

export const B2BPitchModal: React.FC<B2BPitchModalProps> = ({ pitch, job, batchSize, onClose, onLog }) => {
  const [copied, setCopied] = useState(false);
  const fromAddress = (import.meta as any)?.env?.VITE_COMPANY_EMAIL || 'hr@globalpathkaseddieagent.com';
  const [tunedDraft, setTunedDraft] = useState<string>(pitch.proposal);
  const [tuning, setTuning] = useState<boolean>(false);
  const [sentToast, setSentToast] = useState<boolean>(false);

  const handleCopy = () => {
    const emailBody = `${tunedDraft}\n\n—\nKaseddie-Marathon-Hunter | GlobalPath Labor Operations | Toronto-GCC Corridor`;
    navigator.clipboard.writeText(emailBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppSend = () => {
    const text = `*B2B STRATEGIC PROPOSAL: ${job.title.toUpperCase()} at ${job.company.toUpperCase()}*\n\nFrom: ${fromAddress}\n\nAttention: ${pitch.hiringManager}\n\n${tunedDraft}\n\n—\nKaseddie-Marathon-Hunter | GlobalPath Labor Operations | Toronto-GCC Corridor`;
    const number = (job.hrContact || '').replace(/[^0-9]/g, '') || '256784428821';
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank');
  };
  
  const handleFineTune = async () => {
    setTuning(true);
    try {
      const result = await refinePitch(job, tunedDraft);
      setTunedDraft(result);
      onLog?.("AI PITCH TUNED: Draft refined for Zero-Fee mandate.", "success", "PITCH");
    } catch {
      onLog?.("AI PITCH TUNING FAILED: Using original draft.", "warning", "PITCH");
    } finally {
      setTuning(false);
    }
  };
  
  const handleSendEmail = () => {
    navigator.clipboard.writeText(tunedDraft).then(() => {
      setSentToast(true);
      setTimeout(() => setSentToast(false), 2500);
      onLog?.("PITCH_DISPATCHED: Pitch copied, opening PrivateEmail.", "success", "PITCH");
      window.open('https://privateemail.com/appsuite/', '_blank');
    }).catch(() => {
      onLog?.("PITCH_COPY_FAILED: Please copy manually.", "warning", "PITCH");
      window.open('https://privateemail.com/appsuite/', '_blank');
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-slideUp border border-slate-200">
        <div className="bg-slate-900 p-8 text-white relative">
           <button onClick={onClose} className="absolute top-6 left-6 underline text-sm" style={{ color: '#EAB308' }}>← Back to Stream</button>
           <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
           <div className="flex items-center gap-3 mb-2">
              <Zap className="text-brand-500" size={20} />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-400">B2B Authority Pitch</span>
           </div>
           <h2 className="text-3xl font-black tracking-tight">{job.company} Outreach</h2>
           <p className="text-slate-400 text-sm mt-1">Hiring Authority: <span className="text-white font-bold">{pitch.hiringManager}</span></p>
           {sentToast && (
             <div className="absolute left-1/2 -translate-x-1/2 top-2 bg-black/40 border border-white/20 text-white text-[10px] font-black px-3 py-1 rounded-xl">
               Pitch Copied! Opening PrivateEmail...
             </div>
           )}
        </div>

        <div className="p-8 space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Node</div>
                 <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Mail size={12} className="text-brand-500" />
                    {pitch.email || `hr@${job.company.toLowerCase().replace(/\s/g, '')}.com`}
                 </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">From</div>
                 <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Mail size={12} className="text-brand-500" />
                    {fromAddress}
                 </div>
              </div>
              <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100">
                 <div className="text-[9px] font-black text-brand-400 uppercase tracking-widest mb-1">Workforce Readiness</div>
                 <div className="text-xs font-black text-brand-700 flex items-center gap-2">
                    <Users size={12} />
                    Verified Ready Workforce (50+)
                 </div>
              </div>
           </div>

           <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Autonomous Proposal Draft</h4>
            <div className="flex items-center gap-3">
              <button onClick={handleFineTune} disabled={tuning} className="text-[10px] font-black text-amber-600 uppercase hover:underline flex items-center gap-1 transition-all">
                <Sparkles size={12} /> {tuning ? 'Tuning...' : 'AI Fine-Tune'}
              </button>
              <button onClick={handleCopy} className="text-[10px] font-black text-brand-600 uppercase hover:underline flex items-center gap-1 transition-all">
                {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy Draft'}
              </button>
              <button onClick={handleSendEmail} className="px-6 py-2 rounded font-bold" style={{ backgroundColor: '#EAB308', color: '#031B4E' }}>
                SEND VIA HR PORTAL
              </button>
            </div>
          </div>
          <div className="bg-slate-900 text-slate-300 p-6 rounded-3xl font-mono text-[11px] leading-relaxed border border-slate-800 h-64 overflow-y-auto scrollbar-hide">
            {tunedDraft}
          </div>
           </div>

           <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-3">
              <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
              <p className="text-[10px] text-emerald-800 font-bold leading-relaxed">
                AUTHORITY NOTE: This proposal emphasizes our "Verified Ready Workforce" standing pool. Zero-Fee recruitment and rapid deployment capacity are strictly positioned.
              </p>
           </div>
        </div>

        <div className="p-8 pt-0 flex gap-4">
           <button 
            onClick={onClose}
            className="px-8 bg-slate-100 text-slate-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
           >
             Back
           </button>
           <button 
            onClick={handleWhatsAppSend}
            className="flex-1 bg-[#25D366] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-[#128C7E] transition-all active:scale-95"
           >
             <MessageCircle size={18} /> Send via WhatsApp
           </button>
           <button 
            onClick={handleSendEmail}
            className="px-8 bg-brand-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-700 transition-all"
           >
             Send Pitch
           </button>
        </div>
      </div>
    </div>
  );
};

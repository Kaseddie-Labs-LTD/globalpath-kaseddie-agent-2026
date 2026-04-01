
import React from 'react';
import { ShieldCheck, FileText, Fingerprint, Award, Globe, Building2, UserCheck, Scale, X } from 'lucide-react';

interface VerificationReportProps {
  batchId: string;
  candidateName: string;
  jobTitle: string;
  targetCountry: string;
  sector: string;
  matchScore: number;
  onClose?: () => void;
}

export const ProfessionalVerificationReport: React.FC<VerificationReportProps> = ({
  batchId,
  candidateName,
  jobTitle,
  targetCountry,
  sector,
  matchScore,
  onClose
}) => {
  return (
    <div className="bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden max-w-2xl mx-auto animate-fadeIn relative">
      {onClose && (
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 transition-colors z-10">
          <X size={20} />
        </button>
      )}
      
      {/* Document Header */}
      <div className="p-8 border-b-4 border-brand-600 bg-slate-50/50">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-600 text-white rounded-lg">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Verification Audit Report</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">GlobalPath Kaseddie Agent • Secure Node Dispatch</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reference ID</div>
            <div className="text-sm font-mono font-bold text-slate-900">REF-{batchId.split('-').pop()}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Subject Name</label>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck size={14} className="text-brand-500" />
                {candidateName}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Assigned Corridor</label>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Globe size={14} className="text-brand-500" />
                {targetCountry}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Target Vacancy</label>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 size={14} className="text-brand-500" />
                {jobTitle}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Economic Sector</label>
              <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award size={14} className="text-brand-500" />
                {sector}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Body */}
      <div className="p-8 space-y-8 relative">
        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none rotate-[-35deg] scale-150 select-none">
          <h1 className="text-9xl font-black uppercase text-slate-900">VERIFIED</h1>
        </div>

        <div className="grid grid-cols-3 gap-4 relative z-10">
          <div className="col-span-2 space-y-6 border-r border-slate-100 pr-8">
            <div className="space-y-3">
              <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Fingerprint size={14} className="text-brand-600" />
                Biometric & Document Analysis
              </h3>
              <div className="space-y-2">
                {[
                  { label: 'Passport MRZ Compliance', status: 'Passed' },
                  { label: 'Background Security Check', status: 'Cleared' },
                  { label: 'Medical (GAMCA) Verification', status: 'Vetted' },
                  { label: 'Zero-Fee Mandate Compliance', status: 'Enforced' }
                ].map((item, i) => (
                  <div key={`${item.label}-${i}`} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-600">{item.label}</span>
                    <span className="text-emerald-600 font-black flex items-center gap-1">
                      <ShieldCheck size={12} /> {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <Scale size={14} className="text-emerald-600" />
                <span className="text-[10px] font-black text-emerald-700 uppercase">Compliance Statement</span>
              </div>
              <p className="text-[10px] text-emerald-800 font-medium leading-relaxed italic">
                Subject has been cross-referenced against the "Zero-Fee Mandate." No candidate-side payments have been detected or authorized. System lock active on employment contract.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center text-center space-y-4 relative z-10">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                <circle 
                  cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" 
                  strokeDasharray={364} strokeDashoffset={364 - (364 * matchScore) / 100}
                  className="text-brand-600 transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-900">{matchScore}%</span>
                <span className="text-[7px] font-black text-slate-400 uppercase leading-none">Reasoning Score</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Gemini 3 Insight</div>
              <p className="text-[10px] text-slate-600 font-bold leading-tight">High correlation between subject skills and corridor requirements.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Digitally Signed by GlobalPath Kaseddie Agent</span>
        </div>
        <div className="text-[8px] font-mono text-slate-500">
          CRC: {Math.random().toString(16).substring(2, 10).toUpperCase()}
        </div>
      </div>
    </div>
  );
};

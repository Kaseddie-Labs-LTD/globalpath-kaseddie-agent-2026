
import React, { useState, useMemo } from 'react';
import { Job, getJobLocationString } from '../../types';
import { complianceAuditor, AuditResult } from '../services/complianceAuditor';
import { pitchGenerator, B2BPitch } from '../services/pitchGenerator';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Zap, 
  Search, 
  FileText, 
  MessageSquare, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { AgentLogEntry } from '../../types';

interface ComplianceDashboardProps {
  jobs: Job[];
  onLog?: (message: string, type: any, step?: string) => void;
  onSummon?: (job: Job) => void;
}

const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ jobs, onLog, onSummon }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [pitch, setPitch] = useState<B2BPitch | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const auditedLeads = useMemo(() => {
    return jobs.map(job => ({
      job,
      audit: complianceAuditor.audit(job)
    }));
  }, [jobs]);

  const filteredLeads = useMemo(() => {
    return auditedLeads.filter(lead => 
      lead.job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.job.company?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [auditedLeads, searchTerm]);

  const handleSummonAgent = async (job: Job) => {
    setIsGenerating(true);
    setSelectedJob(job);
    onLog?.(`SUMMON AGENT: Initializing Worker Lifecycle for ${job.title || 'Unknown Role'} at ${job.company || 'Unknown Company'}.`, "thinking", "LIFECYCLE");
    
    try {
      const generatedPitch = await pitchGenerator.generatePitch(job);
      setPitch(generatedPitch);
      onLog?.(`LIFECYCLE: Lead transitioned to ACTIVE OUTREACH status. AI Handshake ready.`, "success", "LIFECYCLE");
      
      // Notify parent to move lead to Active Outreach state
      if (onSummon) {
        onSummon(job);
      }
    } catch (error) {
      console.error('Failed to generate pitch:', error);
      onLog?.(`LIFECYCLE ERROR: Failed to transition lead. Check node connectivity.`, "error", "LIFECYCLE");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center gap-3">
              <ShieldCheck className="w-10 h-10 text-emerald-400" />
              KASEDDIE COMPLIANCE
            </h1>
            <p className="text-emerald-400 mt-2 font-black uppercase tracking-[0.2em] text-[10px]">Ethical Recruitment Auditor • GlobalPath Node</p>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
            <input 
              type="text" 
              placeholder="Search leads..." 
              className="bg-slate-900 border-2 border-emerald-500/30 rounded-full py-2 pl-10 pr-4 w-64 focus:outline-none focus:border-emerald-500 text-white placeholder:text-slate-500 transition-all backdrop-blur-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Scanned Leads List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Scanned Leads ({filteredLeads.length})
            </h2>
            
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {filteredLeads.map(({ job, audit }) => (
                <div 
                  key={job.id} 
                  className={`p-6 rounded-2xl border-2 transition-all duration-300 backdrop-blur-xl shadow-lg ${
                    audit.status === 'APPROVED' 
                      ? 'bg-slate-900/80 border-emerald-500/20 hover:border-emerald-500' 
                      : 'bg-red-950/20 border-red-900/40 hover:border-red-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-xl text-white tracking-tight">{job.title || 'Unknown Role'}</h3>
                      <p className="text-emerald-400/80 text-xs font-bold mt-1 uppercase tracking-wider">{job.company || 'Unknown Company'} • {getJobLocationString(job.location)}</p>
                    </div>
                    
                    {audit.status === 'APPROVED' ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-widest">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Flagged
                      </span>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-[10px] text-slate-400 font-bold flex items-center gap-2 uppercase tracking-widest">
                      <span className="text-emerald-500/60">Ref:</span> {audit.citation}
                    </div>
                    
                    {audit.status === 'APPROVED' && (
                      <button 
                        onClick={() => handleSummonAgent(job)}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Summon Agent
                      </button>
                    )}
                  </div>
                  
                  {audit.status === 'REJECTED' && (
                    <div className="mt-4 p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-[10px] text-red-400 font-bold leading-relaxed uppercase tracking-wider">
                      <strong className="text-white">REJECTION REASON:</strong> {audit.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* AI Output / Agent Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Agent Output
              </h2>
              
              <div className="bg-slate-900 border-2 border-emerald-500/20 rounded-[2rem] p-8 min-h-[500px] backdrop-blur-2xl relative overflow-hidden group shadow-2xl">
                {/* Neon glow effect */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full group-hover:bg-emerald-500/10 transition-colors" />
                
                {isGenerating ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-500">
                    <Loader2 className="w-10 h-10 animate-spin mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Consulting Ethical Knowledge Base...</p>
                  </div>
                ) : pitch ? (
                  <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                        <ShieldCheck className="w-6 h-6 text-slate-950" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Kaseddie Hunter</p>
                        <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Pitch Generated Successfully</p>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] text-emerald-500/60 font-black uppercase tracking-widest">Subject</label>
                        <p className="text-sm font-black text-white mt-1 tracking-tight">{pitch.subject}</p>
                      </div>
                      
                      <div>
                        <label className="text-[10px] text-emerald-500/60 font-black uppercase tracking-widest">Body</label>
                        <div className="mt-2 text-xs text-slate-200 font-medium leading-relaxed bg-slate-950 border border-emerald-500/20 p-6 rounded-2xl max-h-[350px] overflow-y-auto custom-scrollbar whitespace-pre-wrap shadow-inner">
                          {pitch.body}
                        </div>
                      </div>

                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`Subject: ${pitch.subject}\n\n${pitch.body}`);
                        }}
                        className="w-full py-4 bg-emerald-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                      >
                        Copy Pitch to Clipboard
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6 shadow-inner">
                      <Zap className="w-10 h-10 text-emerald-500/20" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 max-w-[200px] leading-loose">Select a verified lead and 'Summon Agent' to generate a B2B pitch.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;

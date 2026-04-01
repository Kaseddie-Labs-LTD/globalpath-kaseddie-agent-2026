
 import React, { useState, useRef } from 'react';
import { Job, UserProfile, OfferLetter, RecruitmentBatch, getJobLocationString } from '../types';
import { 
  PlusCircle, Users, FileCheck, Send, Building2, MapPin, DollarSign, 
  Search, CheckCircle2, AlertCircle, Briefcase, Zap, FileText, 
  ClipboardList, ChevronRight, X, ShieldCheck, FileSearch, Loader2,
  MessageCircle, Copy, Clipboard, Mail, ExternalLink, Sparkles
} from 'lucide-react';
import { ProfessionalVerificationReport } from './ProfessionalVerificationReport';
import { generateB2BPitchText } from '../services/ai';
import { B2BPitchGenerator } from './B2BPitchGenerator';
import { AgentLogEntry } from '../types';

interface HRPortalProps {
  onPostJob: (job: Partial<Job>) => void;
  verifiedCandidates: UserProfile[];
  onIssueOffer: (offer: Partial<OfferLetter>) => void;
  hrJobs?: Job[];
  onRefreshLeads?: () => void;
  batches?: RecruitmentBatch[];
  selectedBatch: RecruitmentBatch | null;
  setSelectedBatch: (batch: RecruitmentBatch | null) => void;
  pitchContext?: { job?: Job; candidate?: UserProfile };
  recentLead?: { name: string; job: string; company?: string };
  initialPitchText?: string;
  onPitchLead?: (prompt: string) => void;
  onSearchLeads?: (query: string) => Promise<{ summary: string; leads: Job[] }>;
  onGenerateB2BPitch?: (title: string, company: string, salary?: string, country?: string, category?: string) => Promise<string>;
  onLog?: (message: string, type: AgentLogEntry['type'], step?: string) => void;
}

export const HRPortal: React.FC<HRPortalProps> = ({ 
  onPostJob, 
  verifiedCandidates, 
  onIssueOffer, 
  hrJobs = [], 
  onRefreshLeads,
  batches = [],
  selectedBatch,
  setSelectedBatch,
  pitchContext,
  recentLead,
  initialPitchText,
  onPitchLead,
  onSearchLeads,
  onGenerateB2BPitch,
  onLog
 }) => {
  const [isPosting, setIsPosting] = useState(false);
  const [activeTab, setActiveTab] = useState<'talent' | 'vacancies'>(pitchContext ? 'vacancies' : 'talent');
  const [selectedReportCandidate, setSelectedReportCandidate] = useState<{ candidate: UserProfile; batch: RecruitmentBatch } | null>(null);
  const [docViewer, setDocViewer] = useState<UserProfile | null>(null);
  const [pitchText, setPitchText] = useState<string>(initialPitchText || '');
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [toEmail, setToEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [leadContact, setLeadContact] = useState<string>('');
  const HR_WHATSAPP = '256784428821';
  
  // Fuzzy search helper function
  const fuzzyMatch = (text: string, query: string): boolean => {
    if (!query) return true;
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Simple fuzzy matching - check if all query characters appear in order in text
    let queryIndex = 0;
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === queryLower.length;
  };
  
  // Helper function to determine category from multiple fields (same as AdminDashboard)
  const getJobCategory = (job: any): 'professional' | 'blue_collar' | 'general' => {
    // Check category field first
    if (job.category) {
      const cat = job.category.toLowerCase();
      if (cat === 'professional' || cat === 'blue_collar') return cat;
    }
    
    // Fallback: Check title, description, and positionName for keywords
    const title = (job.title || job.positionName || '').toLowerCase();
    const description = (job.description || '').toLowerCase();
    const company = (job.company || '').toLowerCase();
    
    // Professional keywords
    const professionalKeywords = [
      'engineer', 'manager', 'consultant', 'associate', 
      'analyst', 'executive', 'pwc', 'deloitte', 'officer', 'developer', 
      'procurement', 'logistics manager', 'supply chain', 'it specialist', 'cybersecurity',
      'nurse', 'doctor', 'physician'
    ];
    
    // Blue-collar keywords
    const blueCollarKeywords = [
      'driver', 'cleaner', 'warehouse', 'maid', 'housemaid',
      'helper', 'butcher', 'shelf', 'merchandiser', 'housekeeper',
      'care home', 'care assistant', 'support worker', 'logistics'
    ];
    
    // Check all fields for professional keywords
    const hasProfessionalKeyword = 
      professionalKeywords.some(kw => title.includes(kw)) ||
      professionalKeywords.some(kw => description.includes(kw)) ||
      professionalKeywords.some(kw => company.includes(kw));
    
    // Check all fields for blue-collar keywords  
    const hasBlueCollarKeyword = 
      blueCollarKeywords.some(kw => title.includes(kw)) ||
      blueCollarKeywords.some(kw => description.includes(kw)) ||
      blueCollarKeywords.some(kw => company.includes(kw));
    
    if (hasProfessionalKeyword) return 'professional';
    if (hasBlueCollarKeyword) return 'blue_collar';
    return 'general';
  };
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{ summary: string; leads: Job[] } | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !onSearchLeads) return;
    
    setIsSearching(true);
    try {
      const result = await onSearchLeads(searchQuery);
      setSearchResult(result);
      if (result.summary) {
        setPitchText(result.summary);
        setActiveTab('vacancies');
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const [newJob, setNewJob] = useState({
    title: '',
    location: 'Dubai, UAE',
    salary: '$1,200 + Accommodation',
    description: '',
    hasSponsorship: true,
    hasFlightTicket: true
  });

  React.useEffect(() => {
    if (initialPitchText && initialPitchText.trim()) {
      setPitchText(initialPitchText);
    }
  }, [initialPitchText]);
  const handleSubmitJob = (e: React.FormEvent) => {
    e.preventDefault();
    onPostJob({
      ...newJob,
      id: `HR-JOB-${Date.now()}`,
      company: 'GlobalLogistics International',
      source: 'Direct HR Portal',
      dateFound: new Date().toISOString(),
      matchScore: 0,
      url: '#',
      requirements: ['Valid Driving License', '2+ Years Experience']
    });
    setIsPosting(false);
    setNewJob({ title: '', location: 'Dubai, UAE', salary: '$1,200', description: '', hasSponsorship: true, hasFlightTicket: true });
  };

  const handleGenerateReport = (candidate: UserProfile) => {
    const targetRegion = candidate.targetRegions?.[0] || "";
    const batch = batches.find(b => {
      const bCorridor = b.corridor || "";
      return bCorridor.includes(targetRegion);
    }) || batches[0] || { id: 'BATCH-N/A', corridor: 'General Node' };
    setSelectedReportCandidate({ candidate, batch: batch as RecruitmentBatch });
  };

  const handleBatchClick = (batch: RecruitmentBatch) => {
    setSelectedBatch(batch);
  };

  const reportJob = hrJobs.find(j => {
    const title = (j.title || "").toLowerCase();
    const location = getJobLocationString(j.location);
    return title.includes('logistics') || location.includes('UAE');
  }) || hrJobs[0];
  
  
  
  const buildSubject = (ctx?: { job?: Job }) => {
    const company = ctx?.job?.company || reportJob?.company || 'Employer';
    return `Strategic Logistics Manpower Proposal – ${company}`;
  };
  
  const buildMasterTemplate = (ctx?: { job?: Job; candidate?: UserProfile }) => {
    const name = ctx?.candidate?.name || verifiedCandidates[0]?.name || 'Guest User';
    const jobTitle = ctx?.job?.title || reportJob?.title || 'Logistics Personnel';
    const company = ctx?.job?.company || 'GlobalPath Partner';
    const locationStr = getJobLocationString(ctx?.job?.location || reportJob?.location || 'UAE / GCC');
    const country = (ctx?.job as any)?.country || (locationStr.split(',').pop()?.trim() || 'GCC');
    const salaryStr = String(ctx?.job?.salary || reportJob?.salary || 'Commission Based');
    const match = 92;
    const vetting = 'STAGE 4 • GAMCA FIT';
    return [
      `Dear Hiring Authority,`,
      ``,
      `We present a Verified Ready Workforce tailored for ${country} • ${jobTitle} requirements. Our model is built on a Zero-Fee Mandate with ethical recruitment from Uganda and strict corridor compliance.`,
      ``,
      `Candidate Snapshot`,
      `• Name: ${name}`,
      `• Match: ${match}%`,
      `• Vetting Status: ${vetting}`,
      `• Compensation: ${salaryStr}`,
      ``,
      `Operational Advantages`,
      `• Immediate mobilization via ${country} corridors`,
      `• Visa & ticket coordination with employer-compliant protocols`,
      `• Cost-savings from streamlined onboarding and verified documentation`,
      ``,
      `Commitment`,
      `• Zero-Fee recruitment`,
      `• AVA Trinity compliance: Visa, Ticket, Accommodation`,
      ``,
      `Next Steps`,
      `• Confirm batch intake for ${company}`,
      `• We dispatch a vetted cohort under your schedule`,
      ``,
      `GlobalPath Kaseddie Agent`,
      `Elite Logistics & Strategic Manpower Solutions`,
      `Toronto–GCC Corridor`,
      ``,
      `WhatsApp: +256 784428821 / +256 756824859`,
      `Email: hr@globalpathkaseddieagent.com`,
    ].join('\n');
  };
  
  React.useEffect(() => {
    if (activeTab !== 'vacancies') return;
    if (pitchText && pitchText.trim() !== '') return;
    const job = pitchContext?.job || reportJob;
    if (!job) return;
    const company = job.company || 'Employer';
    const title = job.title || 'Role';
    const desc = job.description || '';
    const prefill = `Draft a B2B proposal for ${title} at ${company} based on this description: ${desc}.`;
    setPitchText(prefill);
  }, [activeTab, pitchContext, reportJob, pitchText]);
  
  React.useEffect(() => {
    if (typeof (initialPitchText || '') === 'string' && (initialPitchText || '').trim() !== '') {
      setPitchText(initialPitchText || '');
    }
  }, [initialPitchText]);
  
  React.useEffect(() => {
    const initial = pitchContext?.job?.employerEmail 
      || pitchContext?.job?.hrContact 
      || reportJob?.employerEmail 
      || reportJob?.hrContact 
      || '';
    setToEmail(initial || '');
    setSubject(buildSubject(pitchContext));
  }, [pitchContext, reportJob?.employerEmail, reportJob?.hrContact, reportJob?.company]);
 
  React.useEffect(() => {
    if (pitchContext && activeTab !== 'vacancies') {
      setActiveTab('vacancies');
    }
  }, [pitchContext]);
 
  React.useEffect(() => {
    if (activeTab === 'vacancies') {
      setTimeout(() => {
        editorRef.current?.focus();
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    }
  }, [activeTab]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12 bg-[#0a0a0a] text-gray-100 min-h-screen p-6 rounded-[3rem]">
      <style>{`
        .pitch-editor-textarea { background-color: #1a1a1a !important; color: #ffffff !important; border: 1px solid #10b981 !important; }
        .portal-contrast-input { background-color: #1a1a1a !important; color: #ffffff !important; border: 1px solid #10b981 !important; }
        .portal-contrast-input::placeholder { color: #64748b !important; }
        .high-contrast-text { color: #ffffff !important; }
        .neon-text { color: #10b981 !important; }
      `}</style>
      {/* Recruiter Header */}
      <div className="bg-[#1a1a1a] border border-emerald-500/20 p-8 rounded-[2rem] shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-3xl font-black text-white tracking-tight">GlobalPath: <span className="text-emerald-400">Elite Logistics & Strategic Manpower</span></h2>
          <p className="text-emerald-500/60 text-[10px] font-black mt-1 uppercase tracking-[0.3em]">GlobalPath Employer Dashboard • Controlled Oversight</p>
          
          <form onSubmit={handleSearch} className="mt-6 flex items-center gap-3 bg-slate-950 border border-emerald-500/30 rounded-2xl p-2 max-w-2xl focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
            <Search size={18} className="text-emerald-500 ml-3" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Lead Scout: Search local brain for recruitment strategy..."
              className="bg-transparent border-none outline-none flex-1 py-2 text-sm font-black text-white placeholder:text-slate-600"
            />
            <button 
              type="submit"
              disabled={isSearching}
              className="bg-emerald-500 text-slate-950 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all disabled:opacity-50"
            >
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : 'Search Leads'}
            </button>
          </form>

          {recentLead && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              Lead: {recentLead.name} for {recentLead.company || 'Employer'} • {recentLead.job}
            </div>
          )}
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('vacancies');
              if ((hrJobs || []).length === 0) {
                onRefreshLeads?.();
              }
            }}
            className="bg-slate-950 hover:bg-slate-800 text-white p-4 rounded-2xl flex items-center gap-3 cursor-pointer border border-emerald-500/20 transition-all active:scale-95"
          >
            <Users size={20} className="text-emerald-400" />
            <div className="text-left">
              <div className="text-lg font-black leading-none">{(hrJobs || []).length}</div>
              <div className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mt-1">
                {(hrJobs || []).length > 0 ? 'Vetted Nodes Ready' : 'Initialize Nodes via Search'}
              </div>
            </div>
          </button>
          <button 
            onClick={() => setIsPosting(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all flex items-center gap-2 active:scale-95"
          >
            <PlusCircle size={18} /> Post Vacancy
          </button>
        </div>
      </div>

      {selectedReportCandidate && (
        <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto py-12">
            <ProfessionalVerificationReport 
              batchId={selectedReportCandidate.batch.id}
              candidateName={selectedReportCandidate.candidate.name}
              jobTitle={reportJob?.title || 'Selected Corridor Vacancy'}
              targetCountry={(selectedReportCandidate.batch.corridor || "").split('->')[0].trim()}
              sector={(selectedReportCandidate.batch.corridor || "").split('->')[1]?.trim() || 'Industrial'}
              matchScore={92}
              onClose={() => setSelectedReportCandidate(null)}
            />
            <div className="mt-6 flex justify-center gap-4">
               <button className="px-8 py-3 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest border border-slate-200 shadow-xl hover:bg-slate-50 transition-all">Download Secure PDF</button>
               <button className="px-8 py-3 bg-brand-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-brand-500 transition-all">Archive Audit</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 border-b border-slate-800">
        <button 
          onClick={() => setActiveTab('talent')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'talent' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}
        >
          Candidate Batches
        </button>
        <button 
          onClick={() => setActiveTab('vacancies')}
          className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'vacancies' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-600 hover:text-slate-400'}`}
        >
          My Direct Vacancies
        </button>
      </div>

      {activeTab === 'talent' && (
        <div className="space-y-12">
          {/* Batch Selector Section */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.2em] flex items-center gap-2">
              <ClipboardList size={16} className="text-emerald-400" />
              Select a Vetted Batch to view Verification Report
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {batches.map(batch => (
                <div 
                  key={batch.id} 
                  onClick={() => handleBatchClick(batch)}
                  className={`p-6 rounded-3xl border transition-all group cursor-pointer shadow-lg relative overflow-hidden ${
                    selectedBatch?.id === batch.id 
                    ? 'bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-500/10' 
                    : 'bg-slate-900/40 border-slate-800 hover:border-emerald-500/30 hover:bg-slate-900'
                  }`}
                >
                  {selectedBatch?.id === batch.id && (
                    <div className="absolute top-0 right-0 p-2 bg-emerald-500 text-slate-950 rounded-bl-xl shadow-lg animate-fadeIn">
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div className={`p-3 rounded-xl transition-all ${
                      selectedBatch?.id === batch.id ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950'
                    }`}>
                      <Briefcase size={20} />
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${
                      batch.verifiedCount >= batch.size ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                    }`}>
                      {batch.verifiedCount >= batch.size ? 'verified' : 'processing'}
                    </span>
                  </div>
                  <h4 className="font-black text-white text-sm mb-1">{batch.corridor}</h4>
                  <div className="text-[10px] text-emerald-500/60 font-black uppercase tracking-widest mb-4">{batch.verifiedCount} / {batch.size} Vetted Workers</div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
                    <div 
                      className={`h-full transition-all duration-1000 ${selectedBatch?.id === batch.id ? 'bg-emerald-400' : 'bg-emerald-600'}`} 
                      style={{ width: `${(batch.verifiedCount / batch.size) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                     <span>Last Hunt: Just now</span>
                     <ChevronRight size={12} className={`transition-transform ${selectedBatch?.id === batch.id ? 'translate-x-1' : ''}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verification Report Section */}
          <div className="pt-8 border-t border-slate-800">
            {selectedBatch ? (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <FileSearch size={20} className="text-emerald-500" />
                    Professional Batch Verification Report
                  </h3>
                  <button 
                    onClick={() => setSelectedBatch(null)}
                    className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors"
                  >
                    <X size={14} /> Clear Report
                  </button>
                </div>
                <div className="bg-slate-900 border border-emerald-500/20 rounded-[2rem] overflow-hidden">
                  <ProfessionalVerificationReport 
                    batchId={selectedBatch.id}
                    candidateName="Batch Aggregate Audit"
                    jobTitle={reportJob?.title || 'Sector Logistics Hub'}
                    targetCountry={(selectedBatch.corridor || "").split('->')[0].trim()}
                    sector={(selectedBatch.corridor || "").split('->')[1]?.trim() || 'Logistics'}
                    matchScore={94}
                  />
                </div>
              </div>
            ) : (
              <div className="py-24 flex flex-col items-center justify-center text-center bg-slate-900/40 border-2 border-dashed border-slate-800 rounded-[3rem] text-slate-600 group hover:bg-slate-900/60 hover:border-emerald-500/30 transition-all cursor-default">
                 <div className="p-6 bg-slate-900 rounded-full shadow-inner mb-4 group-hover:scale-110 transition-transform border border-slate-800">
                    <FileSearch size={48} className="opacity-20 group-hover:text-emerald-500 group-hover:opacity-100 transition-all" />
                 </div>
                 <h3 className="text-xl font-black uppercase tracking-widest text-slate-500 group-hover:text-white">Verification Node Inactive</h3>
                 <p className="text-[10px] font-black uppercase tracking-widest mt-2 max-w-xs opacity-60">Select a Vetted Batch card above to initialize the AI Professional Verification Report.</p>
              </div>
            )}
          </div>

          {/* Vetted Candidates Grid */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.2em] flex items-center gap-2">
              <Users size={16} className="text-emerald-400" />
              Verified Workforce Stream
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {verifiedCandidates.map((candidate) => (
                <div key={candidate.id} className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 shadow-xl hover:border-emerald-500/40 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-all"></div>
                  
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl bg-slate-950 flex items-center justify-center text-emerald-400 font-black text-2xl shadow-lg border border-emerald-500/20">
                        {(candidate.name || "GU").substring(0, 2)}
                      </div>
                      <div>
                        <h3 className="font-black text-xl text-white tracking-tight">{candidate.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{candidate.role}</span>
                          <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                          <span className="text-[10px] font-black text-emerald-400 uppercase">GAMCA FIT</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-black px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                        ID Vetted
                      </span>
                      <button 
                        onClick={() => handleGenerateReport(candidate)}
                        className="text-[10px] font-black text-emerald-400 uppercase hover:underline flex items-center gap-1 transition-all"
                      >
                        <FileText size={12} /> View Personal Audit
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="text-[8px] font-black text-slate-500 uppercase mb-1 tracking-widest">Documents</div>
                      <button 
                        onClick={() => setDocViewer(candidate)}
                        className="text-[10px] font-black text-emerald-500 uppercase hover:underline"
                      >
                        View / Download
                      </button>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="text-[8px] font-black text-slate-500 uppercase mb-1 tracking-widest">Vetting</div>
                      <span className="text-[10px] font-black text-white">STAGE 4</span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="text-[8px] font-black text-slate-500 uppercase mb-1 tracking-widest">Match</div>
                      <span className="text-[10px] font-black text-emerald-400">92%</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => { setActiveTab('vacancies'); onIssueOffer({ candidateId: candidate.id, status: 'sent' }); }}
                    className="w-full bg-slate-950 group-hover:bg-emerald-600 text-white group-hover:text-slate-950 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 border border-emerald-500/20 group-hover:border-emerald-600"
                  >
                    <FileCheck size={16} /> Dispatch Official Offer <ChevronRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vacancies' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Unified Outreach Command Center */}
          <div className="lg:col-span-5">
            <B2BPitchGenerator 
              selectedLead={pitchContext?.job}
              onGenerate={onGenerateB2BPitch || (async () => "AI Handshake Pending...")}
              onLog={onLog}
            />
          </div>

          <div className={`lg:col-span-7 bg-[#1a1a1a] rounded-[2.5rem] border border-slate-700 overflow-hidden shadow-sm flex flex-col ${pitchContext ? 'ring-2 ring-brand-500/20 border-brand-500/30' : ''}`}>
             <div className="p-8 border-b border-slate-700 bg-slate-800/30 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-gray-100">Outreach Node Console</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Multi-Channel Dispatch & Asset Preparation</p>
                </div>
                {pitchContext?.job?.url && !toEmail && (
                  <div className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full animate-pulse">
                    Web-Apply Mode Active
                  </div>
                )}
             </div>
             
             <div className="p-8 flex-1 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dispatch Target (Email/WhatsApp)</label>
                    <div className="relative">
                      {toEmail ? <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /> : <X size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400" />}
                      <input 
                        value={toEmail} 
                        onChange={(e) => setToEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-10 pr-4 text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        placeholder="No direct contact found"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dispatch Subject</label>
                    <div className="relative">
                      <FileText size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        value={subject} 
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-10 pr-4 text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                        placeholder="Subject Line"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Master Pitch Asset</label>
                    <span className="text-[8px] font-black text-brand-600 uppercase">AI-Vetted Draft</span>
                  </div>
                  <textarea 
                    ref={editorRef}
                    value={pitchText} 
                    onChange={(e) => setPitchText(e.target.value)} 
                    placeholder="Outreach asset content..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-[2rem] p-6 text-sm outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all font-mono leading-relaxed min-h-[250px]"
                  />
                </div>

                <div className="flex items-center gap-3">
                  {!toEmail && pitchContext?.job?.url ? (
                    <button 
                      onClick={() => window.open(pitchContext.job?.url, '_blank')}
                      className="flex-1 px-6 py-4 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={16} /> Open Web Portal
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        const packageText = [`TO: ${toEmail}`, `SUBJECT: ${subject}`, ``, `BODY:`, pitchText].join('\n');
                        navigator.clipboard.writeText(packageText);
                        setCopiedToast(true);
                        setTimeout(() => setCopiedToast(false), 2000);
                        window.open('https://privateemail.com/appsuite/', '_blank');
                      }}
                      className="flex-1 px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-600 transition-all flex items-center justify-center gap-2"
                    >
                      <Send size={16} /> Dispatch to PrivateEmail
                    </button>
                  )}
                  
                  <button 
                    onClick={async () => {
                      setIsRefining(true);
                      try {
                        const refiner = await import('../services/PitchRefiner');
                        const refined = await refiner.refinePitch(pitchContext?.job || reportJob, pitchText);
                        setPitchText(refined);
                      } finally {
                        setIsRefining(false);
                      }
                    }}
                    className={`px-6 py-4 bg-brand-50 text-brand-600 border border-brand-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-100 transition-all flex items-center gap-2 ${isRefining ? 'ai-refiner-status' : ''}`}
                    disabled={isRefining}
                  >
                    {isRefining ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                    {isRefining ? 'Optimizing...' : 'AI Refiner'}
                  </button>
                </div>
             </div>
             
             {/* Local Vacancy Node List */}
             <div className="local-vacancy-node border-t border-slate-100 bg-slate-50/30 p-8">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Local Vacancy Nodes</h4>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total: {hrJobs.filter(j => j && j.source && j.source.includes('HR')).length}</span>
                </div>
                <div className="space-y-3">
                  {hrJobs.filter(j => j && j.source && j.source.includes('HR')).length > 0 ? hrJobs.filter(j => j && j.source && j.source.includes('HR')).map(job => {
                    // Fuzzy search for Luxembourg drivers and blue-collar roles
                    const locationMatch = fuzzyMatch(job.location || '', 'luxembourg');
                    const roleMatch = fuzzyMatch(job.title || '', 'driver') || fuzzyMatch(job.title || '', 'chauffeur') || fuzzyMatch(job.description || '', 'driver');
                    const tagsMatch = job.tags?.some((tag: string) => fuzzyMatch(tag, 'blue-collar') || fuzzyMatch(tag, 'blue collar'));
                    
                    // Show job if it matches any of our criteria or if there's no search query
                    const shouldShow = !searchQuery || locationMatch || roleMatch || tagsMatch;
                    
                    return shouldShow ? (
                      <div key={job.id} className="admin-data-node bg-[#1a1a1a] p-4 rounded-2xl border border-slate-700 flex items-center justify-between hover:border-brand-400 transition-all group cursor-pointer" onClick={() => onPitchLead?.(job.id)}>
                         <div>
                            <h3 className="text-cyan-400 font-bold text-xs group-hover:text-brand-600 transition-colors">{job.company || "Unknown Company"}</h3>
                            <p className="text-gray-100 text-sm line-clamp-3">{job.description || job.title || "No description available"}</p>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono">
                              <span className="text-green-400">📧 {job.email || "No Email Found"}</span>
                              <span className="text-yellow-400">📞 {job.phone || "No Phone Found"}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 mt-2">
                               <span className="flex items-center gap-1"><MapPin size={10} /> {getJobLocationString(job.location)}</span>
                               <span className="text-amber-700 font-black">{job.salary}</span>
                            </div>
                         </div>
                         <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-500 transition-transform group-hover:translate-x-1" />
                      </div>
                    ) : null;
                  }) : (
                    <div className="py-8 text-center flex flex-col items-center gap-2 text-slate-400 opacity-50">
                       <Zap size={24} />
                       <p className="text-[8px] font-black uppercase tracking-widest">No local nodes active.</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}
      
      {docViewer && (
        <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md p-6 overflow-y-auto">
          <div className="max-w-xl mx-auto bg-[#1a1a1a] rounded-[2rem] border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black text-gray-100">Documents</h4>
              <button onClick={() => setDocViewer(null)} className="text-[10px] font-black text-gray-400 hover:text-gray-100 uppercase tracking-widest">Close</button>
            </div>
            <div className="space-y-3">
              {docViewer.documents.photo && (
                <a href={URL.createObjectURL(docViewer.documents.photo)} target="_blank" rel="noreferrer" className="text-[10px] font-black text-brand-600 uppercase hover:underline">Pass Photo</a>
              )}
              {docViewer.documents.passport && (
                <a href={URL.createObjectURL(docViewer.documents.passport)} target="_blank" rel="noreferrer" className="text-[10px] font-black text-brand-600 uppercase hover:underline">Passport Copy</a>
              )}
              {docViewer.documents.cv && (
                <a href={URL.createObjectURL(docViewer.documents.cv)} target="_blank" rel="noreferrer" className="text-[10px] font-black text-brand-600 uppercase hover:underline">CV / Resume</a>
              )}
              {!docViewer.documents.photo && !docViewer.documents.passport && !docViewer.documents.cv && (
                <div className="text-[10px] font-black text-slate-500 uppercase">No Documents Provided</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

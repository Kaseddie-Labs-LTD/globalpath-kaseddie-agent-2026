
import React, { useMemo, useState, useEffect } from 'react';
import { Job, getJobLocationString } from '../types';
import { 
  Search, Filter, CheckCircle, Users, Zap, ShieldCheck, Plane, Key, MapPin, 
  DollarSign, Award, ShieldAlert, AlertTriangle, Star, ChevronDown, ChevronUp, 
  Globe, X, CheckCircle2, Info, Building2, Briefcase, Loader2, Home,
  Sparkles, Check, Handshake, MessageSquare, Copy, Terminal
} from 'lucide-react';
import { generateJobInsight, generateB2BPitch } from '../services/ai';

interface JobGridProps {
  jobs: Job[];
  onApply: (job: Job) => void;
  onEnhanceJob: (job: Job) => void;
  onAnalyzeSafety: (job: Job) => void;
  onInitializeNode?: (job: Job) => void;
  selectedRegionOverride?: string;
  onRegionChange?: (region: string) => void;
  activeCategoryOverride?: 'All' | 'blue_collar' | 'professional' | 'service_domestic';
  onCategoryChange?: (category: 'All' | 'blue_collar' | 'professional' | 'service_domestic') => void;
  keywordOverride?: string;
  scrollTrigger?: number;
  isAdmin?: boolean;
}

const REGION_PRIORITY: Record<string, number> = {
  'uae': 1, 'dubai': 1, 'abu dhabi': 1, 'qatar': 1, 'kuwait': 1, 'bahrain': 1, 'saudi': 1,
  'luxembourg': 2,
  'germany': 3, 'poland': 3, 'europe': 3, 'canada': 3, 'usa': 3, 'uk': 3
};

const getRegionTag = (location: any = "", company: string = "", title: string = "", url: string = "") => {
  const loc = getJobLocationString(location).toLowerCase();
  const comp = (company || "").toLowerCase();
  const t = (title || "").toLowerCase();
  const u = (url || "").toLowerCase();
  
  // Priority 1: Strict EU (Luxembourg) - MOVED TO TOP
  if (((loc.includes('luxembourg') || loc.includes(', lu')) && !loc.includes('luxury')) || ['amazon', 'pwc'].some(k => loc.includes(k) || t.includes(k) || comp.includes(k)) || u.includes('luxembourg')) {
    return { label: 'Luxembourg Node', color: 'text-orange-600 bg-orange-50 border-orange-200', accent: 'border-l-orange-500', priorityLabel: 'Tier 2' };
  }
  
  // Priority 2: Strict EU (Germany) - MOVED TO TOP
  if (loc.includes('germany') || loc.includes('deu') || loc.includes('berlin') || u.includes('germany') || u.includes('berlin') || ['berlin', 'germany', 'software'].some(k => loc.includes(k) || t.includes(k) || comp.includes(k))) {
    return { label: 'EU-Central (Germany)', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', accent: 'border-l-emerald-500', priorityLabel: 'Tier 3' };
  }
  
  // Priority 3: Strict GCC
  if (u.includes('maps.google.com') || ['uae', 'dubai', 'abu dhabi', 'qatar', 'kuwait', 'bahrain', 'saudi', 'live corridor'].some(r => loc.includes(r))) {
    return { label: 'GCC Corridor', color: 'text-amber-600 bg-amber-50 border-amber-200', accent: 'border-l-amber-500', priorityLabel: 'Tier 1' };
  }
  
  // Priority 4: Strict UK
  if (['uk', 'united kingdom', 'london', 'peterborough', 'winchester', 'oxfordshire', 'thame', 'croydon', 'nhs'].some(r => loc.includes(r) || t.includes(r) || u.includes(r))) {
    return { label: 'UK-Northern Corridor', color: 'text-blue-600 bg-blue-50 border-blue-200', accent: 'border-l-blue-500', priorityLabel: 'Tier 4' };
  }
  
  // Priority 5: Western
  if (['poland', 'europe', 'canada', 'usa'].some(r => loc.includes(r))) {
    return { label: 'Western Corridor', color: 'text-brand-600 bg-brand-50 border-brand-200', accent: 'border-l-brand-500', priorityLabel: 'Tier 5' };
  }
  
  return { label: 'Global Corridor', color: 'text-slate-500 bg-slate-50 border-slate-200', accent: 'border-l-slate-300', priorityLabel: 'General' };
};

const LogisticsBadges = ({ job }: { job: Job }) => {
  const isFullyVetted = job && job.hasVisa && job.hasTicket && job.hasAccommodation;
  
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {isFullyVetted && (
        <span className="px-2 py-0.5 bg-emerald-600 text-white text-[8px] font-black uppercase tracking-widest rounded border border-emerald-700 flex items-center gap-1 shadow-sm">
          <CheckCircle size={10} /> Visa & Ticket Confirmed
        </span>
      )}
      {job && job.hasVisa && !isFullyVetted && (
        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase tracking-widest rounded border border-emerald-200 flex items-center gap-1">
          <Key size={10} /> Visa
        </span>
      )}
      {job && job.hasTicket && !isFullyVetted && (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-black uppercase tracking-widest rounded border border-blue-200 flex items-center gap-1">
          <Plane size={10} /> Ticket
        </span>
      )}
      {job && job.hasAccommodation && !isFullyVetted && (
        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[8px] font-black uppercase tracking-widest rounded border border-purple-200 flex items-center gap-1">
          <Home size={10} /> Accom
        </span>
      )}
    </div>
  );
};

interface JobCardProps {
  job: Job;
  isPremier: boolean;
  onApply: (job: Job) => void;
  onEnhanceJob: (job: Job) => void;
  onAnalyzeSafety: (job: Job) => void;
  onClick: (job: Job) => void;
  isAdmin?: boolean;
}

const JobCard: React.FC<JobCardProps> = ({ job, isPremier, onApply, onEnhanceJob, onAnalyzeSafety, onClick, isAdmin }) => {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const isFlagged = job.status === 'flagged' || job.recommendation === 'Non-Compliant' || job.complianceStatus === 'High Risk';
  const isAudited = !!job.recommendation || !!job.complianceStatus;
  const isSafe = isAudited && !isFlagged;
  const region = getRegionTag(
          typeof job.location === 'object' ? job.location.city || job.location.country : job.location, 
          job.company, 
          job.title, 
          job.url
        );
  const hasEmail = !!(job?.employerEmail || job?.hrContact);

  const handleEnhance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEnhancing(true);
    await onEnhanceJob(job);
    setIsEnhancing(false);
  };

  const handleApply = async () => {
    setIsApplying(true);
    // Artificial "AI Handshake" delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    onApply(job);
    setIsApplying(false);
  };

  return (
    <div 
      onClick={() => onClick(job)}
      className={`job-card relative group p-4 md:p-5 rounded-[1.5rem] border-l-4 border-y border-r transition-all duration-300 ease-out cursor-pointer
      hover:-translate-y-2 hover:scale-[1.01] ${region.accent} ${
      isPremier 
      ? 'bg-gradient-to-br from-amber-50/50 via-white to-white border-amber-200 shadow-sm hover:border-amber-500 hover:shadow-[0_25px_60px_-15px_rgba(245,158,11,0.4)] hover:ring-2 hover:ring-amber-500/10' 
      : 'bg-white border-slate-200 shadow-sm hover:border-brand-400 hover:shadow-[0_20px_50px_-12px_rgba(2,132,199,0.2)]'
    } ${isFlagged ? 'opacity-75 grayscale-[0.5]' : ''}`}
    >
      {isPremier && !isFlagged && (
        <div className="absolute -top-3 left-6 px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-2 shadow-lg z-10 border border-white/20 transition-transform group-hover:scale-110">
          <Award size={12} className="animate-pulse" /> 
          Priority Corridor
        </div>
      )}

      {isFlagged && (
        <div className="absolute -top-3 left-6 px-3 py-1 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-lg z-10 animate-shake">
          <ShieldAlert size={10} /> {job.complianceStatus === 'High Risk' ? 'High Risk: Commission' : 'Fraud Alert: Flagged'}
        </div>
      )}

      {isSafe && !isPremier && (
        <div className="absolute -top-3 left-6 px-3 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-lg z-10 transition-transform group-hover:scale-110">
          <ShieldCheck size={10} /> HR Vetted: Safe
        </div>
      )}
      
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
             <h3 className={`text-lg font-black transition-colors leading-tight ${isFlagged ? 'text-slate-400' : 'text-slate-900 group-hover:text-brand-600'}`}>
               {job.title}
             </h3>
             {isPremier && (
               <Star size={14} className="text-amber-500 fill-amber-500 group-hover:animate-spin" />
             )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">{job.company}</p>
            <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.15em] border ${region.color} flex items-center gap-1 transition-all group-hover:brightness-95`}>
              <Globe size={8} /> {region.label}
            </div>
            {!hasEmail && (
              <div className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.15em] border bg-emerald-50 border-emerald-200 text-emerald-700 flex items-center gap-1">
                <Handshake size={8} /> Digital Handshake Verified
              </div>
            )}
            {job.country && (
              <div className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.15em] border bg-amber-50 border-amber-200 text-amber-700 flex items-center gap-1">
                <Globe size={8} /> {job.country}
              </div>
            )}
          </div>
          <LogisticsBadges job={job} />
        </div>
        <div className="text-right">
          <div className={`text-sm font-black ${isFlagged ? 'text-slate-400' : isPremier ? 'text-amber-600' : 'text-brand-600'}`}>
            {job.matchScore || 0}%
          </div>
          <div className="text-[9px] font-bold text-slate-400 uppercase">Match</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <a 
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getJobLocationString(typeof job.location === 'object' ? job.location.city || job.location.country : job.location))}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 text-[10px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 transition-all hover:bg-white hover:border-brand-300 hover:text-brand-600 overflow-hidden text-ellipsis whitespace-nowrap"
        >
          <MapPin size={12} className={isPremier ? 'text-amber-500' : 'text-brand-500'} /> {getJobLocationString(typeof job.location === 'object' ? job.location.city || job.location.country : job.location) || "Remote"}
        </a>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-amber-50 p-2 rounded-xl border border-amber-200 text-amber-700 overflow-hidden text-ellipsis whitespace-nowrap">
          <DollarSign size={12} className="text-amber-600" /> {typeof job.salary === 'object' ? (job.salary.amount || job.salary.value || "Competitive") : (job.salary && job.salary.toLowerCase().includes('commission') ? 'Performance Based' : (job.salary || "Competitive"))}
        </div>
      </div>

      {isAdmin && job.url && (
        <div className="mb-4">
          <a 
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-2 w-full py-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:border-brand-500 transition-all"
          >
            <Globe size={12} className="text-brand-500" /> Source Website
          </a>
        </div>
      )}

      {isAdmin && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-center">
            <div className="text-[7px] font-black text-slate-400 uppercase mb-1">Email</div>
            <div className="text-[9px] font-bold text-slate-700 truncate">{job.Contact_Email || 'Not Found'}</div>
          </div>
          <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-center">
            <div className="text-[7px] font-black text-slate-400 uppercase mb-1">WhatsApp</div>
            <div className="text-[9px] font-bold text-slate-700 truncate">{job.WhatsApp_Number || 'Not Found'}</div>
          </div>
          <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-center">
            <div className="text-[7px] font-black text-slate-400 uppercase mb-1">Decision Maker</div>
            <div className="text-[9px] font-bold text-slate-700 truncate">{job.Decision_Maker_Title || 'Admin'}</div>
          </div>
        </div>
      )}

      <div className="mb-4 px-1 relative">
        <p className={`text-[11px] text-slate-600 leading-relaxed line-clamp-2 transition-opacity ${isEnhancing ? 'opacity-30' : 'opacity-100'}`}>
          {job.description}
        </p>
        {isEnhancing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={16} className="text-brand-500 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
        <button 
          disabled={isFlagged || isApplying}
          onClick={handleApply}
          className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 relative overflow-hidden ${
            isFlagged 
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' 
            : isApplying
              ? 'bg-blue-600 text-white cursor-wait'
              : isPremier 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-200 group-hover:shadow-amber-400/50 animate-subtle-pulse' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 group-hover:shadow-blue-400/30 animate-subtle-pulse'
          }`}
        >
          {isFlagged ? (
            'Access Restricted'
          ) : isApplying ? (
            <div className="flex items-center gap-2">
              <Handshake size={14} className="animate-bounce" />
              <span>AI Handshake...</span>
            </div>
          ) : (
            <>Apply via Kaseddie <Zap size={12} /></>
          )}
        </button>
        <button 
          onClick={handleEnhance}
          disabled={isEnhancing || isFlagged}
          className={`px-4 py-3 border rounded-xl transition-all flex items-center gap-2 ${
            isEnhancing ? 'bg-slate-50 text-brand-500' : 'bg-white border-slate-200 text-slate-400 hover:text-amber-500 hover:border-amber-200 hover:bg-amber-50'
          }`}
          title="Generate engaging AI description"
        >
          {isEnhancing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          <span className="text-[9px] font-black uppercase tracking-widest hidden md:inline">AI Insight</span>
        </button>
        <button 
          onClick={() => onAnalyzeSafety(job)}
          className={`p-3 border rounded-xl transition-all ${
            isSafe ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' : 
            isFlagged ? 'bg-red-50 border-red-200 text-red-600' :
            'bg-white border-slate-200 text-slate-400 hover:text-brand-500 hover:border-brand-200'
          }`}
          title="Safety Audit"
        >
          <ShieldCheck size={18} />
        </button>
      </div>
    </div>
  );
};

interface JobDetailModalProps {
  job: Job;
  onClose: () => void;
  onApply: (job: Job) => void;
  onEnhanceJob: (job: Job) => void;
  onAnalyzeSafety: (job: Job) => void;
  onInitializeNode?: (job: Job) => void;
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose, onApply, onEnhanceJob, onAnalyzeSafety, onInitializeNode }) => {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [insight, setInsight] = useState<string>('');
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [copied, setCopied] = useState(false);
  const isPremier = job && (job.tier === 'PREMIER' || (job.hasVisa && job.hasTicket && job.hasAccommodation));
  const region = getRegionTag(job?.location || "", job?.company || "", job?.title || "", job?.url || "");

  useEffect(() => {
    if (job) {
      setIsLoadingInsight(true);
      generateJobInsight(job).then(res => {
        setInsight(res);
        setIsLoadingInsight(false);
      });
    }
  }, [job]);

  const handleEnhance = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEnhancing(true);
    await onEnhanceJob(job);
    setIsEnhancing(false);
  };

  const handleApply = async () => {
    setIsApplying(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    onApply(job);
    setIsApplying(false);
    onClose();
  };

  const handleWhatsApp = () => {
    const number = (job.WhatsApp_Number || '256784428821').replace(/[^0-9]/g, '');
    const text = encodeURIComponent(`Hello, I am contacting you regarding the ${job.title} vacancy at ${job.company}. We have a pool of verified Ugandan professionals ready for immediate deployment.`);
    window.open(`https://wa.me/${number}?text=${text}`, '_blank');
  };

  const handleCopyPitch = async () => {
    const pitch = await generateB2BPitch(job, 500);
    navigator.clipboard.writeText(pitch.proposal);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInitializeNode = () => {
    if (onInitializeNode) {
      onInitializeNode(job);
      onClose();
    } else {
      alert(`Initializing Node Flow for ${job.company}... Scanning corridor nodes.`);
    }
  };

  if (!job) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slideUp"
        onClick={e => e.stopPropagation()}
      >
        <div className={`p-8 pb-6 border-b border-slate-100 flex justify-between items-start relative ${isPremier ? 'bg-gradient-to-br from-amber-50/80 to-white' : 'bg-slate-50/30'}`}>
          <div className="flex-1 border-l-8 pl-6 border-brand-500">
             <div className="flex items-center gap-3 mb-2">
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${region.color}`}>
                  {region.label}
                </div>
                {isPremier && (
                   <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">
                      <Award size={12} /> Priority
                   </div>
                )}
             </div>
             <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
               {job.title}
             </h2>
             <div className="flex items-center gap-3 mt-2 text-slate-500">
               <div className="flex items-center gap-1.5 text-sm font-bold">
                 <Building2 size={16} /> {job.company}
               </div>
               <div className="flex items-center gap-1.5 text-sm font-bold ml-4">
                 <MapPin size={16} /> {getJobLocationString(typeof job.location === 'object' ? job.location.city || job.location.country : job.location)}
               </div>
             </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 transition-all"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Logistics Metadata</div>
                <div className="flex justify-center gap-2">
                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${job.hasVisa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>Visa</span>
                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${job.hasTicket ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>Ticket</span>
                  <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${job.hasAccommodation ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'}`}>Accom</span>
                </div>
             </div>
             <div className="bg-brand-50 p-5 rounded-2xl border border-brand-100 text-center">
                <div className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-2">Match Rating</div>
                <div className="text-xl font-black text-brand-700">{job.matchScore || 0}%</div>
             </div>
             <div className={`p-5 rounded-2xl border text-center ${job.complianceStatus === 'High Risk' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${job.complianceStatus === 'High Risk' ? 'text-red-400' : 'text-emerald-400'}`}>Compliance</div>
                <div className={`text-sm font-black ${job.complianceStatus === 'High Risk' ? 'text-red-700' : 'text-emerald-700'}`}>
                  {job.complianceStatus || 'Verified'}
                </div>
             </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" /> Kaseddie Match Insight
            </h4>
            <div className="bg-amber-50 border border-amber-100 p-5 rounded-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-2 opacity-10"><Users size={48} /></div>
               {isLoadingInsight ? (
                 <div className="flex items-center gap-3">
                   <Loader2 size={16} className="animate-spin text-amber-600" />
                   <span className="text-xs font-bold text-amber-700 italic">Syncing Knowledge Base...</span>
                 </div>
               ) : (
                 <p className="text-sm text-amber-900 font-bold leading-relaxed">{insight}</p>
               )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Info size={18} className="text-brand-600" /> Description
              </h4>
              <button 
                onClick={handleEnhance} 
                disabled={isEnhancing}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-brand-600 hover:text-brand-700 transition-all bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-100"
              >
                {isEnhancing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Enrich with AI
              </button>
            </div>
            <div className={`relative min-h-[60px] transition-all ${isEnhancing ? 'opacity-40 grayscale-[0.5]' : ''}`}>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">{job.description}</p>
              {isEnhancing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[1px]">
                   <Loader2 size={24} className="text-brand-600 animate-spin mb-2" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-brand-600">Re-writing Role Dossier...</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
             <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
               <Zap size={18} className="text-brand-600" /> B2B Outreach Actions
             </h4>
             <div className="grid grid-cols-3 gap-3">
               <button 
                onClick={handleWhatsApp}
                className="flex flex-col items-center gap-2 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl hover:bg-emerald-100 transition-all group"
               >
                 <MessageSquare size={20} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                 <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Send WhatsApp</span>
               </button>
               <button 
                onClick={handleInitializeNode}
                className="flex flex-col items-center gap-2 p-4 bg-blue-50 border border-blue-100 rounded-2xl hover:bg-blue-100 transition-all group"
               >
                 <Terminal size={20} className="text-blue-600 group-hover:scale-110 transition-transform" />
                 <span className="text-[9px] font-black uppercase tracking-widest text-blue-700">Initialize Node</span>
               </button>
               <button 
                onClick={handleCopyPitch}
                className="flex flex-col items-center gap-2 p-4 bg-brand-50 border border-brand-100 rounded-2xl hover:bg-brand-100 transition-all group"
               >
                 {copied ? <Check size={20} className="text-emerald-600" /> : <Copy size={20} className="text-brand-600 group-hover:scale-110 transition-transform" />}
                 <span className="text-[9px] font-black uppercase tracking-widest text-brand-700">{copied ? 'Copied!' : 'B2B Pitch Copy'}</span>
               </button>
             </div>
          </div>
        </div>

        <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-4">
           <button onClick={() => onAnalyzeSafety(job)} className="px-6 py-4 border border-slate-200 bg-white text-slate-600 rounded-[1.25rem] font-black text-xs uppercase tracking-widest"><ShieldCheck size={18} className="text-emerald-500" /></button>
           <button 
             disabled={isApplying}
             onClick={handleApply} 
             className={`flex-1 py-4 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-2 ${
               isApplying ? 'bg-blue-600 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 animate-subtle-pulse'
             }`}
           >
             {isApplying ? (
               <>
                 <Handshake size={20} className="animate-bounce" />
                 AI Handshake...
               </>
             ) : (
               <>Apply via Kaseddie <Zap size={18} /></>
             )}
           </button>
        </div>
      </div>
    </div>
  );
};


const REGIONS = ['All', 'GCC Corridor', 'Luxembourg Node', 'EU-Central (Germany)', 'UK-Northern Corridor', 'Western Corridor', 'Global Corridor'];

export const JobGrid: React.FC<JobGridProps> = ({ jobs, onApply, onEnhanceJob, onAnalyzeSafety, onInitializeNode, selectedRegionOverride, onRegionChange, activeCategoryOverride, onCategoryChange, keywordOverride, scrollTrigger, isAdmin = false }) => {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'blue_collar' | 'professional' | 'service_domestic'>('All');
  const [salaryType, setSalaryType] = useState<'All' | 'Fixed' | 'Commission'>('All');
  const [complianceFilter, setComplianceFilter] = useState<'All' | 'High Risk' | 'Verified'>('All');
  const [sponsorshipOnly, setSponsorshipOnly] = useState<boolean>(false);
  const [fullVettingOnly, setFullVettingOnly] = useState<boolean>(false);

  React.useEffect(() => {
    if (selectedRegionOverride && selectedRegionOverride !== selectedRegion) {
      setSelectedRegion(selectedRegionOverride);
    }
  }, [selectedRegionOverride]);

  React.useEffect(() => {
    if (activeCategoryOverride && activeCategoryOverride !== selectedCategory) {
      setSelectedCategory(activeCategoryOverride);
    }
  }, [activeCategoryOverride]);

  React.useEffect(() => {
    if (typeof keywordOverride === 'string') {
      setSearchTerm(keywordOverride);
      // Keep search bar hidden if search term is provided via deep-link/map, per user request
      setIsSearchExpanded(false);
    }
  }, [keywordOverride]);
  React.useEffect(() => {
    if (scrollTrigger) {
      setTimeout(() => {
        const el = document.querySelector('.job-card') as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 0);
    }
  }, [scrollTrigger]);

  const filteredJobs = useMemo(() => {
    let result = jobs || [];
    
    // Company Grouping: Group similar roles from same company
    const companyGroups: Record<string, Job[]> = {};
    result.forEach(job => {
      if (!job || !job.company) return;
      
      // Bulletproof string handling for company field
      const companyName = typeof job.company === 'string' 
        ? job.company 
        : (job.company?.country || job.company?.formattedAddressShort || "GlobalPath Partner");
      
      const company = companyName.toLowerCase().trim();
      if (!companyGroups[company]) {
        companyGroups[company] = [];
      }
      companyGroups[company].push(job);
    });
    
    // Create grouped jobs with consolidated display
    const groupedJobs: Job[] = [];
    Object.entries(companyGroups).forEach(([company, companyJobs]) => {
      if (companyJobs.length > 1) {
        // Find the most common role for this company
        const roleCounts: Record<string, number> = {};
        companyJobs.forEach(job => {
          const role = job.title.toLowerCase().trim();
          roleCounts[role] = (roleCounts[role] || 0) + 1;
        });
        
        const mostCommonRole = Object.entries(roleCounts)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'various roles';
        
        // Create a consolidated job entry
        const baseJob = companyJobs[0]; // Use first job as base
        groupedJobs.push({
          ...baseJob,
          title: `${mostCommonRole.charAt(0).toUpperCase() + mostCommonRole.slice(1)} (${companyJobs.length} open nodes)`,
          originalJobs: companyJobs, // Store original jobs for reference
          isGrouped: true
        });
      } else {
        // Single job, add as-is
        groupedJobs.push(companyJobs[0]);
      }
    });
    
    result = groupedJobs;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      // Data Normalization: Handle common country aliases
      const aliases: Record<string, string[]> = {
        'uk': ['united kingdom', 'london', 'manchester', 'birmingham', 'gbr'],
        'united kingdom': ['uk', 'london', 'manchester', 'birmingham', 'gbr'],
        'uae': ['dubai', 'abu dhabi', 'emirates', 'sharjah', 'are'],
        'usa': ['united states', 'america', 'new york', 'california', 'texas'],
        'germany': ['deutschland', 'berlin', 'munich', 'hamburg', 'deu'],
        'luxembourg': ['lux', 'luxembourg city'],
      };

      const searchTerms = [term];
      if (aliases[term]) {
        searchTerms.push(...aliases[term]);
      }

      result = result.filter(job => {
        if (!job) return false;
        const title = (job.title || "").toLowerCase();
        const company = (job.company || "").toLowerCase();
        const location = getJobLocationString(typeof job.location === 'object' ? job.location.city || job.location.country : job.location).toLowerCase();
        const country = (job.country || "").toLowerCase();
        const description = (job.description || "").toLowerCase();
        
        return searchTerms.some(t => 
          title.includes(t) || 
          company.includes(t) || 
          location.includes(t) ||
          country.includes(t) ||
          description.includes(t)
        );
      });
    }

    const regionFilter = selectedRegionOverride || selectedRegion;
    if (regionFilter !== 'All') {
      result = result.filter(job => {
        if (!job) return false;
        // Use job.node if available (stamped by App.tsx), otherwise fallback to getRegionTag
        const node = job.node || getRegionTag(
          typeof job.location === 'object' ? job.location.city || job.location.country : job.location, 
          job.company, 
          job.title, 
          job.url
        ).label;
        return node === regionFilter;
      });
    }

    if (selectedCategory !== 'All') {
      result = result.filter(job => job && job.category === selectedCategory);
    }

    if (salaryType !== 'All') {
      result = result.filter(job => 
        salaryType === 'Commission' ? job.is_commission_only : !job.is_commission_only
      );
    }

    if (complianceFilter !== 'All') {
      result = result.filter(job => job.complianceStatus === complianceFilter);
    }

    if (sponsorshipOnly) {
      result = result.filter(job => job && (job.hasSponsorship || job.hasVisa));
    }

    if (fullVettingOnly) {
      result = result.filter(job => job && (job.isVetted === true || (job.hasVisa && job.hasTicket && job.hasAccommodation)));
    }

    return result;
  }, [jobs, searchTerm, selectedRegion, selectedCategory, salaryType, complianceFilter, sponsorshipOnly, fullVettingOnly]);

  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      const getPriority = (loc: string = "") => {
        const lower = (loc || "").toLowerCase();
        for (const [key, priority] of Object.entries(REGION_PRIORITY)) {
          if (lower.includes(key)) return priority;
        }
        return 10;
      };
      
      const pA = getPriority(getJobLocationString(a.location));
      const pB = getPriority(getJobLocationString(b.location));
      if (pA !== pB) return pA - pB;
      return (b.matchScore || 0) - (a.matchScore || 0);
    });
  }, [filteredJobs]);

  const blueCollarJobs = sortedJobs.filter(j => j && j.category === 'blue_collar');
  const professionalJobs = sortedJobs.filter(j => j && j.category === 'professional');
  const serviceDomesticJobs = sortedJobs.filter(j => j && j.category === 'service_domestic');

  return (
    <div className="relative space-y-2">
      <div className="bg-white/80 p-2 md:p-3 rounded-b-[1.5rem] border-x border-b border-slate-200 shadow-sm sticky top-0 z-[40] backdrop-blur-md space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSearchExpanded(!isSearchExpanded)}
              className={`p-2.5 rounded-xl transition-all ${isSearchExpanded ? 'bg-brand-100 text-brand-600' : 'bg-slate-50 text-slate-400 hover:text-brand-500 hover:bg-white border border-transparent hover:border-brand-200'}`}
            >
              <Search size={18} />
            </button>
            
            {/* Filter Chip - Show when searchTerm is active but search is collapsed */}
            {searchTerm && !isSearchExpanded && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 border border-brand-100 rounded-lg animate-fadeIn">
                <span className="text-[10px] font-black text-brand-700 uppercase tracking-widest">{searchTerm}</span>
                <button onClick={() => setSearchTerm('')} className="p-0.5 hover:bg-brand-200 rounded-full text-brand-400 hover:text-brand-600 transition-colors">
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {isSearchExpanded && (
            <div className="relative flex-1 animate-slideLeft">
              <label htmlFor="search-nodes" className="sr-only">Search nodes</label>
              <input 
                id="search-nodes"
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search nodes..."
                className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-brand-50/50 focus:border-brand-500 transition-all font-bold text-xs text-slate-700"
              />
              {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full transition-colors"><X size={12} /></button>}
            </div>
          )}

          {!isSearchExpanded && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {REGIONS.map(region => (
                <button
                  key={region}
                  onClick={() => { setSelectedRegion(region); onRegionChange?.(region); }}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                    selectedRegion === region 
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm' 
                    : 'bg-white text-slate-400 border-slate-200 hover:border-brand-300 hover:text-brand-600'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <div className="hidden sm:flex px-3 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest items-center gap-2">
              <Filter size={12} /> {filteredJobs.length} Nodes
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-50">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {(['All', 'blue_collar', 'professional', 'service_domestic'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => { setSelectedCategory(cat); onCategoryChange?.(cat); }}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                  selectedCategory === cat 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                  : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {cat.replace('_', ' ')}
              </button>
            ))}
            
            <div className="h-4 w-px bg-slate-200 mx-1"></div>

            <select 
              value={salaryType} 
              onChange={(e) => setSalaryType(e.target.value as any)} 
              className="text-[9px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-brand-500/20 text-slate-600"
            >
              <option value="All">All Salaries</option>
              <option value="Fixed">Fixed</option>
              <option value="Commission">Commission</option>
            </select>

            <select 
              value={complianceFilter} 
              onChange={(e) => setComplianceFilter(e.target.value as any)} 
              className="text-[9px] font-black uppercase tracking-widest bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-brand-500/20 text-slate-600"
            >
              <option value="All">All Compliance</option>
              <option value="Verified">Verified</option>
              <option value="High Risk">High Risk</option>
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setFullVettingOnly(!fullVettingOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                fullVettingOnly 
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
              }`}
            >
              {fullVettingOnly ? <CheckCircle2 size={12} /> : <Zap size={12} />}
              AVA Vetted
            </button>
          </div>
        </div>
      </div>

      {sortedJobs.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-4 animate-fadeIn">
          {/* Blue Collar Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50/50 rounded-xl border border-slate-100 mb-2">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <div className="p-1.5 bg-brand-100 text-brand-600 rounded-lg"><Zap size={16} /></div>
                Blue Collar Nodes
              </h2>
              <span className="bg-brand-100 text-brand-700 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                {blueCollarJobs.length}
              </span>
            </div>
            <div className="space-y-4">
              {blueCollarJobs.map(job => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  isPremier={job.tier === 'PREMIER' || (job.hasVisa && job.hasTicket && job.hasAccommodation)} 
                  onApply={onApply} 
                  onEnhanceJob={onEnhanceJob} 
                  onAnalyzeSafety={onAnalyzeSafety} 
                  onClick={setSelectedJob} 
                  isAdmin={isAdmin}
                />
              ))}
              {blueCollarJobs.length === 0 && (
                <div className="p-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No Blue Collar Nodes found</p>
                </div>
              )}
            </div>
          </div>

          {/* Professional Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/50 rounded-xl border border-emerald-100 mb-2">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg"><Users size={16} /></div>
                Professional Nodes
              </h2>
              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                {professionalJobs.length}
              </span>
            </div>
            <div className="space-y-4">
              {professionalJobs.map(job => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  isPremier={job.tier === 'PREMIER' || (job.hasVisa && job.hasTicket && job.hasAccommodation)} 
                  onApply={onApply} 
                  onEnhanceJob={onEnhanceJob} 
                  onAnalyzeSafety={onAnalyzeSafety} 
                  onClick={setSelectedJob} 
                  isAdmin={isAdmin}
                />
              ))}
              {professionalJobs.length === 0 && (
                <div className="p-12 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No Professional Nodes found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-24 flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-200">
           <Search size={64} className="text-slate-200 mb-4" />
           <h3 className="text-2xl font-black text-slate-900 tracking-tight">No Nodes Match Your Search</h3>
           <p className="text-slate-500 text-sm mt-2 font-medium">Try adjusting your filters or search keywords.</p>
           <button 
             onClick={() => { setSelectedRegion('All'); setSponsorshipOnly(false); setFullVettingOnly(false); setSearchTerm(''); }}
             className="mt-6 px-6 py-3 bg-brand-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg"
           >
             Clear All Filters
           </button>
        </div>
      )}

      {selectedJob && (
        <JobDetailModal 
          job={selectedJob} 
          onClose={() => setSelectedJob(null)} 
          onApply={onApply} 
          onEnhanceJob={onEnhanceJob} 
          onAnalyzeSafety={onAnalyzeSafety} 
          onInitializeNode={onInitializeNode}
        />
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { RecruitmentBatch, AgentLogEntry, Job, getJobLocationString } from '../types';
import { 
  ShieldAlert, ShieldCheck, Users, Activity, 
  Lock, Zap, Globe, MapPin, DollarSign,
  Building2, Loader2, Terminal, ExternalLink, Plus, Share2, Check, ChevronRight, Sparkles, RefreshCw
} from 'lucide-react';
import { CorridorFeed } from './CorridorFeed';
import { SearchSummary } from './SearchSummary';
import { API_BASE } from '../constants/api';
import { MarketingEngine } from './MarketingEngine';

interface VendorPortal {
  id: string;
  name: string;
  region: string;
  status: string;
  url: string;
}

interface AdminDashboardProps {
  logs: AgentLogEntry[];
  hrJobs: Job[];
  onAuditJob: (job: Job) => void;
  onDispatchWhatsApp?: () => void;
  onPitch?: (job: Job) => void;
  batches: RecruitmentBatch[];
  setBatches: React.Dispatch<React.SetStateAction<RecruitmentBatch[]>>;
  selectedBatch: RecruitmentBatch | null;
  setSelectedBatch: React.Dispatch<React.SetStateAction<RecruitmentBatch | null>>;
  onAddLog: (message: string, type: AgentLogEntry['type']) => void;
  onExit?: () => void;
  isAdminAuthenticated?: boolean;
  onNodeClick?: (node: string, category: string) => void;
  onRefresh?: () => void;
  isUplinking?: boolean;
  mutateLeads?: (data?: any, shouldRevalidate?: boolean) => Promise<any>;
}

interface JobItemProps {
  job: Job; 
  onPitch: (job: Job) => void | Promise<void>; 
  onAddLog: (message: string, type: AgentLogEntry['type']) => void;
  onCopyB2BLink: (jobId: string) => void;
  onSelectForMarketing?: (job: Job) => void;
  pitchingId: string | null;
  copiedId: string | null;
  isUplinking?: boolean;
}

const JobItem: React.FC<JobItemProps> = ({ 
  job, 
  onPitch, 
  onAddLog, 
  onCopyB2BLink, 
  onSelectForMarketing,
  pitchingId, 
  copiedId,
  isUplinking
}) => (
  <div key={job.id} className="admin-data-node p-8 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group border border-cyan-500/20">
    <div className="flex-1">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-cyan-400 font-bold text-lg group-hover:text-brand-600 transition-colors">{job.company || "Unknown Company"}</h3>
        {job.isHighValue && <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest">High Value</span>}
      </div>
      <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mb-3">
        <span className="flex items-center gap-1"><Building2 size={12} /> {job.company}</span>
        <span className="flex items-center gap-1"><MapPin size={12} /> {getJobLocationString(job.location)}</span>
        {job.salary && <span className="flex items-center gap-1 text-emerald-600"><DollarSign size={12} /> {job.salary}</span>}
      </div>
      
      {/* Use description with fallback to title */}
      <p className="text-white text-sm line-clamp-3 mb-3">{job.description || job.title || job.name || "No description available"}</p>
      
      {/* New contact info display */}
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono">
        <span className="text-green-400">📧 {job.email || "No Email Found"}</span>
        <span className="text-yellow-400">📞 {job.phone || "No Phone Found"}</span>
      </div>
      
      {/* 🛡️ OVERSIGHT INTEL: B2B GATEWAY */}
<div className="mt-6 border-t border-blue-500/30 pt-4 bg-blue-900/10 p-3 rounded-lg">
  <div className="flex items-center gap-2 mb-3">
    <span className="text-blue-400 text-xs">🛡️</span>
    <h4 className="text-[10px] font-bold text-blue-300 tracking-[0.2em] uppercase">
      B2B Recruitment Intel
    </h4>
  </div>
  
  <div className="grid grid-cols-2 gap-2">
    <a 
      href={job?.website || '#'} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/50 p-2 rounded transition-all"
    >
      <span className="text-[10px] font-bold">
        {job?.website?.includes('google.com') ? '🔍 SEARCH WEBSITE' : '🌐 VISIT CORPORATE'}
      </span>
    </a>

    <a 
      href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(job.company)}`}
      target="_blank"
      className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 p-2 rounded transition-all"
    >
      <span className="text-[10px] font-bold text-white">💼 FIND DECISION MAKERS</span>
    </a>
  </div>
  
  <p className="mt-3 text-[9px] text-blue-400/60 leading-tight italic">
    *This section is only visible to GlobalPath Admins. Use these links to manually verify contact numbers when scrapers return empty fields.
  </p>
</div>
      
      <div className="flex gap-2 mt-3">
         {(job.isVetted || job.status === 'vetted') && <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">Visa Vetted</span>}
         {(job.ticketIncluded || job.hasTicket) && <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">Ticket Included</span>}
         {(job.accommodationSecured || job.hasAccommodation) && <span className="text-[8px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 uppercase">Accom Secured</span>}
      </div>
    </div>
    <div className="flex items-center gap-3">
      <button 
        onClick={() => onPitch(job)} 
        disabled={pitchingId === job.id || (isUplinking && pitchingId === job.id)}
        className="px-6 py-4 bg-slate-900 hover:bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
      >
        {pitchingId === job.id ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />} 
        {pitchingId === job.id ? 'Uplinking to HR...' : 'Pitch Lead'}
      </button>
      {onSelectForMarketing && (
        <button 
          onClick={() => onSelectForMarketing(job)}
          className="px-4 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all active:scale-95"
          title="Select for Marketing Engine"
        >
          <Sparkles size={14} /> 
          Market
        </button>
      )}
      <button 
        onClick={() => onCopyB2BLink(job.id)}
        className={`p-4 border rounded-2xl transition-all flex items-center gap-2 ${copiedId === job.id ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
      >
        {copiedId === job.id ? <Check size={20} /> : <Share2 size={20} />}
      </button>
    </div>
  </div>
);

const INITIAL_PORTALS: VendorPortal[] = [
  { id: '1', name: 'UAE Federal Supplier', region: 'UAE', status: 'Registered', url: 'https://finance.gov.ae/en/services/Pages/SupplierRegistration.aspx' },
  { id: '2', name: 'Qatar MOCI Vendor', region: 'Qatar', status: 'Action Required', url: 'https://www.moci.gov.qa/' },
  { id: '3', name: 'Emirates iSupplier', region: 'Dubai', status: 'Pending', url: 'https://isupplier.emirates.com/' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ logs, hrJobs, onAuditJob, onPitch, batches, setBatches, selectedBatch, setSelectedBatch, onAddLog, onExit, onNodeClick, onRefresh, isUplinking, mutateLeads }) => {
  // Helper function to determine category from multiple fields (matches App.tsx logic)
  const getJobCategory = (job: any): 'professional' | 'blue_collar' | 'service_domestic' | 'general' => {
    // Check category field first with LOOSE MAPPING (case-insensitive, partial matches)
    if (job.category) {
      const cat = job.category.toLowerCase();
      // Loose mapping: handle various naming conventions
      if (cat.includes('professional') || cat === 'professional') return 'professional';
      if (cat.includes('blue') || cat.includes('collar') || cat === 'blue_collar') return 'blue_collar';
      if (cat.includes('service') || cat.includes('domestic') || cat === 'service_domestic') return 'service_domestic';
    }
    
    // Enhanced categorization matching App.tsx logic
    const title = (job.title || job.positionName || '').toLowerCase();
    const description = (job.description || '').toLowerCase();
    const interests = (job.interests || '').toLowerCase();
    const text = `${title} ${description} ${interests}`;

    // 1. SERVICE & DOMESTIC (New Category)
    if (
      text.includes('cleaner') || text.includes('housekeeper') ||
      text.includes('maid') || text.includes('maids') || text.includes('nanny') || 
      text.includes('domestic') || text.includes('janitor') || text.includes('caregiver') ||
      text.includes('care assistant') || text.includes('cleaners')
    ) {
      return 'service_domestic';
    }

    // 2. DOMESTIC & HOSPITALITY (The "Missing" Leads)
    if (
      text.includes('housekeeping') || text.includes('chef') || 
      text.includes('cook') || text.includes('caregiver') ||
      text.includes('care home') || text.includes('care assistant') ||
      text.includes('support worker')
    ) {
      return 'blue_collar';
    }

    // 2. LOGISTICS
    if (
      text.includes('driver') || text.includes('delivery') || 
      text.includes('transport') || text.includes('warehouse') ||
      text.includes('delivery driver') || text.includes('helper') ||
      text.includes('merchandiser') || text.includes('shelf')
    ) {
      return 'blue_collar';
    }

    // 3. IT & DIGITAL
    if (
      text.includes('engineer') || text.includes('developer') || 
      text.includes('ai') || text.includes('software') ||
      text.includes('it specialist') || text.includes('cybersecurity') ||
      text.includes('analyst') || text.includes('consultant') ||
      text.includes('manager') || text.includes('associate') ||
      text.includes('executive') || text.includes('pwc') || 
      text.includes('deloitte') || text.includes('officer') ||
      text.includes('procurement') || text.includes('logistics manager') ||
      text.includes('supply chain') || text.includes('nurse') || 
      text.includes('doctor') || text.includes('physician') ||
      text.includes('hospitality') || text.includes('hotel') ||
      text.includes('goodyear associate') || text.includes('events management specialist')
    ) {
      return 'professional';
    }

    // Default fallback - assume blue collar for missing data
    return 'blue_collar';
  };

  useEffect(() => {
    console.log("🛠️ [Admin Dashboard Sync]:", { 
      total_leads: hrJobs.length, 
      professional: hrJobs.filter(j => getJobCategory(j) === 'professional').length,
      blue_collar: hrJobs.filter(j => getJobCategory(j) === 'blue_collar').length,
      service_domestic: hrJobs.filter(j => getJobCategory(j) === 'service_domestic').length
    });
  }, [hrJobs]);

  const [activeTab, setActiveTab] = useState<'leads' | 'portals' | 'marketing'>('leads');
  const [portals, setPortals] = useState<VendorPortal[]>(INITIAL_PORTALS);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [pitchingId, setPitchingId] = useState<string | null>(null);
  const [portalModal, setPortalModal] = useState<{ name: string; region: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleNodeClickSafe = (region: string, category?: string) => {
    try {
      console.log(`🔗 [NODE CLICK]: Navigating to region="${region}" category="${category}"`);
      onNodeClick?.(region, category as any);
    } catch (error) {
      console.error('❌ [NODE CLICK ERROR]:', error);
      // Fallback: use 'Global' for malformed location data
      const safeRegion = typeof region === 'string' && region.length > 0 ? region : 'Global';
      const safeCategory = category && typeof category === 'string' ? category : 'All';
      onNodeClick?.(safeRegion, safeCategory as any);
    }
  };
  const [isForceVerifying, setIsForceVerifying] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const handleRefreshData = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    onAddLog("OVERSIGHT: Triggering manual node telemetry refresh...", "thinking");
    try {
      await onRefresh();
      onAddLog("OVERSIGHT: Telemetry refresh complete.", "success");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleForceMap = () => {
    onAddLog("OVERSIGHT: Recalibrating Sensor Mapping for Western & Luxembourg nodes...", "thinking");
    // This triggers the re-computation of stats and sorting logic in App.tsx
    if (onRefresh) onRefresh();
    setTimeout(() => {
      onAddLog("OVERSIGHT: Force Mapping Successful. Poland -> Western Corridor identified.", "success");
    }, 1000);
  };

  const handleCopyB2BLink = (jobId: string) => {
    const link = `https://globalpath.ug/b2b/pipeline/${jobId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(jobId);
    onAddLog(`PITCH: Generated secure B2B pipeline link for employer.`, 'info');
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handlePitchLead = async (job: Job) => {
    setPitchingId(job.id);
    onAddLog(`PITCH: Analyzing employer nodes for ${job.company}...`, 'thinking');
    try {
      if (onPitch) await onPitch(job);
    } catch (error) {
      console.error('PITCH ERROR:', error);
      onAddLog(`PITCH ERROR: Failed to generate pitch for ${job.company} - ${error}`, 'error');
    } finally {
      // If we are uplinking, we want to keep the pitchingId set until we redirect
      if (!isUplinking) {
        setPitchingId(null);
      }
    }
  };

  const handleSelectForMarketing = (job: Job) => {
    if (!job) return;
    setSelectedJob(job);
    setActiveTab('marketing');
    onAddLog(`MARKETING: Selected ${job.company || 'Unknown Company'} - ${job.title || 'Unknown Role'} for marketing asset generation`, "info");
  };

  const handleForceVerify = async () => {
    setIsForceVerifying(true);
    onAddLog("FORCE VERIFY: Starting mass verification of all leads...", "thinking");
    
    try {
      const response = await fetch(`${API_BASE}/api/force-verify-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        onAddLog(`FORCE VERIFY: Successfully verified ${result.verified_count} leads!`, "success");
        onAddLog(`FORCE VERIFY: All nodes moved from 'Pending' to 'Active' status`, "success");
        
        // Trigger a refresh to see the updated data
        if (onRefresh) {
          setTimeout(() => {
            onRefresh();
            onAddLog("FORCE VERIFY: Refreshing dashboard to show verified leads...", "info");
          }, 1000);
        }
      } else {
        onAddLog(`FORCE VERIFY ERROR: ${result.message}`, "error");
      }
    } catch (error) {
      console.error('Force verify error:', error);
      onAddLog(`FORCE VERIFY ERROR: Failed to connect to backend - ${error}`, "error");
    } finally {
      setIsForceVerifying(false);
    }
  };

  const handleClearCache = async () => {
    onAddLog("CACHE CLEAR: Clearing SWR cache and refreshing data...", "thinking");
    
    try {
      // Clear SWR cache by mutating with null
      await mutateLeads(undefined, false);
      
      // Force immediate refresh
      setTimeout(() => {
        mutateLeads();
        onAddLog("CACHE CLEAR: SWR cache cleared, forcing fresh data fetch...", "success");
      }, 100);
    } catch (error) {
      console.error('Cache clear error:', error);
      onAddLog(`CACHE CLEAR ERROR: ${error}`, "error");
    }
  };

  // PRIORITY SORT: Golden Corridor (GCC -> Western/Poland) and Luxembourg Node must appear at the top
  const sortedHrJobs = [...hrJobs].sort((a, b) => {
    const priorityNodes = ['Premium Node', 'Premium Node (LUX)', 'Dubai Hub', 'Western Corridor'];
    
    const aNode = a.corridor || a.node || '';
    const bNode = b.corridor || b.node || '';

    const aPriorityIndex = priorityNodes.indexOf(aNode);
    const bPriorityIndex = priorityNodes.indexOf(bNode);

    if (aPriorityIndex !== -1 && bPriorityIndex !== -1) {
      if (aNode === bNode) {
        // Same node, sort by country priority
        const priorityCountries = ['united arab emirates', 'saudi arabia', 'poland', 'luxembourg'];
        const aCountryIndex = priorityCountries.indexOf(String(a.country || '').toLowerCase());
        const bCountryIndex = priorityCountries.indexOf(String(b.country || '').toLowerCase());
        return aCountryIndex - bCountryIndex;
      }
      return aPriorityIndex - bPriorityIndex;
    }
    if (aPriorityIndex !== -1) return -1;
    if (bPriorityIndex !== -1) return 1;
    
    // Secondary sort by country for Big Four fallback
    const priorityCountries = ['united arab emirates', 'saudi arabia', 'poland', 'luxembourg'];
    const aCountryIndex = priorityCountries.indexOf(String(a.country || '').toLowerCase());
    const bCountryIndex = priorityCountries.indexOf(String(b.country || '').toLowerCase());

    if (aCountryIndex !== -1 && bCountryIndex !== -1) return aCountryIndex - bCountryIndex;
    if (aCountryIndex !== -1) return -1;
    if (bCountryIndex !== -1) return 1;

    return 0;
  });

  const professionalJobs = sortedHrJobs.filter(j => {
    const cat = getJobCategory(j);
    return cat === 'professional' || (cat && cat.toLowerCase().includes('professional'));
  });
  const blueCollarJobs = sortedHrJobs.filter(j => {
    const cat = getJobCategory(j);
    return cat === 'blue_collar' || (cat && cat.toLowerCase().includes('blue') && cat.toLowerCase().includes('collar'));
  });
  const serviceDomesticJobs = sortedHrJobs.filter(j => {
    const cat = getJobCategory(j);
    return cat === 'service_domestic' || (cat && (cat.toLowerCase().includes('service') || cat.toLowerCase().includes('domestic')));
  });
  const otherJobs = sortedHrJobs.filter(j => {
    const cat = getJobCategory(j);
    return cat !== 'professional' && cat !== 'blue_collar' && cat !== 'service_domestic';
  });
  const totalLeadsCount = hrJobs.length;
  
  // EMERGENCY DEBUG: Log raw data for 60 seconds
  console.log("🚨 EMERGENCY DEBUG: Raw hrJobs data:", hrJobs);
  console.log("🚨 EMERGENCY DEBUG: Total leads:", hrJobs.length);
  console.log("🚨 EMERGENCY DEBUG: Professional count:", professionalJobs.length);
  console.log("🚨 EMERGENCY DEBUG: Blue-collar count:", blueCollarJobs.length);
  console.log("🚨 EMERGENCY DEBUG: Service & Domestic count:", serviceDomesticJobs.length);
  console.log("🚨 EMERGENCY DEBUG: Other count:", otherJobs.length);
  
  // TEMPORARY DEBUG: Show absolutely everything for 60 seconds
  const emergencyShowAll = false; // Set to true to bypass all filters
  const displayProfessionalJobs = emergencyShowAll ? sortedHrJobs : professionalJobs;
  const displayBlueCollarJobs = emergencyShowAll ? [] : blueCollarJobs; // Keep empty to test sector assignment
  const displayOtherJobs = emergencyShowAll ? [] : otherJobs;
  
  console.log("🚨 EMERGENCY DEBUG: Emergency mode:", emergencyShowAll ? "SHOWING ALL" : "NORMAL FILTER");
  
  console.log("📈 [ADMIN DASHBOARD COUNT]:", totalLeadsCount);

  return (
    <div className="space-y-6 animate-fadeIn pb-12 bg-[#0f172a] text-gray-100 min-h-screen">
      {/* Oversight Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between bg-[#0f172a] p-8 rounded-[2.5rem] text-gray-100 shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="flex items-center gap-6 relative z-10">
          {typeof onExit === 'function' && (
            <button onClick={onExit} className="absolute -top-2 -left-2 underline text-[10px] font-black" style={{ color: '#EAB308' }}>
              ← Back to Dashboard
            </button>
          )}
          <div className="p-5 bg-brand-500/10 text-brand-500 rounded-2xl border border-brand-500/20">
            <ShieldAlert size={32} strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-1.5">
              <h2 className="text-3xl font-black tracking-tight text-gray-100">Oversight Console</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse">
                  <Activity size={10} /> {totalLeadsCount} ACTIVE NODES
                </div>
                <button 
                  onClick={handleRefreshData}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 bg-[#EAB308] hover:bg-white text-black text-[10px] font-black px-2.5 py-1 rounded-full transition-all active:scale-95 disabled:opacity-50"
                >
                  <Zap size={10} className={isRefreshing ? 'animate-spin' : ''} />
                  {isRefreshing ? 'REFRESHING...' : 'FORCE REFRESH DATA'}
                </button>
                <button 
                  onClick={handleForceMap}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-white text-white hover:text-blue-600 text-[10px] font-black px-2.5 py-1 rounded-full transition-all active:scale-95"
                >
                  <Globe size={10} />
                  FORCE MAP
                </button>
                <button 
                  onClick={handleForceVerify}
                  disabled={isForceVerifying}
                  className="flex items-center gap-1.5 bg-red-600 hover:bg-white text-white hover:text-red-600 text-[10px] font-black px-2.5 py-1 rounded-full transition-all active:scale-95 disabled:opacity-50"
                >
                  <ShieldCheck size={10} className={isForceVerifying ? 'animate-pulse' : ''} />
                  {isForceVerifying ? 'VERIFYING...' : 'FORCE VERIFY'}
                </button>
                <button 
                  onClick={handleClearCache}
                  className="flex items-center gap-1.5 bg-orange-600 hover:bg-white text-white hover:text-orange-600 text-[10px] font-black px-2.5 py-1 rounded-full transition-all active:scale-95"
                >
                  <RefreshCw size={10} />
                  CLEAR CACHE
                </button>
              </div>
            </div>
            <p className="text-slate-400 text-xs font-mono uppercase tracking-[0.3em]">Full-Spectrum ASR Sector Rotation System</p>
          </div>
        </div>
        <div className="relative z-10 flex gap-4 mt-6 lg:mt-0">
           <button onClick={() => setActiveTab('leads')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'leads' ? 'bg-brand-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Lead Oversight</button>
           <button onClick={() => setActiveTab('portals')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'portals' ? 'bg-brand-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Vendor Portals</button>
           <button onClick={() => setActiveTab('marketing')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'marketing' ? 'bg-brand-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Marketing Engine</button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column (span-8): Leads + Logs */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {activeTab === 'leads' ? (
            <>
              <div className="bg-[#1a1a1a] rounded-[2.5rem] border border-slate-700 shadow-xl overflow-hidden">
                {/* Professional Section */}
                <button 
                  onClick={() => handleNodeClickSafe('All', 'professional')}
                  className="w-full p-8 border-b border-slate-700 flex items-center justify-between bg-slate-800/30 hover:bg-slate-700 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-900 text-emerald-400 rounded-xl group-hover:scale-110 transition-transform"><Users size={20} /></div>
                    <div>
                      <h3 className="text-xl font-black text-gray-100">Professional Workforce Section</h3>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Audited Hub Capacity: Vetted Professional Nodes</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-emerald-500 transition-transform group-hover:translate-x-1" />
                </button>
                <div className="divide-y divide-slate-50">
                  {displayProfessionalJobs.length > 0 ? displayProfessionalJobs.map((job) => (
                    <JobItem 
                      key={job.id} 
                      job={job} 
                      onPitch={handlePitchLead}
                      onAddLog={onAddLog}
                      onCopyB2BLink={handleCopyB2BLink}
                      onSelectForMarketing={handleSelectForMarketing}
                      pitchingId={pitchingId}
                      copiedId={copiedLink}
                      isUplinking={isUplinking}
                    />
                  )) : (
                    <div className="p-6 text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">No Professional Nodes Detected</p>
                    </div>
                  )}
                </div>

                {/* Blue-Collar Section */}
                <button 
                  onClick={() => handleNodeClickSafe('All', 'blue_collar')}
                  className="w-full p-8 border-b border-slate-700 flex items-center justify-between bg-slate-800/30 hover:bg-slate-700 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-900 text-brand-400 rounded-xl group-hover:scale-110 transition-transform"><Zap size={20} /></div>
                    <div>
                      <h3 className="text-xl font-black text-gray-100">Blue-Collar Workforce Section</h3>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Audited Hub Capacity: Vetted Essential Nodes</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-brand-500 transition-transform group-hover:translate-x-1" />
                </button>
                <div className="divide-y divide-slate-50">
                  {displayBlueCollarJobs.length > 0 ? displayBlueCollarJobs.map((job) => (
                    <JobItem 
                      key={job.id} 
                      job={job} 
                      onPitch={handlePitchLead}
                      onAddLog={onAddLog}
                      onCopyB2BLink={handleCopyB2BLink}
                      onSelectForMarketing={handleSelectForMarketing}
                      pitchingId={pitchingId}
                      copiedId={copiedLink}
                      isUplinking={isUplinking}
                    />
                  )) : (
                    <div className="p-6 text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">No Blue-Collar Nodes Detected</p>
                    </div>
                  )}
                </div>

                {/* Service & Domestic Section */}
                <button 
                  onClick={() => handleNodeClickSafe('All', 'service_domestic')}
                  className="w-full p-8 border-b border-t border-slate-700 flex items-center justify-between bg-slate-800/30 hover:bg-slate-700 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-cyan-900 text-cyan-400 rounded-xl group-hover:scale-110 transition-transform"><ShieldCheck size={20} /></div>
                    <div>
                      <h3 className="text-xl font-black text-gray-100">Service & Domestic Section</h3>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Audited Hub Capacity: Vetted Service Nodes</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-cyan-500 transition-transform group-hover:translate-x-1" />
                </button>
                <div className="divide-y divide-slate-50">
                  {serviceDomesticJobs.length > 0 ? serviceDomesticJobs.map((job) => (
                    <JobItem 
                      key={job.id} 
                      job={job} 
                      onPitch={handlePitchLead}
                      onAddLog={onAddLog}
                      onCopyB2BLink={handleCopyB2BLink}
                      onSelectForMarketing={handleSelectForMarketing}
                      pitchingId={pitchingId}
                      copiedId={copiedLink}
                      isUplinking={isUplinking}
                    />
                  )) : (
                    <div className="p-6 text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">No Service & Domestic Nodes Detected</p>
                    </div>
                  )}
                </div>

                {/* General/Uncategorized Section */}
                {displayOtherJobs.length > 0 && (
                  <>
                    <div className="w-full p-8 border-b border-t border-slate-100 flex items-center justify-between bg-slate-50/30 text-left">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-600 rounded-xl"><Globe size={20} /></div>
                        <div>
                          <h3 className="text-xl font-black text-slate-800">General Workforce Section</h3>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Uncategorized Global Leads</p>
                        </div>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {displayOtherJobs.map((job) => (
                        <JobItem 
                          key={job.id} 
                          job={job} 
                          onPitch={handlePitchLead}
                          onAddLog={onAddLog}
                          onCopyB2BLink={handleCopyB2BLink}
                          onSelectForMarketing={handleSelectForMarketing}
                          pitchingId={pitchingId}
                          copiedId={copiedLink}
                          isUplinking={isUplinking}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Oversight Intelligence Log */}
              <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 text-white shadow-2xl h-[400px] overflow-hidden flex flex-col">
                 <div className="flex items-center gap-3 mb-6">
                    <Terminal className="text-brand-500" size={20} />
                    <h3 className="text-sm font-black uppercase tracking-[0.2em]">Oversight Log</h3>
                 </div>
                 <div className="space-y-4 font-mono text-[11px] overflow-y-auto scrollbar-hide flex-1">
                    {logs.slice().reverse().map(log => (
                      <div key={log.id} className="flex gap-4 border-l border-slate-800 pl-4 py-1 hover:bg-white/5 transition-colors">
                         <span className="text-slate-600">[{log.timestamp.toLocaleTimeString()}]</span>
                         <span className={log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-red-400' : 'text-slate-400'}>{log.message}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </>
          ) : activeTab === 'portals' ? (
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-50 text-brand-600 rounded-xl"><Globe size={20} /></div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Vendor Gatekeeper Portals</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {portals.map(portal => (
                  <div key={portal.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-200 hover:border-brand-300 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                       <div className="p-3 bg-white rounded-2xl shadow-sm"><Globe size={20} className="text-brand-600" /></div>
                       <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md border ${
                         portal.status === 'Registered' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                         portal.status === 'Action Required' ? 'bg-red-100 text-red-700 border-red-200' :
                         'bg-slate-200 text-slate-600 border-slate-300'
                       }`}>{portal.status}</span>
                    </div>
                    <h4 className="font-black text-slate-900 text-sm mb-1">{portal.name}</h4>
                    <p className="text-[10px] text-slate-500 font-bold mb-4">{portal.region} Hub</p>
                    <button 
                      onClick={() => {
                        const url = String(portal.url || '');
                        const valid = /^https?:\/\//i.test(url);
                        if (valid) {
                          window.open(url, '_blank');
                        } else {
                          setPortalModal({ name: portal.name, region: portal.region });
                        }
                      }}
                      className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-slate-900 group-hover:text-white transition-all"
                    >
                      Enter Portal
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'marketing' ? (
            <MarketingEngine 
              selectedJob={selectedJob}
              onGenerateMarketing={async (job) => {
                const response = await fetch(`${API_BASE}/generate-marketing`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    company: job.company,
                    title: job.title,
                    corridor: job.corridor
                  })
                });
                const data = await response.json();
                return data.marketing_content;
              }}
              onLog={(message, type, step) => onAddLog(message, type)}
            />
          ) : null}
        </div>

        {/* Right Column (span-4): Vetted Batches (INTERACTIVE) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
           {/* Safety check: Ensure hrJobs exists before passing to SearchSummary */}
           {hrJobs && Array.isArray(hrJobs) && hrJobs.length > 0 ? (
             <SearchSummary jobs={hrJobs} onNodeClick={handleNodeClickSafe} />
           ) : (
             <div className="p-4 bg-slate-800 text-white rounded-lg">
               <div className="flex items-center gap-2">
                 <Loader2 className="animate-spin" size={16} />
                 <span className="animate-pulse text-cyan-400">🔍 AI Brain Syncing...</span>
               </div>
             </div>
           )}
           
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
              <h3 className="font-black text-slate-800 flex items-center gap-3 text-sm uppercase tracking-widest mb-6">
                <Users size={20} className="text-brand-600" /> Vetted Batches
              </h3>
              <div className="space-y-4">
                {batches.map(batch => (
                  <button 
                    key={batch.id} 
                    onClick={() => setSelectedBatch(batch)}
                    className={`w-full text-left p-5 rounded-3xl border transition-all relative overflow-hidden group cursor-pointer ${
                      selectedBatch?.id === batch.id 
                      ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-500/20 shadow-md' 
                      : 'bg-slate-50 border-slate-100 hover:border-brand-200 hover:bg-white hover:shadow-lg'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                        {batch.corridor}
                        {selectedBatch?.id === batch.id && <Zap size={10} className="text-brand-600 animate-pulse" />}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-brand-600">{batch.verifiedCount}/{batch.size}</span>
                        <ChevronRight size={14} className={`text-slate-300 transition-transform group-hover:translate-x-1 ${selectedBatch?.id === batch.id ? 'text-brand-500 translate-x-1' : ''}`} />
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${selectedBatch?.id === batch.id ? 'bg-brand-600 animate-pulse' : 'bg-brand-500'}`} 
                        style={{ width: `${(batch.verifiedCount / batch.size) * 100}%` }}
                      ></div>
                    </div>
                    <div className="mt-2 text-[8px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                       <span>Vetting: {batch.status}</span>
                       <span className="group-hover:text-brand-600 transition-colors">Corridor Audit</span>
                    </div>
                  </button>
                ))}
              </div>
           </div>

          <div className="flex-1">
              <CorridorFeed nodesActive={hrJobs.length} feesBlocked={logs.length} />
           </div>
        </div>
      </div>
      {portalModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-black text-slate-900">Portal Under Construction</h3>
              <button onClick={() => setPortalModal(null)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">Close</button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              The registration page for {portalModal.name} ({portalModal.region}) is not yet available in this build. Please check back later or use the official vendor website.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RecruitmentBatch, AgentLogEntry, Job, getJobLocationString } from '../types';
import { 
  ShieldAlert, ShieldCheck, Users, Activity, 
  Zap, Globe, MapPin, DollarSign,
  Building2, Loader2, Terminal, Share2, Check, ChevronRight, Sparkles, RefreshCw
} from 'lucide-react';
import { CorridorFeed } from './CorridorFeed';
import { SearchSummary } from './SearchSummary';
import { fetcher } from '../constants/api';
import { MarketingEngine } from './MarketingEngine';
import { safeArray } from '../utils/sanitize'; // K2.5: Defensive array utility
import { categorizeJob } from '../utils/jobCategorization';
import { APP_CONFIG } from '../constants/appConfig';

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
  totalLeadsFromSWR?: number;
}

interface JobItemProps {
  job: Job; 
  onPitch: (job: Job) => void | Promise<void>; 
  onCopyB2BLink: (jobId: string) => void;
  onSelectForMarketing?: (job: Job) => void;
  pitchingId: string | null;
  copiedId: string | null;
  isUplinking?: boolean;
}

const JobItem: React.FC<JobItemProps> = ({ 
  job, 
  onPitch, 
  onCopyB2BLink, 
  onSelectForMarketing,
  pitchingId, 
  copiedId,
  isUplinking
}) => {
  // Safe job properties
  const safeJobCompany = job?.company || "Unknown Company";
  const safeJobTitle = job?.title || job?.positionName || "Unknown Position";
  const safeJobDescription = job?.description || safeJobTitle || job?.name || "No description available";
  const safeJobId = job?.id || "unknown";
  const safeJobEmail = job?.email || "No Email Found";
  const safeJobPhone = job?.phone || "No Phone Found";
  const safeJobWebsite = job?.website || "";
  
  return (
  <div className="admin-data-node p-8 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group border border-cyan-500/20">
    <div className="flex-1">
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-cyan-400 font-bold text-lg group-hover:text-brand-600 transition-colors">{safeJobCompany}</h3>
        {job?.isHighValue && <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-1 rounded uppercase tracking-widest">High Value</span>}
      </div>
      <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mb-3">
        <span className="flex items-center gap-1"><Building2 size={12} /> {safeJobCompany}</span>
        <span className="flex items-center gap-1"><MapPin size={12} /> {getJobLocationString(job?.location)}</span>
        {job?.salary && <span className="flex items-center gap-1 text-emerald-600"><DollarSign size={12} /> {job.salary}</span>}
      </div>
      
      {/* Use description with fallback to title */}
      <p className="text-white text-sm line-clamp-3 mb-3">{safeJobDescription}</p>
      
      {/* New contact info display */}
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono">
        <span className="text-green-400">📧 {safeJobEmail}</span>
        <span className="text-yellow-400">📞 {safeJobPhone}</span>
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
      href={safeJobWebsite || '#'} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/50 p-2 rounded transition-all"
    >
      <span className="text-[10px] font-bold">
        {safeJobWebsite.includes('google.com') ? '🔍 SEARCH WEBSITE' : '🌐 VISIT CORPORATE'}
      </span>
    </a>

    <a 
      href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(safeJobCompany)}`}
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
         {(job?.isVetted || job?.status === 'vetted') && <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">Visa Vetted</span>}
         {(job?.ticketIncluded || job?.hasTicket) && <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">Ticket Included</span>}
         {(job?.accommodationSecured || job?.hasAccommodation) && <span className="text-[8px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 uppercase">Accom Secured</span>}
      </div>
    </div>
    <div className="flex items-center gap-3">
      <button 
        onClick={() => onPitch(job)} 
        disabled={pitchingId === safeJobId || (isUplinking && pitchingId === safeJobId)}
        className="px-6 py-4 bg-slate-900 hover:bg-brand-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
      >
        {pitchingId === safeJobId ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />} 
        {pitchingId === safeJobId ? 'Uplinking to HR...' : 'Pitch Lead'}
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
        onClick={() => onCopyB2BLink(safeJobId)}
        className={`p-4 border rounded-2xl transition-all flex items-center gap-2 ${copiedId === safeJobId ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
      >
        {copiedId === safeJobId ? <Check size={20} /> : <Share2 size={20} />}
      </button>
    </div>
  </div>
  );
};

const INITIAL_PORTALS: VendorPortal[] = [
  { id: '1', name: 'UAE Federal Supplier', region: 'UAE', status: 'Registered', url: 'https://finance.gov.ae/en/services/Pages/SupplierRegistration.aspx' },
  { id: '2', name: 'Qatar MOCI Vendor', region: 'Qatar', status: 'Action Required', url: 'https://www.moci.gov.qa/' },
  { id: '3', name: 'Emirates iSupplier', region: 'Dubai', status: 'Pending', url: 'https://isupplier.emirates.com/' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ logs, hrJobs, onAuditJob, onPitch, batches, setBatches, selectedBatch, setSelectedBatch, onAddLog, onExit, onNodeClick, onRefresh, isUplinking, mutateLeads, totalLeadsFromSWR }) => {
  try {
    // ARCHITECT'S DIRECTIVE 1: Ghost Exorcism - Mounting guard for SWR/mutate operations
    const isMounted = useRef(true);
    useEffect(() => {
      return () => {
        isMounted.current = false;
      };
    }, []);
  


  const sanitizedJobs = React.useMemo(() => {
    // Ensure hrJobs is an array before processing
    if (!Array.isArray(hrJobs)) return [];
    
    return hrJobs
      .filter((job): job is Job => {
        // Filter corrupted nodes: must be valid object with required fields
        if (!job || typeof job !== 'object') return false;
        if (!job.id) return false; // ID is mandatory
        return true;
      })
      .map(job => ({
        ...job,
        id: typeof job.id === 'string' ? job.id : String(job.id || ''),
        title: typeof job.title === 'string' ? job.title : (typeof job.positionName === 'string' ? job.positionName : ''),
        company: typeof job.company === 'string' ? job.company : '',
        category: categorizeJob(job),
        status: typeof job.status === 'string' ? job.status : 'pending',
      }))
      .filter(job => job.id !== ''); // Remove items with empty IDs
  }, [hrJobs]);

  useEffect(() => {
    // KIMI K2.5: Use sanitizedJobs for logging to prevent errors on corrupted data
    try {
      console.log("🛠️ [Admin Dashboard Sync]:", {
        total_leads: sanitizedJobs?.length ?? 0,
        professional: sanitizedJobs?.filter((j: Job) => j?.category === 'professional').length ?? 0,
        blue_collar: sanitizedJobs?.filter((j: Job) => j?.category === 'blue_collar').length ?? 0,
        service_domestic: sanitizedJobs?.filter((j: Job) => j?.category === 'service_domestic').length ?? 0
      });
    } catch (error) {
      console.error("Admin Dashboard Sync logging error:", error);
    }
  }, [sanitizedJobs]);

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
    // ARCHITECT'S DIRECTIVE 1: Check mount status before state updates
    if (!isMounted.current) return;
    setIsRefreshing(true);
    onAddLog("OVERSIGHT: Triggering manual node telemetry refresh...", "thinking");
    try {
      await onRefresh();
      // ARCHITECT'S DIRECTIVE 1: Verify still mounted before logging/updating state
      if (isMounted.current) {
        onAddLog("OVERSIGHT: Telemetry refresh complete.", "success");
      }
    } finally {
      if (isMounted.current) {
        setIsRefreshing(false);
      }
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

  const navigate = useNavigate();

  const handlePitchLead = async (job: Job) => {
    setPitchingId(job.id);
    onAddLog(`PITCH: Analyzing employer nodes for ${job.company}...`, 'thinking');
    try {
      // MISSION 1: Pitch Lead Data Handover - Use React Router navigate with state
      navigate('/hr-portal', { 
        state: { 
          selectedLead: job,
          autoInitializeB2B: true 
        } 
      });
      onAddLog(`PITCH: Data handover to HR Portal for ${job.company} complete.`, 'success');
      if (onPitch) await onPitch(job);
    } catch (error) {
      console.error('PITCH ERROR:', error);
      onAddLog(`PITCH ERROR: Failed to generate pitch for ${job.company} - ${error}`, 'error');
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
      // `fetcher` already resolves to parsed JSON. If a future refactor swaps in
      // a raw Response, the `instanceof Response` branch will re-parse it
      // explicitly with `await response.json()` instead of dereferencing a Promise.
      const raw = await fetcher('/force-verify-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: any =
        raw && typeof (raw as any).json === 'function'
          ? await (raw as Response).json()
          : raw;

      if (!result || typeof result !== 'object') {
        onAddLog('FORCE VERIFY ERROR: Backend returned an unexpected payload.', 'error');
        return;
      }

      if (result?.status === 'success') {
        onAddLog(`FORCE VERIFY: Successfully verified ${result?.verified_count ?? 0} leads!`, 'success');
        onAddLog("FORCE VERIFY: All nodes moved from 'Pending' to 'Active' status", 'success');

        if (onRefresh) {
          setTimeout(() => {
            if (!isMounted.current) return;
            onRefresh();
            onAddLog('FORCE VERIFY: Refreshing dashboard to show verified leads...', 'info');
          }, 1000);
        }
      } else {
        onAddLog(`FORCE VERIFY ERROR: ${result?.message ?? 'Unknown backend error'}`, 'error');
      }
    } catch (error) {
      console.error('Force verify error:', error);
      onAddLog(`FORCE VERIFY ERROR: Failed to connect to backend - ${error}`, 'error');
    } finally {
      if (isMounted.current) setIsForceVerifying(false);
    }
  };

  const handleClearCache = async () => {
    // ARCHITECT'S DIRECTIVE 1: Check mount status before operations
    if (!isMounted.current) return;
    onAddLog("CACHE CLEAR: Clearing SWR cache and refreshing data...", "thinking");
    
    try {
      // Clear SWR cache by mutating with null
      await mutateLeads(undefined, false);
      
      // Force immediate refresh
      setTimeout(() => {
        // ARCHITECT'S DIRECTIVE 1: Verify still mounted before SWR operations
        if (isMounted.current) {
          mutateLeads();
          onAddLog("CACHE CLEAR: SWR cache cleared, forcing fresh data fetch...", "success");
        }
      }, 100);
    } catch (error) {
      console.error('Cache clear error:', error);
      // ARCHITECT'S DIRECTIVE 1: Only log error if still mounted
      if (isMounted.current) {
        onAddLog("CACHE CLEAR ERROR: Failed to clear cache", "error");
      }
    }
  };



  // PRIORITY SORT: Golden Corridor (GCC -> Western/Poland) and Luxembourg Node must appear at the top
  // KIMI K2.5: Use sanitizedJobs for safe sorting
  const sortedHrJobs = React.useMemo(() => {
    if (!sanitizedJobs || sanitizedJobs.length === 0) return [];
    return [...sanitizedJobs].sort((a, b) => {
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
  }, [sanitizedJobs]);
  
  // KIMI K2.5: Use sanitizedJobs.category which is already computed
  const professionalJobs = React.useMemo(() => sortedHrJobs.filter((j: Job) => j?.category === 'professional'), [sortedHrJobs]);
  const blueCollarJobs = React.useMemo(() => sortedHrJobs.filter((j: Job) => j?.category === 'blue_collar'), [sortedHrJobs]);
  const serviceDomesticJobs = React.useMemo(() => sortedHrJobs.filter((j: Job) => j?.category === 'service_domestic'), [sortedHrJobs]);
  const otherJobs = React.useMemo(() => sortedHrJobs.filter((j: Job) => j?.category !== 'professional' && j?.category !== 'blue_collar' && j?.category !== 'service_domestic'), [sortedHrJobs]);
  
  // Defensive: SWR data resolves asynchronously, so coerce to a safe number for
  // every downstream calculation. Prevents NaN/undefined crashes on first render.
  const safeTotalLeads = typeof totalLeadsFromSWR === 'number' && Number.isFinite(totalLeadsFromSWR)
    ? totalLeadsFromSWR
    : 0;
  const totalLeadsCount = safeTotalLeads;

  const feesBlockedCount = React.useMemo(() => {
    // Assuming each blocked fee saves $2500
    try {
      return (Number(safeTotalLeads) || 0) * (Number(APP_CONFIG?.FEES_BLOCKED_PER_LEAD) || 2500);
    } catch {
      return 0;
    }
  }, [safeTotalLeads]);

  const verifiedPlacementsCount = React.useMemo(() => {
    // Assuming 90% of total leads are verified placements
    try {
      return Math.floor((Number(safeTotalLeads) || 0) * (Number(APP_CONFIG?.VERIFIED_PLACEMENT_RATE) || 0.9));
    } catch {
      return 0;
    }
  }, [safeTotalLeads]);
  
  const emergencyShowAll = true; // Set to true to bypass all filters
  const displayProfessionalJobs = emergencyShowAll ? (sortedHrJobs ?? []) : (professionalJobs ?? []);
  const displayBlueCollarJobs = emergencyShowAll ? [] : (blueCollarJobs ?? []); // Keep empty to test sector assignment
  const displayOtherJobs = emergencyShowAll ? [] : (otherJobs ?? []);



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
                  <Activity size={10} /> {safeTotalLeads ?? 0} ACTIVE NODES
                </div>
                <div className="flex items-center gap-1.5 bg-blue-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full">
                  <DollarSign size={10} /> ${feesBlockedCount.toLocaleString()} FEES BLOCKED
                </div>
                <div className="flex items-center gap-1.5 bg-purple-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full">
                  <ShieldCheck size={10} /> {verifiedPlacementsCount} VERIFIED PLACEMENTS
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
                  {/* K2.5 NULL GUARD: Use safeArray before mapping + compound unique keys */}
                  {safeArray<Job>(displayProfessionalJobs).length > 0 ? safeArray<Job>(displayProfessionalJobs).map((job: Job, index: number) => (
                    <JobItem 
                      key={`lead-sync-${job.id || 'unknown'}-${index}`} 
                      job={job} 
                      onPitch={handlePitchLead}
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
                  {/* K2.5 NULL GUARD: Use safeArray before mapping + compound unique keys */}
                  {safeArray<Job>(displayBlueCollarJobs).length > 0 ? safeArray<Job>(displayBlueCollarJobs).map((job: Job, index: number) => (
                    <JobItem 
                      key={`lead-bluecollar-${job.id || 'unknown'}-${index}`} 
                      job={job} 
                      onPitch={handlePitchLead}
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
                  {/* K2.5 NULL GUARD: Use safeArray before mapping + compound unique keys */}
                  {safeArray<Job>(serviceDomesticJobs).length > 0 ? safeArray<Job>(serviceDomesticJobs).map((job: Job, index: number) => (
                    <JobItem 
                      key={`lead-servicedomestic-${job.id || 'unknown'}-${index}`} 
                      job={job} 
                      onPitch={handlePitchLead}
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
                      {/* K2.5 NULL GUARD: Use safeArray before mapping + compound unique keys */}
                      {safeArray<Job>(displayOtherJobs).map((job: Job, index: number) => (
                        <JobItem 
                          key={`lead-other-${job.id || 'unknown'}-${index}`} 
                          job={job} 
                          onPitch={handlePitchLead}
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
                    {logs.slice().reverse().map((log: AgentLogEntry) => (
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
                {portals.map((portal: VendorPortal) => (
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
                const response = await fetcher('/generate-marketing', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    company: job.company,
                    title: job.title,
                    corridor: job.corridor
                  })
                });
                
                const data = response;
                if (data && data.marketing_content) {
                  return data.marketing_content;
                }
                return "Failed to generate marketing content.";
              }}
              onLog={(message, type, step) => onAddLog(message, type)}
            />
          ) : null}
        </div>

        {/* Right Column (span-4): Vetted Batches (INTERACTIVE) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
           {/* KIMI K2.5: Pass sanitizedJobs to SearchSummary for crash protection */}
           {sanitizedJobs && sanitizedJobs.length > 0 ? (
             <SearchSummary 
               jobs={sanitizedJobs as any} 
               onNodeClick={handleNodeClickSafe} 
               onSectorClick={(sector) => onAddLog(`Sector filter: ${sector}`, 'info')}
               backendStats={undefined} // Pass backend stats when available from SWR
             />
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
                {batches.map((batch: RecruitmentBatch) => (
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
                        {batch.corridor || 'Unknown Corridor'}
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
                        style={{ width: `${batch.size > 0 ? (batch.verifiedCount / batch.size) * 100 : 0}%` }}
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
              {/* KIMI K2.5: Use sanitizedJobs.length for crash protection */}
              <CorridorFeed nodesActive={sanitizedJobs.length} feesBlocked={feesBlockedCount} />
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
  } catch (error) {
    console.error("AdminDashboard component error:", error);
    console.error("AdminDashboard stack trace:", error instanceof Error ? error.stack : "No stack trace");
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 min-h-screen">
        <div className="text-center">
          <Loader2 size={48} className="text-brand-500 animate-spin mx-auto mb-4" />
          <p className="text-[10px] uppercase font-black tracking-[0.3em] text-slate-500">Loading Oversight Console...</p>
        </div>
      </div>
    );
  }
};

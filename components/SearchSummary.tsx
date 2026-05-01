
import React from 'react';
import { Job, getJobLocationString } from '../types';
import { Globe, MapPin, Zap, Users, Briefcase, ChevronRight, Loader2, DollarSign, ShieldCheck } from 'lucide-react';
import { sanitizeRegionName, safeNumber, safeArray } from '../utils/sanitize';
import { categorizeJob, JobSector } from '../utils/jobCategorization';

interface SearchSummaryProps {
  jobs: Job[];
  onNodeClick?: (region: string, category?: 'All' | 'blue_collar' | 'professional' | 'service_domestic', keyword?: string) => void;
  onSectorClick?: (sector: string) => void;
  regionJobCounts?: Record<string, { total: number; blue_collar: number; professional: number; service_domestic: number }>;
  pendingCount?: number;
}

export const SearchSummary: React.FC<SearchSummaryProps> = ({ jobs, onNodeClick, onSectorClick, regionJobCounts, pendingCount = 0 }) => {
  const mappedRegionJobCounts = React.useMemo(() => {
    if (!jobs) return {};
    const counts: Record<string, { total: number; blue_collar: number; professional: number; service_domestic: number }> = {
      'Dubai Hub': { total: 0, blue_collar: 0, professional: 0, service_domestic: 0 },
      'Premium Node': { total: 0, blue_collar: 0, professional: 0, service_domestic: 0 },
      'EU-Central (Germany)': { total: 0, blue_collar: 0, professional: 0, service_domestic: 0 },
      'UK-Northern Corridor': { total: 0, blue_collar: 0, professional: 0, service_domestic: 0 },
      'Western Corridor': { total: 0, blue_collar: 0, professional: 0, service_domestic: 0 },
      'Global Corridor': { total: 0, blue_collar: 0, professional: 0, service_domestic: 0 }
    };

    jobs.forEach(job => {
      if (!job) return;
      const loc = getJobLocationString(job.location).toLowerCase();
      const category = job.category?.toLowerCase() || 'professional';
      
      // Updated sector mapping to include service_domestic
      let sectorKey: 'blue_collar' | 'professional' | 'service_domestic';
      if (category.includes('blue')) {
        sectorKey = 'blue_collar';
      } else if (category.includes('service')) {
        sectorKey = 'service_domestic';
      } else {
        sectorKey = 'professional';
      }

      // LOGIC: Map specific nodes to Main Corridors
      let corridor = 'Global Corridor';

      if (loc.includes('uae') || loc.includes('qatar') || loc.includes('dubai') || loc.includes('abu dhabi') || loc.includes('gcc')) {
        corridor = 'Dubai Hub';
      } else if (loc.includes('luxembourg')) {
        corridor = 'Premium Node';
      } else if (loc.includes('germany') || loc.includes('berlin') || loc.includes('deutschland') || loc.includes('munich') || loc.includes('deu')) {
        corridor = 'EU-Central (Germany)';
      } else if (loc.includes('uk') || loc.includes('london') || loc.includes('united kingdom') || loc.includes('manchester')) {
        corridor = 'UK-Northern Corridor';
      } else if (loc.includes('canada') || loc.includes('usa') || loc.includes('toronto') || loc.includes('poland') || loc.includes('europe')) {
        corridor = 'Western Corridor';
      }

      if (counts[corridor]) {
        counts[corridor].total++;
        counts[corridor][sectorKey]++;
      }
    });

    return counts;
  }, [jobs]);

  const stats = React.useMemo(() => {
    const statsArray = Object.entries(mappedRegionJobCounts)
      .filter(([_, data]) => (data as any).total > 0)
      .sort((a, b) => (b[1] as any).total - (a[1] as any).total);
    
    // Stats Array Validation: Check both structures
    if (!statsArray || !Array.isArray(statsArray)) {
      console.warn(' [VALIDATION]: stats array is not valid, using fallback');
      return [];
    }
    
    return statsArray;
  }, [mappedRegionJobCounts]);

  // KIMI K2.5 DATA SANITIZER: Force schema on stats array
  interface SanitizedStat {
    corridor_name: string;
    total: number;
    blue_collar: number;
    professional: number;
    service: number;
  }

  const sanitizedStats = React.useMemo(() => {
    if (!stats || !Array.isArray(stats)) return [];
    
    return stats
      .filter((item): item is [string, any] => {
        // Filter corrupted nodes: must be array tuple with valid data
        if (!item || typeof item !== 'object') return false;
        if (!Array.isArray(item)) return false;
        if (item.length < 2) return false;
        const [key, data] = item;
        if (typeof key !== 'string') return false;
        if (!data || typeof data !== 'object') return false;
        return true;
      })
      .map(([corridor_name, data]): SanitizedStat => {
        // Force schema: every field MUST exist with fallback defaults
        return {
          corridor_name: typeof corridor_name === 'string' ? corridor_name : '',
          total: safeNumber(data?.total, 0),
          blue_collar: safeNumber(data?.blue_collar, 0),
          professional: safeNumber(data?.professional, 0),
          service: safeNumber(data?.service_domestic || data?.service, 0)
        };
      })
      .filter(stat => stat.corridor_name !== ''); // Remove items with empty corridor names
  }, [stats]);

  const sectorCounts = React.useMemo(() => {
    return Object.values(mappedRegionJobCounts).reduce((acc: { blueCollarCount: number; professionalCount: number; serviceDomesticCount: number }, curr: any) => ({
      blueCollarCount: acc.blueCollarCount + (curr.blue_collar || 0),
      professionalCount: acc.professionalCount + (curr.professional || 0),
      serviceDomesticCount: acc.serviceDomesticCount + (curr.service_domestic || 0)
    }), { blueCollarCount: 0, professionalCount: 0, serviceDomesticCount: 0 });
  }, [mappedRegionJobCounts]);

  const sectorDistribution = React.useMemo(() => {
    if (!jobs) return [];
    const sectors: Record<JobSector, number> = {
      'Logistics': 0,
      'IT & Digital': 0,
      'Manufacturing': 0,
      'Healthcare': 0,
      'Service & Domestic': 0,
      'Other': 0
    };

    jobs.forEach(job => {
      const sector = categorizeJob(job);
      sectors[sector]++;
    });

    return Object.entries(sectors)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [jobs]);

  // STRIKE 2: Logic/Render Separation - Calculate Ethical Impact OUTSIDE JSX with safeNumber
  const totalLeads = safeNumber(jobs?.length, 0);
  const verifiedLeads = jobs?.filter(j => j?.vetted === true || j?.status === 'verified') || [];
  const totalVerified = safeNumber(verifiedLeads?.length, 0);
  // SILENT FAILURE PROTECTION: If calculation fails, defaults to 0
  const feesBlocked = safeNumber(totalVerified, 0) * 2500;
  const formattedFeesBlocked = React.useMemo(() => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(feesBlocked);
    } catch {
      return '$0'; // Silent fallback
    }
  }, [feesBlocked]);

  // STRIKE 1: Null-Coalescing Fortress - Data Ready Check with Skeleton
  // KIMI K2.5: Use sanitizedStats instead of raw stats for safety
  const isDataReady = React.useMemo(() => {
    return sanitizedStats && sanitizedStats.length > 0 && totalLeads > 0;
  }, [sanitizedStats, totalLeads]);

  // KIMI K2.5: Guard against empty sanitized stats
  if (!sanitizedStats || sanitizedStats.length === 0) return null;

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 flex flex-col h-full space-y-6">
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Globe size={16} className="text-brand-500" />
            Hub Status: {jobs.length} Active Nodes
          </h2>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full animate-pulse">
              <Loader2 size={12} className="text-amber-500 animate-spin" />
              <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">{pendingCount} Pending Vetting</span>
            </div>
          )}
        </div>
        
        {/* STRIKE 1: Data Ready Check - Only render cards when data exists */}
        {isDataReady ? (
          <>
            {/* STRIKE 2: Ethical Impact Card - Now safely calculated outside JSX */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <ShieldCheck size={24} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-100">Ethical Impact (Fees Blocked)</p>
                    <p className="text-2xl font-black">{formattedFeesBlocked}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-emerald-100">{totalVerified} Verified Placements</p>
                  <p className="text-[8px] text-emerald-200">Based on avg. $2,500 exploitative fee blocked</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* STRIKE 1: Skeleton Loader while data loads */
          <div className="bg-slate-100 rounded-2xl p-5 shadow-lg mb-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200 rounded-xl w-12 h-12"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-32"></div>
                  <div className="h-6 bg-slate-300 rounded w-24"></div>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="h-3 bg-slate-200 rounded w-20"></div>
                <div className="h-2 bg-slate-200 rounded w-28"></div>
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-hide">
          {/* KIMI K2.5: Use sanitizedStats with forced schema */}
          {sanitizedStats.length > 0 ? (
            sanitizedStats.map((stat, index) => {
              // KIMI K2.5: Schema is guaranteed - no need for excessive safeNumber calls
              const total = stat.total;
              const bcCount = stat.blue_collar;
              const profCount = stat.professional;
              const serviceDomesticCount = stat.service;
              
              // K2.5: Sanitize region name before display
              const cleanRegion = sanitizeRegionName(stat.corridor_name);

              // APRIL 30: Unique key using index to prevent duplicate key errors
              return (
                <div key={`${stat.corridor_name}-${index}`} className="space-y-2">
                  <button 
                    onClick={() => onNodeClick?.(cleanRegion)}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-brand-500 hover:bg-brand-50 transition-all group active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-white rounded-lg shadow-sm group-hover:text-brand-600 transition-colors text-slate-400">
                        <MapPin size={12} />
                      </div>
                      <span className="text-xs font-bold text-slate-700 group-hover:text-brand-700">{cleanRegion}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-brand-600">{total}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Nodes</span>
                    </div>
                  </button>
                  
                  <div className="grid grid-cols-3 gap-2 px-1">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onNodeClick?.(cleanRegion, 'blue_collar'); }}
                      className="flex items-center justify-between p-2 bg-brand-50/50 rounded-lg border border-brand-100/50 hover:border-brand-500 hover:bg-brand-100/50 transition-all active:scale-[0.95]"
                    >
                      <div className="flex items-center gap-1.5">
                        <Zap size={10} className="text-brand-600" />
                        <span className="text-[8px] font-black text-slate-500 uppercase">Blue Collar</span>
                      </div>
                      <span className="text-[10px] font-black text-brand-600">{bcCount}</span>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onNodeClick?.(cleanRegion, 'professional'); }}
                      className="flex items-center justify-between p-2 bg-emerald-50/50 rounded-lg border border-emerald-100/50 hover:border-emerald-500 hover:bg-emerald-100/50 transition-all active:scale-[0.95]"
                    >
                      <div className="flex items-center gap-1.5">
                        <Users size={10} className="text-emerald-600" />
                        <span className="text-[8px] font-black text-slate-500 uppercase">Professional</span>
                      </div>
                      <span className="text-[10px] font-black text-emerald-600">{profCount}</span>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onNodeClick?.(cleanRegion, 'service_domestic'); }}
                      className="flex items-center justify-between p-2 bg-cyan-50/50 rounded-lg border border-cyan-100/50 hover:border-cyan-500 hover:bg-cyan-100/50 transition-all active:scale-[0.95]"
                    >
                      <div className="flex items-center gap-1.5">
                        <Briefcase size={10} className="text-cyan-600" />
                        <span className="text-[8px] font-black text-slate-500 uppercase">Service</span>
                      </div>
                      <span className="text-[10px] font-black text-cyan-600">{serviceDomesticCount}</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-300 py-4">
              <Zap size={24} className="opacity-20 mb-2" />
              <p className="text-[10px] uppercase font-black tracking-widest">No Active Nodes</p>
            </div>
          )}
        </div>
      </div>

      {/* Sector Distribution Deep-Dive */}
      <div className="space-y-4 pt-4 border-t border-slate-100">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Briefcase size={16} className="text-brand-500" />
          Sector Distribution (Click to Filter)
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {sectorDistribution.map(([sector, count]) => (
            <button 
              key={sector} 
              onClick={() => onSectorClick?.(sector)}
              className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl group hover:bg-brand-50 hover:border-brand-200 transition-all text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 group-hover:scale-150 transition-transform"></div>
                <span className="text-xs font-black text-slate-700 group-hover:text-brand-700 uppercase tracking-wider">{sector}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 group-hover:text-brand-600">({count})</span>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
              </div>
            </button>
          ))}
        </div>
      </div>

      
      <div className="pt-4 border-t border-slate-100 mt-auto">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase">Verified Active Nodes</span>
          <span className="text-sm font-black text-slate-900">{jobs.length}</span>
        </div>
      </div>
    </div>
  );
};

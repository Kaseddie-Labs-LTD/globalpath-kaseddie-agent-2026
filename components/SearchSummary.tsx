
import React from 'react';
import { Job, getJobLocationString } from '../types';
import { Globe, MapPin, Zap, Users, Briefcase, ChevronRight, Loader2 } from 'lucide-react';
import { sanitizeRegionName, safeNumber, safeArray } from '../utils/sanitize';

interface SearchSummaryProps {
  jobs: Job[];
  onNodeClick?: (region: string, category?: 'All' | 'blue_collar' | 'professional' | 'service_domestic', keyword?: string) => void;
  onSectorClick?: (sector: string) => void;
  regionJobCounts?: Record<string, { total: number; blue_collar: number; professional: number; service_domestic: number }>;
  pendingCount?: number;
}

export const SearchSummary: React.FC<SearchSummaryProps> = ({ jobs, onNodeClick, onSectorClick, regionJobCounts, pendingCount = 0 }) => {
  const mappedRegionJobCounts = React.useMemo(() => {
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

  const sectorCounts = React.useMemo(() => {
    return Object.values(mappedRegionJobCounts).reduce((acc: { blueCollarCount: number; professionalCount: number; serviceDomesticCount: number }, curr: any) => ({
      blueCollarCount: acc.blueCollarCount + (curr.blue_collar || 0),
      professionalCount: acc.professionalCount + (curr.professional || 0),
      serviceDomesticCount: acc.serviceDomesticCount + (curr.service_domestic || 0)
    }), { blueCollarCount: 0, professionalCount: 0, serviceDomesticCount: 0 });
  }, [mappedRegionJobCounts]);

  const sectorDistribution = React.useMemo(() => {
    const sectors: Record<string, number> = {
      'Logistics': 0,
      'IT & Digital': 0,
      'Manufacturing': 0,
      'Healthcare': 0,
      'Service & Domestic': 0,
      'Other': 0
    };

    jobs.forEach(job => {
      const title = (job.title || '').toLowerCase();
      const description = (job.description || '').toLowerCase();
      const company = (job.company || '').toLowerCase();
      const loc = getJobLocationString(job.location).toLowerCase();
      
      // K2.5 OMEGA: Explicit Service & Domestic company mapping
      const domesticCompanies = [
        'the tidy troupe',
        'authentic services', 
        'cleaning',
        'domestic'
      ];
      const isDomesticCompany = domesticCompanies.some(dc => company.includes(dc));
      
      // Service & Domestic detection (title/description OR company name)
      if (title.includes('cleaner') || title.includes('housekeeper') || title.includes('maid') || title.includes('nanny') || title.includes('domestic') || title.includes('janitor') ||
          description.includes('cleaner') || description.includes('housekeeper') || description.includes('maid') || description.includes('nanny') || description.includes('domestic') || description.includes('janitor') ||
          isDomesticCompany) {
        sectors['Service & Domestic']++;
      }
      // Only deep-dive into Western Corridor (Poland/Canada/etc) or all if preferred
      // User specifically mentioned "those 100 Polish leads"
      else if (title.includes('driver') || title.includes('warehouse') || title.includes('logistics') || title.includes('supply') || title.includes('forklift') || title.includes('delivery') ||
          description.includes('driver') || description.includes('warehouse') || description.includes('logistics') || description.includes('supply') || description.includes('forklift') || description.includes('delivery')) {
        sectors['Logistics']++;
      } else if (title.includes('software') || title.includes('developer') || title.includes('it') || title.includes('digital') || title.includes('tech') || title.includes('engineer') ||
                 description.includes('software') || description.includes('developer') || description.includes('it') || description.includes('digital') || description.includes('tech') || description.includes('engineer')) {
        sectors['IT & Digital']++;
      } else if (title.includes('factory') || title.includes('production') || title.includes('manufacturing') || title.includes('operator') || title.includes('technician') || title.includes('machine') ||
                 description.includes('factory') || description.includes('production') || description.includes('manufacturing') || description.includes('operator') || description.includes('technician') || description.includes('machine')) {
        sectors['Manufacturing']++;
      } else if (title.includes('nurse') || title.includes('care') || title.includes('health') || title.includes('medical') || title.includes('hospital') ||
                 description.includes('nurse') || description.includes('care') || description.includes('health') || description.includes('medical') || description.includes('hospital')) {
        sectors['Healthcare']++;
      } else {
        sectors['Other']++;
      }
    });

    return Object.entries(sectors)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [jobs]);

  // V4.5 ABSOLUTE GUARD: Prevent render if stats is invalid
  if (!stats || !Array.isArray(stats)) return null;

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
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-hide">
          {safeArray<[string, any]>(stats).length > 0 ? (
            safeArray<[string, any]>(stats).map(([region, data]) => {
              // K2.5 DEFENSIVE RENDER: Hard fallback to 0 for all numeric properties
              const total = safeNumber(typeof data === 'number' ? data : (data as any)?.total, 0);
              const bcCount = safeNumber((data as any)?.blue_collar, 0);
              const profCount = safeNumber((data as any)?.professional, 0);
              const serviceDomesticCount = safeNumber((data as any)?.service_domestic, 0);
              
              // K2.5: Sanitize region name before display
              const cleanRegion = sanitizeRegionName(region);

              return (
                <div key={region} className="space-y-2">
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

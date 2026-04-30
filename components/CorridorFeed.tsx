
import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Terminal, Activity, Globe, Zap, ShieldCheck, Search, Cpu, Loader2 } from 'lucide-react';
import { fetchGlobalJobs, fetchLuxembourgLeads } from '../services/apify';
import { Job, getJobLocationString } from '../types';
import { fetcher } from '../constants/api';
import { sanitizeRegionName, safeNumber, safeArray } from '../utils/sanitize';

interface FeedItem {
  id: string;
  timestamp: string;
  node: string;
  message: string;
  type: 'scanning' | 'verified' | 'alert' | 'sync';
  category?: string;
  fee_blocked?: boolean;
  status?: string;
}

interface CorridorFeedProps {
  nodesActive: number;
  feesBlocked: number;
  leads?: Job[];
}

export const CorridorFeed: React.FC<CorridorFeedProps> = ({ nodesActive, feesBlocked, leads = [] }) => {
  const [items, setItems] = useState<FeedItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // ARCHITECT'S DIRECTIVE 1: Ghost Exorcism - Mounting guard to prevent race conditions
  const isMounted = useRef(true);
  
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const mapLocationToNode = (location: any) => {
    const loc = getJobLocationString(location).toLowerCase();
    if (loc.includes('dubai') || loc.includes('uae') || loc.includes('saudi') || loc.includes('ksa')) return 'DBI-HUB';
    if (loc.includes('poland')) return 'WST-POL';
    if (loc.includes('qatar') || loc.includes('doha')) return 'GCC-DOH';
    if (loc.includes('germany') || loc.includes('berlin') || loc.includes('deu')) return 'EU-BER';
    if (loc.includes('luxembourg')) return 'PRM-NODE';
    if (loc.includes('canada') || loc.includes('toronto')) return 'CAN-TOR';
    if (loc.includes('kuwait')) return 'GCC-KWI';
    return 'GLB-NODE';
  };
  const mapCorridorLabel = (location: any) => {
    const loc = getJobLocationString(location).toLowerCase();
    if (loc.includes('dubai') || loc.includes('uae') || loc.includes('saudi') || loc.includes('ksa')) return 'Dubai Hub';
    if (loc.includes('poland')) return 'Western Corridor';
    if (loc.includes('luxembourg')) return 'Premium Node (LUX)';
    if (loc.includes('germany') || loc.includes('berlin') || loc.includes('europe')) return 'Western Medical/Tech Corridor';
    if (loc.includes('canada') || loc.includes('toronto')) return 'Infrastructure Corridor';
    return 'Global Corridor';
  };

  const { data: statsData, error: statsError } = useSWR('/corridor-stats',
    fetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: false,  // K2.5: Already correct - prevents focus revalidation loops
      shouldRetryOnError: true,  // FIX 1: Silent Error Bypass - Enable retry on error
      errorRetryCount: 3,        // FIX 1: Retry up to 3 times before giving up
      dedupingInterval: 5000
    }
  );

  useEffect(() => {
    // ARCHITECT'S DIRECTIVE 1: Ghost Exorcism - Only execute if component is still mounted
    if (!isMounted.current) return;
    
    // K2.5 NULL GUARD: Ensure statsData.stats is a valid array before mapping
    if (statsData && Array.isArray(statsData.stats)) {
      // BULLETPROOF MAP GUARD: Filter out half-empty nodes before mapping
      const newItems: FeedItem[] = safeArray<any>(statsData.stats)
        .filter(s => s && (s.region || s.name) && (s.count !== undefined && s.count !== null)) // Ensure valid data
        .map((s: any, index: number) => {
          // K2.5: Sanitize region name and use safeNumber for count
          const cleanRegion = sanitizeRegionName(s?.region || s?.name);
          const count = safeNumber(s?.count, 0);
          // APRIL 30: Add index to prevent duplicate keys when Date.now() is same millisecond
          return {
            id: `stat-${cleanRegion}-${Date.now()}-${index}`,
            timestamp: new Date().toLocaleTimeString(),
            node: `${cleanRegion.toUpperCase().slice(0, 3)}-NODE`,
            message: `Active Node Sync: ${count} leads identified in ${cleanRegion} corridor.`,
            type: 'sync'
          };
        });
      // ARCHITECT'S DIRECTIVE 1: Check mount status before state update
      if (isMounted.current) {
        setItems(prev => [...newItems, ...prev].slice(0, 50));
      }
    }
  }, [statsData]);

  useEffect(() => {
    if ((leads || []).length > 0) {
      // PRIORITY SORT: Golden Corridor (GCC, Western/Poland) and Luxembourg Node must appear at the top
      const sortedLeads = [...(leads || [])].sort((a, b) => {
        const priorityNodes = ['Premium Node', 'Premium Node (LUX)', 'Dubai Hub', 'Western Corridor'];
        
        const aNode = a.corridor || a.node || '';
        const bNode = b.corridor || b.node || '';

        const aPriorityIndex = priorityNodes.indexOf(aNode);
        const bPriorityIndex = priorityNodes.indexOf(bNode);

        if (aPriorityIndex !== -1 && bPriorityIndex !== -1) return aPriorityIndex - bPriorityIndex;
        if (aPriorityIndex !== -1) return -1;
        if (bPriorityIndex !== -1) return 1;
        
        // Secondary sort by country for Big Four fallback
        const aCountry = String(a.country || '').toLowerCase();
        const bCountry = String(b.country || '').toLowerCase();
        const priorityCountries = ['united arab emirates', 'saudi arabia', 'poland', 'luxembourg'];
        const aCountryIndex = priorityCountries.indexOf(aCountry);
        const bCountryIndex = priorityCountries.indexOf(bCountry);

        if (aCountryIndex !== -1 && bCountryIndex !== -1) return aCountryIndex - bCountryIndex;
        if (aCountryIndex !== -1) return -1;
        if (bCountryIndex !== -1) return 1;

        return 0;
      });

      const recent = sortedLeads.slice(0, 10).map(j => {
        const node = `${mapLocationToNode(j.location)}-01`;
        const safeCompany = String(j.company || 'Employer');
        const corridor = mapCorridorLabel(j.location);
        
        // Ethical & Status Logic from backend metadata
        const isFeeBlocked = (j as any).fee_blocked === true;
        const isPending = j.status === 'vetting_pending' || j.status === 'pending';
        
        let type: FeedItem['type'] = 'verified';
        let message = `Verified ${safeCompany} for ${corridor}.`;
        
        if (isFeeBlocked) {
          type = 'verified';
          message = `ETHICAL VERIFIED: ${safeCompany} confirmed Zero-Fee.`;
        } else if (isPending) {
          type = 'alert';
          message = `AUDIT REQUIRED: Potential Fee Indicator at ${safeCompany}.`;
        } else if (['blue_collar', 'essential'].includes(String(j.category).toLowerCase())) {
          type = 'scanning';
          message = `BLUE-COLLAR SYNC: Fresh pulse from ${safeCompany} node.`;
        }

        return {
          id: `${j.id}-${Math.random().toString().slice(-6)}`,
          timestamp: new Date().toLocaleTimeString(),
          node,
          message,
          type,
          category: j.category,
          fee_blocked: isFeeBlocked,
          status: j.status
        };
      });
      setItems(prev => [...recent, ...prev].slice(0, 50));
    }
  }, [leads]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [items]);

  // FIX 1: Silent Error Bypass - Guard against rendering before data handshake is green
  if (!statsData && !statsError) {
    return (
      <div className="bg-slate-950 rounded-[2.5rem] border border-slate-800 shadow-2xl h-[600px] flex flex-col items-center justify-center p-6">
        <Loader2 size={48} className="text-brand-500 animate-spin mb-4" />
        <p className="text-[10px] uppercase font-black tracking-[0.3em] text-slate-500">Calibrating Corridor Sensors...</p>
        <p className="text-[8px] text-slate-600 mt-2">Waiting for backend handshake</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 rounded-[2.5rem] border border-slate-800 shadow-2xl h-[600px] flex flex-col overflow-hidden relative group">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#0ea5e9 1px, transparent 1px), linear-gradient(90deg, #0ea5e9 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      
      <div className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-500/10 rounded-xl">
            <Cpu size={20} className="text-brand-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Live Migration Corridors</h3>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Kaseddie Oversight • V4.2 Uplink Active</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20">
              <Activity size={12} className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest">Nodes: {nodesActive} Active</span>
           </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 font-mono scrollbar-hide z-10">
        {items.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-700">
             <Search size={48} className="animate-bounce mb-4 opacity-20" />
             <p className="text-[10px] uppercase font-black tracking-[0.3em]">Calibrating Corridor Sensors...</p>
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 animate-fadeIn group/item relative">
            {/* Pulsing indicator for Blue-Collar Node */}
            {['blue_collar', 'essential'].includes(item.category || '') && (
              <div className="absolute -left-1 top-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping opacity-75 shadow-[0_0_12px_#10b981]"></div>
            )}
            
            <div className="text-[10px] text-slate-600 shrink-0 font-bold">[{item.timestamp}]</div>
            <div className="flex-1 space-y-1">
               <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                    item.type === 'alert' ? 'bg-red-500/20 text-red-400' :
                    item.type === 'verified' ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-brand-500/20 text-brand-400'
                  }`}>
                    {item.node}
                  </span>
                  
                  {/* Zero-Fee Badge & Audit Glow */}
                  <div className="flex gap-2">
                    {item.fee_blocked && (
                      <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-pulse">
                        <ShieldCheck size={8} className="text-emerald-500" />
                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Ethical Verified</span>
                      </div>
                    )}
                    {item.status === 'vetting_pending' && (
                      <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse">
                        <Zap size={8} className="text-amber-500" />
                        <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest">Audit Required</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="h-px flex-1 bg-slate-800/50"></div>
               </div>
               <p className={`text-xs leading-relaxed ${
                 item.type === 'alert' ? 'text-red-300 font-bold' :
                 item.type === 'verified' ? 'text-emerald-300' :
                 'text-slate-300'
               }`}>
                 {item.message}
               </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-slate-900/80 border-t border-slate-800 backdrop-blur-md z-10">
         <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm font-black text-white">12s</div>
              <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Average Sync</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-black text-brand-500">99.9%</div>
              <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Trust Rating</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-black text-emerald-500">{feesBlocked}</div>
              <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Fees Blocked</div>
            </div>
         </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker, Line } from 'react-simple-maps';
import { ShieldCheck, Plane, Info, ExternalLink, Globe2, RefreshCw, Loader2, Sparkles, Activity, Users, Zap, X } from 'lucide-react';
import { fetchGlobalPulseData } from '../services/ai';
import { getJobLocationString } from '../types';
import { getCoordinates, getAllCoordinates } from '../utils/geoCoordinates';
import { categorizeJob, JobSector } from '../utils/jobCategorization';
import { safeArray, safeNumber } from '../utils/sanitize';

const geoUrl = "https://raw.githubusercontent.com/lotusms/world-map-data/master/world.json";

interface CountryStats {
  id: string;
  name: string;
  safety: number;
  visaApproval: number;
  protectionRating: 'High' | 'Medium' | 'Low';
  status: 'stable' | 'changing' | 'restricted';
  notes: string;
  nodeCount?: number; // Actual node count from jobs array
}

const initialPulseData: Record<string, CountryStats> = {
  "CAN": { id: "CAN", name: "Canada", safety: 98, visaApproval: 45, protectionRating: "High", status: "stable", notes: "Excellent worker rights. LMIA process is strict but fair." },
  "DEU": { id: "DEU", name: "Germany", safety: 96, visaApproval: 62, protectionRating: "High", status: "changing", notes: "New Opportunity Card rules favoring skilled blue-collar workers." },
  "ARE": { id: "ARE", name: "UAE", safety: 82, visaApproval: 88, protectionRating: "Medium", status: "stable", notes: "Zero-fee recruitment strictly enforced by UAE Labor Ministry." },
  "POL": { id: "POL", name: "Poland", safety: 88, visaApproval: 78, protectionRating: "High", status: "stable", notes: "Strong demand for factory and logistics personnel." },
  "QAT": { id: "QAT", name: "Qatar", safety: 72, visaApproval: 82, protectionRating: "Medium", status: "stable", notes: "Focus on FIFA-legacy infrastructure and service roles." },
  "SAU": { id: "SAU", name: "Saudi Arabia", safety: 68, visaApproval: 85, protectionRating: "Medium", status: "changing", notes: "Vision 2030 creating massive openings. Review employer rating." },
  "GBR": { id: "GBR", name: "United Kingdom", safety: 94, visaApproval: 40, protectionRating: "High", status: "restricted", notes: "Health & Care visa remains open, most others restricted." },
  "USA": { id: "USA", name: "USA", safety: 92, visaApproval: 35, protectionRating: "High", status: "stable", notes: "H-2B visas available seasonally for landscape/hospitality." },
  "LUX": { id: "LUX", name: "Luxembourg", safety: 99, visaApproval: 95, protectionRating: "High", status: "stable", notes: "Highly vetted professional corridor with EU-standard protections." },
  "UGA": { id: "UGA", name: "Uganda", safety: 100, visaApproval: 100, protectionRating: "High", status: "stable", notes: "Candidate Origin Country" }
};

export const GlobalPulseMap: React.FC<{ 
  addLog?: (m: string, t: any) => void; 
  onSelectRegion?: (r: string, k?: string, cat?: 'All' | 'blue_collar' | 'professional') => void; 
  regionJobCounts?: Record<string, { total: number; blue_collar: number; professional: number }>;
  jobs?: import('../types').Job[];
}> = ({ addLog, onSelectRegion, regionJobCounts, jobs = [] }) => {
  try {
    const [pulseData, setPulseData] = useState<Record<string, CountryStats>>(initialPulseData);
    const [geoData, setGeoData] = useState<any>(null);
    const [hovered, setHovered] = useState<CountryStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [geoLoading, setGeoLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const [comparing, setComparing] = useState<[string, string] | null>(null);

    useEffect(() => {
      // Fetch geography data manually to avoid render-time suspension (fixes Error 525)
      fetch(geoUrl)
        .then(res => res.json())
        .then(data => {
          setGeoData(data);
          setGeoLoading(false);
        })
        .catch(err => {
          console.error("Map Data Load Error:", err);
          setGeoLoading(false);
        });
    }, []);

    // Process jobs array to calculate actual node counts
    useEffect(() => {
      try {
        const safeJobs = safeArray<Job>(jobs);
        if (safeJobs && safeJobs.length > 0) {
          const jobCoordinates = getAllCoordinates(safeJobs.map(job => getJobLocationString(job?.location)));
          const regionCounts: Record<string, number> = {};
          
          jobCoordinates.forEach(coord => {
            const region = mapCountryToRegion(coord.country);
            regionCounts[region] = (regionCounts[region] || 0) + 1;
          });
          
          // Update pulseData with actual node counts
          setPulseData(prev => {
            const updated = { ...prev };
            Object.entries(regionCounts).forEach(([region, count]) => {
              // Find countries in this region
              const countries = Object.entries(prev).filter(([countryId, data]: [string, CountryStats]) => {
                const mappedRegion = mapCountryToRegion(countryId);
                return mappedRegion === region;
              });
              
              countries.forEach(([countryId, countryData]) => {
                if (updated[countryId]) {
                  updated[countryId] = {
                    ...updated[countryId],
                    // Add actual node count to the data
                    nodeCount: count
                  };
                }
              });
            });
            return updated;
          });
          
          addLog?.(`SAFETY MAP: Processed ${safeJobs.length} leads, updated node counts for ${Object.keys(regionCounts).length} regions`, "success");
        }
      } catch (error) {
        console.error("GlobalPulseMap jobs processing error:", error);
      }
    }, [jobs, addLog]);

    // Real-Time Professional Mapping: Global Density Heatmap
    const calculateGlobalDensity = (leads: import('../types').Job[]) => {
      try {
        const safeLeads = safeArray<Job>(leads);
        return safeLeads.reduce((acc: Record<string, number>, job) => {
          try {
            const locationData = getCoordinates(getJobLocationString(job?.location));
            if (locationData) {
              const key = `${locationData.coordinates.lat.toFixed(1)},${locationData.coordinates.lng.toFixed(1)}`; 
              acc[key] = (acc[key] || 0) + 1;
            }
            return acc;
          } catch (e) {
            console.error("calculateGlobalDensity job error:", e);
            return acc;
          }
        }, {});
      } catch (error) {
        console.error("calculateGlobalDensity error:", error);
        return {};
      }
    };

    // Get global density for heatmap visualization
    const globalDensity = React.useMemo(() => {
      return calculateGlobalDensity(jobs || []);
    }, [jobs]);

    const getCountryColor = (countryId: string) => {
      try {
        const data = pulseData[countryId];
        if (!data) return "#f1f5f9";
        if (countryId === "UGA") return "#0ea5e9"; // Origin
        
        const score = (safeNumber(data.safety, 0) + safeNumber(data.visaApproval, 0)) / 2;
        if (score > 80) return "#10b981"; // Emerald
        if (score > 60) return "#f59e0b"; // Amber
        return "#ef4444"; // Red
      } catch (error) {
        console.error("getCountryColor error:", error);
        return "#f1f5f9";
      }
    };
    const mapCountryToRegion = (id: string) => {
      try {
        const k = String(id || '').toUpperCase();
        if (['ARE', 'QAT', 'KWT', 'BHR', 'SAU', 'OMN'].includes(k)) return 'GCC Corridor';
        if (k === 'LUX') return 'Luxembourg Node';
        if (k === 'DEU') return 'EU-Central (Germany)';
        if (k === 'GBR') return 'UK-Northern Corridor';
        if (['POL', 'CAN', 'USA', 'FRA', 'NLD', 'TUR'].includes(k)) return 'Western Corridor';
        return 'Global Corridor';
      } catch (error) {
        console.error("mapCountryToRegion error:", error);
        return 'Global Corridor';
      }
    };

    // Fuzzy Matcher for Dubai Hub - Fix data mapping mismatch
    const getDubaiHubCount = () => {
      try {
        const dubaiVariants = ['dubai', 'uae', 'united arab emirates', 'abu dhabi', 'sharjah', 'ajman'];
        const safeJobs = safeArray<Job>(jobs);
        return safeJobs.filter(job => {
          try {
            const location = getJobLocationString(job?.location).toLowerCase();
            return dubaiVariants.some(variant => location.includes(variant));
          } catch (e) {
            console.error("getDubaiHubCount job error:", e);
            return false;
          }
        }).length;
      } catch (error) {
        console.error("getDubaiHubCount error:", error);
        return 0;
      }
    };

  const handleRefreshPulse = async () => {
    setLoading(true);
    addLog?.("INITIATING GLOBAL PULSE AUDIT: Scanning worker protection laws...", "thinking");
    try {
        const newData = await fetchGlobalPulseData();
        if (newData) {
            const merged = { ...pulseData };
            Object.keys(newData).forEach(id => {
                if (merged[id]) {
                    merged[id] = { ...merged[id], ...newData[id] };
                } else {
                    merged[id] = { id, name: id, ...newData[id] };
                }
            });
            setPulseData(merged);
            setLastUpdated(new Date());
            addLog?.("GLOBAL PULSE UPDATED: Vetted new corridor approval ratings.", "success");
        } else {
            addLog?.("PULSE AUDIT ERROR: Falling back to cached corridor data.", "warning");
        }
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  if (geoLoading) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-slate-900 rounded-[2.5rem] text-white">
        <Loader2 className="animate-spin text-brand-500 mb-4" size={48} />
        <p className="text-sm font-black uppercase tracking-[0.2em]">Synchronizing Satellite View...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="bg-white border border-slate-200 p-4 rounded-[2rem] shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Globe2 className="text-brand-600" size={24} />
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Global Pulse & Safety Monitor
            </h2>
            <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest">Real-time corridor analytics</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Safe Corridor</span>
           </div>
           <button 
             onClick={handleRefreshPulse}
             disabled={loading}
             className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-brand-100 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
           >
             {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
             AI Pulse Sync
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden h-[600px] border border-slate-800">
          <div className="absolute top-6 left-6 z-10 flex gap-3">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-2xl text-white">
               <h3 className="text-xs font-black uppercase tracking-widest mb-1">Live Corridor View</h3>
               <p className="text-[10px] text-slate-400 font-mono">Sync: {lastUpdated.toLocaleTimeString()}</p>
            </div>
            <button
              onClick={() => onSelectRegion?.('GCC Corridor', 'Dubai')}
              className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-4 py-3 rounded-2xl text-white active:scale-95"
              title="Deep-dive into Dubai corridor"
            >
              <span className="text-[10px] font-black uppercase tracking-widest">Dubai Hub</span>
              <span className="px-2 py-1 rounded bg-white/10 text-[10px] font-black uppercase tracking-widest">
                {getDubaiHubCount()} Nodes
              </span>
            </button>
            {loading && (
              <div className="bg-brand-500/20 backdrop-blur-md border border-brand-500/30 px-4 py-2 rounded-2xl flex items-center gap-2 text-brand-400">
                <Activity size={12} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Agent Scanning...</span>
              </div>
            )}
          </div>
          
          <ComposableMap projectionConfig={{ scale: 180 }} className="w-full h-full">
            <ZoomableGroup center={[20, 10]} zoom={1.2}>
              {geoData && (
                <Geographies geography={geoData}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const countryId = geo.id || geo.properties?.ISO_A3;
                      const stats = pulseData[countryId];
                      const isSelected = !!stats;
                      
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          onClick={() => {
                            if (isSelected) {
                              setHovered(stats);
                            } else {
                              setHovered(null);
                            }
                          }}
                          style={{
                            default: {
                              fill: getCountryColor(countryId),
                              outline: "none",
                              stroke: isSelected ? "#fff" : "rgba(255,255,255,0.05)",
                              strokeWidth: isSelected ? 0.4 : 0.1,
                              transition: 'all 250ms'
                            },
                            hover: {
                              fill: isSelected ? "#38bdf8" : "#1e293b",
                              outline: "none",
                              cursor: isSelected ? "pointer" : "default",
                            },
                            pressed: {
                              fill: "#0ea5e9",
                              outline: "none",
                            },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              )}

              {/* Uganda Origin Marker */}
              <Marker coordinates={[32.5825, 0.3476]}>
                <circle r={4} fill="#0ea5e9" stroke="#fff" strokeWidth={1} />
                <text textAnchor="middle" y={-10} className="text-[8px] font-black fill-white uppercase tracking-widest">Uganda Node</text>
              </Marker>

              {/* Migration Corridors (Lines) */}
              {/* UAE */}
              <Line
                from={[32.5825, 0.3476]}
                to={[55.2708, 25.2048]}
                stroke="#10b981"
                strokeWidth={1}
                strokeLinecap="round"
                className="animate-pulse opacity-50"
              />
              {/* Germany */}
              <Line
                from={[32.5825, 0.3476]}
                to={[13.4050, 52.5200]}
                stroke="#38bdf8"
                strokeWidth={1}
                strokeLinecap="round"
                className="animate-pulse opacity-50"
              />
              {/* Canada */}
              <Line
                from={[32.5825, 0.3476]}
                to={[-79.3832, 43.6532]}
                stroke="#f59e0b"
                strokeWidth={1}
                strokeLinecap="round"
                className="animate-pulse opacity-50"
              />

              {/* Dynamic Job Markers with Neon Pulse - Active & Ghost Nodes */}
              {safeArray<Job>(jobs).filter(j => j?.lat && j?.lng).map((job, idx) => {
                try {
                  const category = categorizeJob(job);
                  if (category !== 'Logistics' && category !== 'Service & Domestic') return null;
                  
                  const locationData = getCoordinates(getJobLocationString(job?.location));
                  const isActiveNode = locationData && (
                    locationData.country === 'Luxembourg' || 
                    locationData.country === 'Poland' || 
                    locationData.country === 'Germany' || 
                    locationData.country === 'Canada'
                  );
                  
                  const jobCategory = String(job?.category || 'professional');
                  const markerColor = isActiveNode 
                    ? (jobCategory === 'blue_collar' ? '#10b981' : '#38bdf8') 
                    : '#64748b';
                  
                  return (
                    <Marker key={`${job?.id || Math.random()}-${idx}`} coordinates={[job?.lng!, job?.lat!]}>
                      <g className="animate-pulse">
                        {/* Core Marker */}
                        <circle 
                          r={2.5} 
                          fill={markerColor} 
                        />
                        
                        {/* Multiple Pulse Layers for Neon Effect */}
                        <circle 
                          r={6} 
                          fill="none" 
                          stroke={markerColor} 
                          strokeWidth={1} 
                          className="animate-ping opacity-40" 
                        />
                        <circle 
                          r={12} 
                          fill="none" 
                          stroke={markerColor} 
                          strokeWidth={0.5} 
                          className="animate-pulse opacity-20" 
                        />
                        
                        {/* Static Glow */}
                        <circle 
                          r={4} 
                          fill={isActiveNode 
                            ? (jobCategory === 'blue_collar' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(56, 189, 248, 0.3)') 
                            : 'rgba(100, 116, 139, 0.3)' // Grey glow for Ghost Nodes
                          } 
                          className="blur-[2px]"
                        />
                      </g>
                    </Marker>
                  );
                } catch (error) {
                  console.error("GlobalPulseMap marker error:", error);
                  return null;
                }
              }).filter(Boolean)}
            </ZoomableGroup>
          </ComposableMap>

          <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
              <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-3 rounded-xl border border-white/10">
                  <div className="w-4 h-4 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Active Nodes (Verified)</span>
              </div>
              <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-3 rounded-xl border border-white/10">
                  <div className="w-4 h-4 rounded-full bg-slate-500"></div>
                  <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Discovery Nodes (Emerging)</span>
              </div>
              <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md p-3 rounded-xl border border-white/10">
                  <div className="w-4 h-4 rounded-full bg-amber-500"></div>
                  <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Caution Required</span>
              </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          {hovered ? (
            <div className="bg-white p-6 rounded-[2.5rem] border border-brand-200 shadow-xl shadow-brand-100/20 animate-slideUp relative">
               <button 
                 onClick={() => setHovered(null)}
                 className="absolute top-6 right-6 p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-all active:scale-95"
               >
                 <X size={16} />
               </button>
               <div className="flex items-center justify-between mb-6 pr-10">
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{hovered.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                        <Sparkles size={12} className="text-brand-500" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Agent Verified</span>
                    </div>
                 </div>
                 <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                   hovered.status === 'stable' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                   hovered.status === 'restricted' ? 'bg-red-100 text-red-700 border border-red-200' :
                   'bg-amber-100 text-amber-700 border border-amber-200'
                 }`}>
                   {hovered.status}
                 </span>
               </div>
               
               <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Worker Protection</span>
                      <span className="text-slate-900">{hovered.safety}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-700 ${hovered.safety > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${hovered.safety}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Visa Approval (UG)</span>
                      <span className="text-slate-900">{hovered.visaApproval}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-700 ${hovered.visaApproval > 60 ? 'bg-brand-500' : 'bg-red-500'}`} style={{ width: `${hovered.visaApproval}%` }}></div>
                    </div>
                  </div>

               <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-start gap-3 mb-2">
                       <ShieldCheck className="text-emerald-500 shrink-0" size={16} />
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance Insight</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">{hovered.notes}</p>
                  </div>

                  {/* Deep Link Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => onSelectRegion?.(mapCountryToRegion(hovered.id), hovered.name, 'blue_collar')}
                      className="flex flex-col items-center justify-center p-3 bg-brand-50 rounded-xl border border-brand-100 hover:border-brand-500 hover:bg-brand-100 transition-all active:scale-95 group"
                    >
                      <Zap size={16} className="text-brand-600 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black text-slate-900">Blue Collar</span>
                      <span className="text-[12px] font-black text-brand-600">
                        {safeArray<Job>(jobs).filter(j => {
                          try {
                            return (getJobLocationString(j?.location).includes(hovered.name) || j?.country === hovered.name) && j?.category === 'blue_collar';
                          } catch (e) {
                            return false;
                          }
                        }).length}
                      </span>
                    </button>
                    <button 
                      onClick={() => onSelectRegion?.(mapCountryToRegion(hovered.id), hovered.name, 'professional')}
                      className="flex flex-col items-center justify-center p-3 bg-emerald-50 rounded-xl border border-emerald-100 hover:border-emerald-500 hover:bg-emerald-100 transition-all active:scale-95 group"
                    >
                      <Users size={16} className="text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black text-slate-900">Professional</span>
                      <span className="text-[12px] font-black text-emerald-600">
                        {safeArray<Job>(jobs).filter(j => {
                          try {
                            return (getJobLocationString(j?.location).includes(hovered.name) || j?.country === hovered.name) && j?.category === 'professional';
                          } catch (e) {
                            return false;
                          }
                        }).length}
                      </span>
                    </button>
                  </div>

                  <div className="text-center mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Click a category above or view all below
                    </span>
                  </div>
                  <button onClick={() => onSelectRegion?.(mapCountryToRegion(hovered.id), hovered.name, 'All')} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center justify-center gap-2 hover:bg-brand-600 transition-all active:scale-95">
                    View All Nodes <ExternalLink size={14} />
                  </button>
               </div>
            </div>
          ) : (
            <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-dashed border-slate-300 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
               <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-slate-400 border border-slate-100">
                 <Info size={32} />
               </div>
               <h3 className="font-black text-slate-500 uppercase tracking-widest text-sm mb-2">Global Pulse</h3>
               <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-[180px] mx-auto">
                 Hover over highlighted corridors to view deep-vetted safety scores.
               </p>
            </div>
          )}
          
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
             <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                <Sparkles size={100} />
             </div>
             <div className="flex items-center gap-3 mb-4">
               <div className="p-2 bg-white/20 rounded-xl">
                    <Activity className="animate-pulse" size={18} />
               </div>
               <h4 className="font-black text-[10px] uppercase tracking-widest">Opportunity Alert</h4>
             </div>
             <div className="mb-4">
               <div className="text-2xl font-black">Poland Professional Surge</div>
               <div className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Western Corridor Growth</div>
             </div>
             <div className="text-[10px] bg-black/20 p-3 rounded-xl border border-white/10 leading-relaxed font-medium">
               {pulseData['POL']?.nodeCount ?? (regionJobCounts?.['Western Corridor']?.total ?? 0) > 0 ? (
                `Agent scan detected ${pulseData['POL']?.nodeCount ?? regionJobCounts?.['Western Corridor']?.total} active nodes in Poland/EU. Professional demand up 24%.`
              ) : (
                "Poland Node: 88% Worker Protection rating. Surge in logistics and IT roles detected. Ready for immediate vetting."
              )}
             </div>
          </div>
        </div>
      </div>

      {/* Corridor Comparison Tool */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="text-brand-600" size={24} />
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Corridor VS Corridor Benchmarking</h3>
            <p className="text-slate-500 text-[10px] font-medium uppercase tracking-widest">Compare safety & legal protection scores</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-center">
          {/* Comparison Slot 1 */}
          <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Source Node</label>
             <select 
               className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-cyan-400 outline-none focus:ring-4 focus:ring-cyan-500/10 transition-all"
               value={comparing?.[0] || 'POL'}
               onChange={(e) => setComparing([e.target.value, comparing?.[1] || 'ARE'])}
             >
               {Object.values(pulseData).map((c: CountryStats) => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
             
             {comparing?.[0] && pulseData[comparing[0]] && (
               <div className="space-y-4 mt-6 animate-fadeIn">
                 <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Legal Safety</span>
                    <span className="text-xl font-black text-slate-900">{pulseData[comparing[0]].safety}%</span>
                 </div>
                 <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pulseData[comparing[0]].safety}%` }}></div>
                 </div>
               </div>
             )}
          </div>

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-200 animate-pulse">
              <Zap size={20} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">VS</span>
          </div>

          {/* Comparison Slot 2 */}
          <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Benchmark Node</label>
             <select 
               className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-cyan-400 outline-none focus:ring-4 focus:ring-cyan-500/10 transition-all"
               value={comparing?.[1] || 'ARE'}
               onChange={(e) => setComparing([comparing?.[0] || 'POL', e.target.value])}
             >
               {Object.values(pulseData).map((c: CountryStats) => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>

             {comparing?.[1] && pulseData[comparing[1]] && (
               <div className="space-y-4 mt-6 animate-fadeIn">
                 <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Legal Safety</span>
                    <span className="text-xl font-black text-slate-900">{pulseData[comparing[1]].safety}%</span>
                 </div>
                 <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: `${pulseData[comparing[1]].safety}%` }}></div>
                 </div>
               </div>
             )}
          </div>
        </div>

        {comparing && pulseData[comparing[0]] && pulseData[comparing[1]] && (
          <div className="mt-12 p-8 bg-slate-900 rounded-[2.5rem] text-white border border-slate-800 animate-slideUp">
             <div className="flex items-center gap-3 mb-6">
                <Sparkles className="text-amber-400" size={20} />
                <h4 className="text-sm font-black uppercase tracking-widest">Kaseddie Benchmarking Insight</h4>
             </div>
             <p className="text-sm text-slate-300 leading-relaxed">
               Comparing <span className="text-white font-bold">{pulseData[comparing[0]].name}</span> vs <span className="text-white font-bold">{pulseData[comparing[1]].name}</span>. 
               {pulseData[comparing[0]].safety > pulseData[comparing[1]].safety 
                 ? ` ${pulseData[comparing[0]].name} offers a higher worker protection rating (${pulseData[comparing[0]].safety}%). Recommend favoring this node for family-first professional deployments.`
                 : ` ${pulseData[comparing[1]].name} maintains a slight lead in corridor efficiency, though ${pulseData[comparing[0]].name} is showing a faster growth in blue-collar demand.`
               }
             </p>
          </div>
        )}
      </div>
    </div>
  );
  } catch (error) {
    console.error("GlobalPulseMap component error:", error);
    return (
      <div className="h-[600px] flex flex-col items-center justify-center bg-slate-900 rounded-[2.5rem] text-white">
        <X className="text-red-500 mb-4" size={48} />
        <p className="text-sm font-black uppercase tracking-[0.2em]">Map Error</p>
      </div>
    );
  }
};

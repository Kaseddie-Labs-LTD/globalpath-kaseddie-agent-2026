
import React, { useState, useMemo } from 'react';
import { Job, getJobLocationString } from '../types';
import { Briefcase, MapPin, DollarSign, ArrowUp, ArrowDown, ArrowUpDown, Filter, ShieldCheck, ShieldAlert, Plane, Key, Check, Search, X, RotateCcw } from 'lucide-react';

interface JobTableProps {
  jobs: Job[];
  onAnalyzeSafety: (job: Job) => void;
  onApply: (job: Job) => void;
}

type SortKey = 'matchScore' | 'salary' | 'location' | 'dateFound' | null;
type SortDirection = 'asc' | 'desc';

export const JobTable: React.FC<JobTableProps> = ({ jobs, onAnalyzeSafety, onApply }) => {
  const [sortKey, setSortKey] = useState<SortKey>('matchScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterSource, setFilterSource] = useState<string>('All');
  const [salaryType, setSalaryType] = useState<'All' | 'Fixed' | 'Commission'>('All');
  const [complianceFilter, setComplianceFilter] = useState<'All' | 'High Risk' | 'Verified'>('All');
  const [sponsorshipOnly, setSponsorshipOnly] = useState(false);
  const [flightTicketOnly, setFlightTicketOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('desc'); }
  };

  const resetFilters = () => {
    setFilterSource('All');
    setSalaryType('All');
    setComplianceFilter('All');
    setSponsorshipOnly(false);
    setFlightTicketOnly(false);
    setSearchTerm('');
  };

  const filteredAndSortedJobs = useMemo(() => {
    let result = [...jobs];
    
    // Text Search Refined
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(job => 
        (job.title?.toLowerCase().includes(term)) || 
        (job.company?.toLowerCase().includes(term)) || 
        (getJobLocationString(job.location).toLowerCase().includes(term))
      );
    }

    // Filter by Source
    if (filterSource !== 'All') {
      result = result.filter(job => job.source === filterSource);
    }

    // Filter by Salary Type
    if (salaryType !== 'All') {
      result = result.filter(job => 
        salaryType === 'Commission' ? job.is_commission_only : !job.is_commission_only
      );
    }

    // Filter by Compliance
    if (complianceFilter !== 'All') {
      result = result.filter(job => job.complianceStatus === complianceFilter);
    }
    
    // Filter by Sponsorship
    if (sponsorshipOnly) {
      result = result.filter(job => job.hasSponsorship);
    }
    
    // Filter by Flight Ticket
    if (flightTicketOnly) {
      result = result.filter(job => job.hasFlightTicket);
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        let valA = (a as any)[sortKey];
        let valB = (b as any)[sortKey];
        
        // Handle numerical sorting for salary/score
        if (typeof valA === 'string' && valA.includes('$')) {
            valA = parseFloat(valA.replace(/[^0-9.]/g, '')) || 0;
            valB = parseFloat(valB.replace(/[^0-9.]/g, '')) || 0;
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [jobs, sortKey, sortDirection, filterSource, salaryType, complianceFilter, sponsorshipOnly, flightTicketOnly, searchTerm]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown size={14} className="text-gray-300 ml-1" />;
    return sortDirection === 'asc' ? <ArrowUp size={14} className="text-brand-600 ml-1" /> : <ArrowDown size={14} className="text-brand-600 ml-1" />;
  };

  const hasActiveFilters = filterSource !== 'All' || salaryType !== 'All' || complianceFilter !== 'All' || sponsorshipOnly || flightTicketOnly || searchTerm !== '';

  return (
    <div className="space-y-4">
      {/* Advanced Filter Bar */}
      <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[300px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by role, company, or location..."
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-brand-50/50 focus:border-brand-500 transition-all text-sm font-medium"
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200">
                        <X size={16} />
                    </button>
                )}
            </div>
            
            <div className="flex items-center gap-2">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">
                    {filteredAndSortedJobs.length} Results Found
                </div>
                {hasActiveFilters && (
                    <button 
                        onClick={resetFilters}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all"
                    >
                        <RotateCcw size={14} /> Reset
                    </button>
                )}
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-100">
           {/* Source Filter */}
           <div className="flex items-center gap-2">
              <Filter size={16} className="text-slate-400" />
              <select 
                value={filterSource} 
                onChange={(e) => setFilterSource(e.target.value)} 
                className="text-xs border-slate-200 rounded-lg border px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all bg-white font-bold text-slate-700"
              >
                <option value="All">All Sources</option>
                {Array.from(new Set(jobs.map(j => j.source))).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
           </div>

           {/* Salary Type Filter */}
           <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-slate-400" />
              <select 
                value={salaryType} 
                onChange={(e) => setSalaryType(e.target.value as any)} 
                className="text-xs border-slate-200 rounded-lg border px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all bg-white font-bold text-slate-700"
              >
                <option value="All">All Salary Types</option>
                <option value="Fixed">Fixed Salary</option>
                <option value="Commission">Commission Only</option>
              </select>
           </div>

           {/* Compliance Filter */}
           <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-slate-400" />
              <select 
                value={complianceFilter} 
                onChange={(e) => setComplianceFilter(e.target.value as any)} 
                className="text-xs border-slate-200 rounded-lg border px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all bg-white font-bold text-slate-700"
              >
                <option value="All">All Compliance</option>
                <option value="Verified">Verified Safe</option>
                <option value="High Risk">High Risk</option>
              </select>
           </div>

           <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

           {/* Mandate Toggles */}
           <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => setSponsorshipOnly(!sponsorshipOnly)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  sponsorshipOnly 
                  ? 'bg-brand-600 border-brand-600 text-white shadow-md shadow-brand-500/20' 
                  : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50/50'
                }`}
              >
                <Key size={14} />
                Sponsorship
                {sponsorshipOnly && <Check size={12} strokeWidth={3} />}
              </button>

              <button 
                onClick={() => setFlightTicketOnly(!flightTicketOnly)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  flightTicketOnly 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20' 
                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <Plane size={14} />
                Air Ticket
                {flightTicketOnly && <Check size={12} strokeWidth={3} />}
              </button>
           </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Role & Mandate Verification</th>
              <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('location')}>Location <SortIcon column="location" /></th>
              <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('salary')}>Salary <SortIcon column="salary" /></th>
              <th className="px-6 py-4">HR Safety</th>
              <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('matchScore')}>Match <SortIcon column="matchScore" /></th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredAndSortedJobs.length > 0 ? (
              filteredAndSortedJobs.map((job) => (
                <tr key={job.id} className={`hover:bg-brand-50/30 transition-colors group ${!job.hasSponsorship || job.complianceStatus === 'High Risk' ? 'bg-red-50/10' : ''}`}>
                  <td className="px-6 py-5">
                    <div className="font-bold text-slate-900 group-hover:text-brand-700 transition-colors flex items-center gap-2">
                      {job.title}
                      {job.complianceStatus === 'High Risk' && (
                        <span className="flex items-center gap-1 text-[8px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded uppercase animate-pulse">
                          <ShieldAlert size={10} /> High Risk
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 text-xs mb-2 flex items-center gap-1.5">
                      <Briefcase size={12} /> {job.company}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {job.hasSponsorship ? (
                          <span className="flex items-center gap-1 text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase border border-emerald-200">
                            <Key size={10}/> Sponsorship
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded uppercase border border-red-200">
                            <ShieldAlert size={10}/> No Sponsorship
                          </span>
                        )}
                        {job.hasFlightTicket && (
                          <span className="flex items-center gap-1 text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase border border-blue-200">
                            <Plane size={10}/> Ticket Included
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-600 font-medium">
                    <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-slate-400" />
                        {getJobLocationString(job.location)}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-900 font-bold">
                    <div className="flex items-center gap-1">
                        <DollarSign size={14} className="text-slate-400" />
                        {job.salary && job.salary.toLowerCase().includes('commission') ? 'Performance Based' : (job.salary || "Competitive")}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                     <button 
                      onClick={() => onAnalyzeSafety(job)} 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-600 rounded-lg text-xs font-bold shadow-sm transition-all"
                     >
                         <ShieldCheck size={14} className="text-emerald-500" /> Verify Safe
                     </button>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="inline-flex flex-col items-center">
                      <div className="text-sm font-black text-brand-700">{job.matchScore}%</div>
                      <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-brand-500" style={{ width: `${job.matchScore}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={() => onApply(job)} 
                      className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-brand-500/20 active:scale-95 transition-all"
                    >
                      Apply Now
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-24 text-center">
                  <div className="flex flex-col items-center gap-4 max-w-xs mx-auto">
                    <div className="p-5 bg-slate-50 rounded-full text-slate-300 border border-slate-100">
                      <Search size={40} />
                    </div>
                    <div>
                        <div className="font-bold text-slate-900 text-lg">No matching roles</div>
                        <p className="text-sm text-slate-500 mt-1">We couldn't find any jobs matching your current advanced filters. Try broadening your search.</p>
                    </div>
                    {hasActiveFilters && (
                        <button 
                            onClick={resetFilters}
                            className="text-brand-600 font-bold text-sm hover:underline"
                        >
                            Reset all filters
                        </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

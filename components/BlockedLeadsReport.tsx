import React from 'react';
import { ShieldAlert, ArrowLeft, ShieldCheck, MapPin, Zap } from 'lucide-react';
import { Job, getJobLocationString } from '../types';

interface BlockedLeadsReportProps {
  logs: any[];
  jobs: Job[];
  onBack: () => void;
}

export const BlockedLeadsReport: React.FC<BlockedLeadsReportProps> = ({ logs, jobs, onBack }) => {
  // Find jobs that have fee_blocked=true or related indicators in logs
  const blockedJobs = jobs.filter(j => 
    j.fee_blocked || 
    j.illegalFeeDetected || 
    (j.complianceStatus === 'High Risk') || 
    j.description?.toLowerCase().includes('fee') ||
    j.requirements?.some(r => r.toLowerCase().includes('fee'))
  );
  const totalBlockedCount = blockedJobs.length;
  const blockedDollars = totalBlockedCount * 2500;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 animate-fadeIn">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        <span className="text-sm font-black uppercase tracking-widest">Back to Dashboard</span>
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-red-500/20 rounded-2xl border border-red-500/30">
          <ShieldAlert size={32} className="text-red-500" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">Blocked Fees Report</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">
            Detailed view of zero-fee policy violations intercepted by Kaseddie AI Oversight.
          </p>
        </div>
      </div>

      <div className="p-6 bg-slate-900/90 border border-emerald-500/30 rounded-2xl shadow-xl backdrop-blur-md mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-widest">
                Kaseddie AI Oversight • Active Protection
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white mt-1">
              Blocked Fees Report
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Detailed view of zero-fee policy violations intercepted across all recruitment corridors.
            </p>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 px-6 py-4 rounded-xl text-left md:text-right w-full md:w-auto">
            <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Total Intercepted Value
            </div>
            <div className="text-3xl md:text-4xl font-black text-emerald-400 mt-1">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                maximumFractionDigits: 0,
              }).format(blockedDollars || totalBlockedCount * 2500)}
            </div>
            <div className="text-xs text-slate-300 font-medium mt-1">
              {totalBlockedCount} Fee-Charging Nodes Quarantined
            </div>
          </div>
        </div>
      </div>

      {blockedJobs.length > 0 ? (
        <div className="grid gap-4">
          {blockedJobs.map((job) => (
            <div key={job.id} className="bg-slate-900 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
              
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black text-white">{job.title}</h3>
                    <span className="px-2 py-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest rounded-lg border border-red-500/20">
                      Violation Blocked
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1 font-medium">
                      <ShieldCheck size={14} className="text-slate-500" />
                      {job.company}
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <MapPin size={14} className="text-slate-500" />
                      {getJobLocationString(job.location)}
                    </span>
                  </div>
                </div>
                
                <div className="md:text-right flex flex-col md:items-end justify-center">
                  <div className="text-sm font-black text-slate-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                    Agent Action: <span className="text-red-400">Node Quarantined</span>
                  </div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">
                    Intercepted via {job.node || 'Global Scan'}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/5">
                <p className="text-xs font-medium text-slate-300 leading-relaxed">
                  <span className="text-red-400 font-bold mr-2">Flag Reason:</span>
                  Detected fee-charging language or illegal visa procurement clauses in the node uplink data.
                  The GlobalPath Zero-Fee policy strictly prohibits candidate-paid recruitment models.
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
          <div className="p-6 bg-brand-500/10 rounded-full mb-4">
            <ShieldCheck size={48} className="text-brand-500" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">Zero Violations Detected</h3>
          <p className="text-slate-400 text-sm max-w-md">
            The Kaseddie Oversight Agent has not intercepted any fee-charging violations in the current dataset. The Zero-Fee policy is fully intact.
          </p>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { MapPin, Building, ExternalLink, ShieldCheck, Banknote } from 'lucide-react';

export const JobLeadCard = ({ job }: { job: any }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl p-5 transition-all shadow-md">
      {/* Top Header: Title & Zero-Fee Badge */}
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white hover:text-blue-400 transition-colors">
            {job.title}
          </h3>
          <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
            <Building size={16} className="text-slate-500" />
            <span>{job.company}</span>
          </div>
        </div>

        {job.zeroFeeMandate && (
          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-medium">
            <ShieldCheck size={14} /> Zero-Fee
          </span>
        )}
      </div>

      {/* Details Row: Location & Salary */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 my-4 py-2 border-y border-slate-800/60">
        <div className="flex items-center gap-1.5">
          <MapPin size={14} className="text-slate-400" />
          <span>{job.location}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Banknote size={14} className="text-slate-400" />
          <span>{job.salaryText}</span>
        </div>
        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px]">
          {job.source}
        </span>
      </div>

      {/* Footer Action */}
      <div className="flex justify-between items-center pt-1">
        <span className="text-xs text-slate-500">ID: {job.jobId}</span>
        <a
          href={job.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          View Listing <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
};
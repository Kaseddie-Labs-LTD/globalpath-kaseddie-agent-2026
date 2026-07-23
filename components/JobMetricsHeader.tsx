import React from 'react';

export const JobMetricsHeader = ({ jobs }: { jobs: any[] }) => {
  const total = jobs.length;
  const zeroFee = jobs.filter(j => j.zeroFeeMandate).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <p className="text-xs text-slate-400 font-medium">Active Middle East Leads</p>
        <p className="text-2xl font-bold text-white mt-1">{total}</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <p className="text-xs text-slate-400 font-medium">Zero-Fee Compliant</p>
        <p className="text-2xl font-bold text-emerald-400 mt-1">{zeroFee}</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <p className="text-xs text-slate-400 font-medium">Primary Source</p>
        <p className="text-2xl font-bold text-blue-400 mt-1">Bayt.com</p>
      </div>
    </div>
  );
};
import React from 'react';
import { SafetyReport, Job, getJobLocationString } from '../types';
import { ShieldCheck, ShieldAlert, AlertTriangle, Building, DollarSign, X, Plane, Key } from 'lucide-react';

interface SafetyReportModalProps {
    report: SafetyReport;
    job: Job;
    onClose: () => void;
}

export const SafetyReportModal: React.FC<SafetyReportModalProps> = ({ report, job, onClose }) => {
    const isNonCompliant = report.recommendation === 'Non-Compliant';
    const isSafe = report.safetyScore > 75 && !isNonCompliant;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slideUp">
                <div className={`p-6 text-white flex justify-between items-start ${
                    isNonCompliant ? 'bg-red-700' :
                    isSafe ? 'bg-emerald-600' : 'bg-amber-600'
                }`}>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {isSafe ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
                            <h2 className="text-xl font-bold">HR Compliance Report</h2>
                        </div>
                        <p className="text-white/90 text-sm">{job.company} • {getJobLocationString(job.location)}</p>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white"><X size={24} /></button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-around text-center py-4 bg-slate-50 rounded-xl">
                        <div>
                            <div className="text-2xl font-black">{report.safetyScore}/100</div>
                            <div className="text-[10px] uppercase text-gray-400 font-bold">Safety Score</div>
                        </div>
                        <div className="w-px h-10 bg-gray-200"></div>
                        <div>
                            <div className={`text-sm font-bold uppercase tracking-widest ${isNonCompliant ? 'text-red-600' : 'text-emerald-600'}`}>
                                {report.recommendation}
                            </div>
                            <div className="text-[10px] uppercase text-gray-400 font-bold">HR Verdict</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className={`p-3 rounded-lg border flex items-center gap-3 ${report.sponsorshipVerified ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                            <Key size={18} className={report.sponsorshipVerified ? 'text-green-600' : 'text-red-600'} />
                            <div className="text-xs font-bold uppercase">Sponsorship: {report.sponsorshipVerified ? 'YES' : 'NO'}</div>
                        </div>
                        <div className={`p-3 rounded-lg border flex items-center gap-3 ${report.flightTicketProvided ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                            <Plane size={18} className={report.flightTicketProvided ? 'text-green-600' : 'text-red-600'} />
                            <div className="text-xs font-bold uppercase">Ticket: {report.flightTicketProvided ? 'YES' : 'NO'}</div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex gap-3 text-sm">
                            <Building size={18} className="text-slate-400 shrink-0"/>
                            <div><span className="font-bold">Employer:</span> {report.isDirectEmployer ? 'Direct Verified' : 'Agency (Requires Review)'}</div>
                        </div>
                        <div className="flex gap-3 text-sm">
                            <DollarSign size={18} className="text-slate-400 shrink-0"/>
                            <div><span className="font-bold">Salary:</span> {report.salaryFairness} (Avg: {report.marketAverage})</div>
                        </div>
                    </div>

                    {report.complianceFlags.length > 0 && (
                        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
                            <h4 className="font-bold uppercase mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Red Flags</h4>
                            <ul className="list-disc list-inside">
                                {report.complianceFlags.map((f, i) => <li key={`${f}-${i}`}>{f}</li>)}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="bg-slate-900 p-4 text-center text-[10px] text-slate-400 font-mono">
                    GLOBALPATH HR SYSTEM • MANDATE ENFORCED • CORRIDOR V1.2
                </div>
            </div>
        </div>
    );
};

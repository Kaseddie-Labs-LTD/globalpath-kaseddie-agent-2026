import React from 'react';

interface BlueCollarLeadCardProps {
  job?: {
    title?: string;
    jobTitle?: string;
    positionName?: string;
    position?: string;
    name?: string;
    market?: string;
    country?: string;
    corridor?: string;
    tier?: string;
    salary?: string;
    salary_range?: string;
    salaryText?: string;
    salary_min?: number;
    salary_max?: number;
    description?: string;
    url?: string;
    applyUrl?: string;
    apply_url?: string;
    link?: string;
    email?: string;
    Contact_Email?: string;
    employerEmail?: string;
    hrContact?: string;
    phone?: string;
    WhatsApp_Number?: string;
    phoneNumber?: string;
    mobile?: string;
    company?: string;
    ethical_ai_status?: string;
    zero_fee_guarantee?: boolean;
    zero_fee?: boolean;
    priority?: string;
    sourcing_status?: string;
    decision_maker?: string;
  };
}

export function BlueCollarLeadCard({ job }: BlueCollarLeadCardProps) {
  // Robust property resolution with fallback chains
  const data = job || {};

  // Title fallback chain
  const title: string =
    data.title ??
    data.jobTitle ??
    data.positionName ??
    data.position ??
    data.name ??
    "Untitled Position";

  // Market/location fallback chain
  const market: string = (() => {
    if (data.market) return String(data.market);
    if (data.country) return String(data.country);
    if (data.corridor) {
      const raw = String(data.corridor);
      const simplified = raw
        .replace(/\s*\/\s*Middle\s*East/i, '')
        .replace(/Corridor|Node/i, '')
        .trim();
      return simplified || raw;
    }
    return "UAE";
  })();

  // Salary fallback chain with concatenation prevention
  const salary: string = (() => {
    if (data.salary_range && data.salary_range !== "Not specified") {
      return String(data.salary_range);
    }
    if (data.salary && data.salary !== "Competitive") {
      return String(data.salary);
    }
    if (data.salaryText && data.salaryText !== "Competitive") {
      return String(data.salaryText);
    }
    const min = Number(data.salary_min);
    const max = Number(data.salary_max);
    if (min && max) {
      const fmt = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(2));
      return `${fmt(min)} – ${fmt(max)}`;
    }
    return "Competitive";
  })();

  // Apply URL fallback chain
  const applyUrl: string =
    data.apply_url ??
    data.applyUrl ??
    data.link ??
    data.url ??
    "#";

  // Email fallback chain
  const email: string =
    data.email ??
    data.Contact_Email ??
    data.employerEmail ??
    data.hrContact ??
    "No Email Found";

  // Phone fallback chain
  const phone: string =
    data.phone ??
    data.WhatsApp_Number ??
    data.phoneNumber ??
    data.mobile ??
    "No Phone Found";

  // Priority status for UI indicators
  const priority = data.priority || "immediate";
  const sourcingStatus = data.sourcing_status || "ready";
  const isZeroFee = data.zero_fee_guarantee || data.zero_fee || false;

  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg shadow-md mb-4 hover:border-cyan-500 transition-all">
      {/* Category Badge */}
      <div className="flex justify-between items-center mb-2">
        <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-950 text-emerald-400 rounded-md border border-emerald-800">
          🛠️ Trade / Blue-Collar • {market}
        </span>
        {isZeroFee && (
          <span className="text-xs text-cyan-400 font-mono bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-900">
            🛡️ Zero-Fee Verified
          </span>
        )}
      </div>

      {/* Priority Status Badge */}
      {priority === "immediate" && sourcingStatus === "ready" && (
        <div className="mb-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
            ✅ Ready to Match
          </span>
        </div>
      )}
      {priority === "pending" && sourcingStatus === "seeking_candidate" && (
        <div className="mb-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            ⏳ Seeking Candidate
          </span>
        </div>
      )}

      {/* Job Title */}
      <h3 className="text-lg font-bold text-white mb-1">
        {title}
      </h3>

      {/* Company */}
      {data.company && (
        <div className="text-xs text-slate-400 mb-2 font-medium">
          🏢 {data.company}
        </div>
      )}

      {/* Salary & Package Badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-amber-400 bg-amber-950/40 px-2.5 py-0.5 rounded border border-amber-900/60">
          💰 {salary}
        </span>
      </div>

      {/* Description */}
      {data.description && (
        <p className="text-sm text-slate-300 mb-4">
          {data.description}
        </p>
      )}

      {/* Decision Maker */}
      {data.decision_maker && (
        <div className="text-xs text-slate-400 mb-3">
          👤 Decision Maker: {data.decision_maker}
        </div>
      )}

      {/* Contact & Action */}
      <div className="flex justify-between items-center pt-3 border-t border-slate-800 text-xs">
        <span className="text-slate-400 font-mono">
          📧 {email} | 📞 {phone}
        </span>
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded transition-colors"
        >
          View Trade Listing →
        </a>
      </div>
    </div>
  );
}

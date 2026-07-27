import React from 'react';
import type { Job } from '../types';
import { getJobLocationString } from '../types';
import { formatSalaryToUSD } from '../utils/salaryConverter';

interface LeadCardProps {
  lead?: Partial<Job> & Record<string, any>;
  job?: Partial<Job> & Record<string, any>;
}

/**
 * Production-ready Lead / Job Card renderer.
 * - Flexible props: accepts either `lead` (Qdrant / pipeline naming) or `job` (scraper / legacy naming)
 * - Robust property fallbacks for all corridor data sources (Bayt, Apify, manual enrich)
 * - Bayt URL slug regex parser: extracts "construction-project-manager-5471250" → "Construction Project Manager"
 */
export const JobLeadCard: React.FC<LeadCardProps> = ({ lead, job }) => {
  // Normalize input: if both provided, lead takes precedence; else use job as lead
  const data: Record<string, any> = (lead ?? job ?? {}) as any;

  // ============================================================
  // 1. Bayt URL slug → human-readable job title parser
  // ============================================================
  const getCleanTitle = (url: string | undefined | null): string => {
    if (!url) return 'Professional Node';
    try {
      const match = String(url).match(/\/jobs\/([a-z0-9-]+)-\d+$/i);
      if (match && match[1]) {
        return match[1]
          .split('-')
          .filter(Boolean)
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    } catch (_e) {
      /* fall through to default */
    }
    return 'Professional Node';
  };

  // ============================================================
  // 2. Robust property resolution (pipeline names ↔ scraper names)
  // ============================================================
  const applyUrl: string | undefined =
    data.apply_url ?? data.applyUrl ?? data.link ?? data.url ?? data.source_url;

  // Corrected Job Title mapping - prioritize title fields over market/country
  const rawTitle: string | undefined =
    data.title ?? data.jobTitle ?? data.positionName ?? data.position ?? data.name;

  const jobTitle: string = rawTitle || getCleanTitle(applyUrl) || 'Untitled Position';

  // Market / location / corridor resolution
  const market: string = (() => {
    if (data.market) return String(data.market);
    if (data.country) return String(data.country);
    if (data.corridor) {
      // Strip noisy prefixes for the badge (keeps badge short & uppercase)
      const raw = String(data.corridor);
      const simplified = raw
        .replace(/\s*\/\s*Middle\s*East/i, '')
        .replace(/Corridor|Node/i, '')
        .trim();
      return simplified || raw;
    }
    const locStr = getJobLocationString(data.location as any);
    if (locStr && locStr !== 'Global') {
      // Just the country/region part (last comma segment if comma-separated)
      const parts = locStr.split(',').map((s) => s.trim()).filter(Boolean);
      return parts.length > 0 ? parts[parts.length - 1] : locStr;
    }
    return 'UAE';
  })();

  // Salary / compensation - Fixed concatenation bug with proper fallback
  const salary: string = (() => {
    // Priority 1: Use salary_range if available and not "Not specified"
    if (data.salary_range && data.salary_range !== "Not specified") {
      return String(data.salary_range);
    }
    // Priority 2: Use salary if available and not just "Competitive"
    if (data.salary && data.salary !== "Competitive") {
      return String(data.salary);
    }
    // Priority 3: Use salaryText if available
    if (data.salaryText && data.salaryText !== "Competitive") {
      return String(data.salaryText);
    }
    // Priority 4: Build range from min/max if available
    const min = Number(data.salary_min);
    const max = Number(data.salary_max);
    if (min && max) {
      const fmt = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(2));
      return `${fmt(min)} – ${fmt(max)}`;
    }
    // Priority 5: Commission based
    if (data.is_commission_only) return 'Performance Based';
    // Default fallback
    return 'Competitive';
  })();

  // High-value tier flag (multiple sources of truth)
  const isHighValue: boolean =
    data.tier === 'High Value' ||
    data.tier === 'PREMIER' ||
    data.highValue === true ||
    data.isHighValue === true;

  // Contact info (fall through all enrichment columns)
  const emailContact: string =
    data.email ??
    data.Contact_Email ??
    data.employerEmail ??
    data.hrContact ??
    '';

  const phoneContact: string =
    data.phone ??
    data.WhatsApp_Number ??
    data.phoneNumber ??
    data.mobile ??
    '';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-md flex flex-col justify-between hover:border-cyan-500/50 transition-all">
      <div>
        {/* Header & Badges */}
        <div className="flex justify-between items-start gap-2 mb-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase tracking-wider">
            {market}
          </span>
          {isHighValue && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              High Value
            </span>
          )}
          {data.zero_fee && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Zero-Fee
            </span>
          )}
        </div>

        {/* Clean Job Title */}
        <h4 className="font-bold text-base text-slate-100 mb-2 leading-snug line-clamp-2">
          {jobTitle}
        </h4>

        {/* Company */}
        {data.company && (
          <div className="text-xs text-slate-400 mb-2 font-medium">
            🏢 {data.company}
          </div>
        )}

        {/* Salary Indicator */}
        <div className="text-sm font-medium text-cyan-400 mb-4">
          💰 {formatSalaryToUSD({
            salaryText: salary,
            corridorOrCountry: market,
            jobTitleOrCategory: jobTitle,
            description: data.description || data.interests
          })}
        </div>
      </div>

      <div>
        {/* Contact Status */}
        <div className="text-xs text-slate-400 space-y-1 mb-4 pt-2 border-t border-slate-800/80">
          <div className="truncate">📧 {emailContact || 'No Email Found'}</div>
          <div className="truncate">📞 {phoneContact || 'No Phone Found'}</div>
        </div>

        {/* Action Link */}
        <a
          href={applyUrl || '#'}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (!applyUrl) e.preventDefault();
          }}
          className="inline-flex items-center justify-center w-full py-2 px-3 text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded border border-cyan-500/30 transition-colors"
        >
          Apply via Bayt ↗
        </a>
      </div>
    </div>
  );
};

export default JobLeadCard;

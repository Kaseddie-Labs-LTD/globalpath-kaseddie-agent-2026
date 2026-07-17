import { fetcher } from '../constants/api';
import { getJobLocationString, Job } from "../types";
import { categorizeJob } from '../utils/jobCategorization';

// Real Job Description Scraper Config
export const SCRAPER_CONFIG = {
  maxScroll: 100,
  clickShowMore: true,
  scrollWaitMs: 3000,
  scrapeReviewCount: 20
};

// Patterns that indicate a fabricated/fallback contact — never produced by real grounding.
// The backend's get_grounded_contact_data() returns real emails from Gemini Search;
// these patterns only appear when the old enrichContactData() mock ran client-side
// or when the backend had no grounding result and used a slug-based fallback.
const SYNTHETIC_EMAIL_RE = /^hr@[a-z0-9]+\.com$/i;
const SYNTHETIC_TITLE_RE = /^(hiring manager|hr director|talent acquisition|staffing lead)$/i;

/**
 * Returns true if the email value looks like a fabricated slug-based address
 * (e.g. "hr@somecompany.com") rather than a real verified contact.
 * Real grounded emails contain dots, department prefixes, or full names.
 */
function isSyntheticEmail(email: string | undefined): boolean {
  if (!email) return true;
  // Explicitly allow the canonical GlobalPath outreach address
  if (email === 'hr@globalpathkaseddieagent.com') return false;
  return SYNTHETIC_EMAIL_RE.test(email.trim());
}

/**
 * Normalise a raw lead payload from Qdrant.
 *
 * 1. Category — filled via canonicalized categorizeJob() when absent.
 * 2. Contact fields — only real, grounded values from the backend pipeline
 *    are preserved. Fabricated slug emails and placeholder decision-maker
 *    titles are replaced with undefined so components render "not available"
 *    instead of fake data. Real contact data lives in the backend-enriched
 *    `enriched_contact` sub-object written by get_grounded_contact_data().
 */
function normaliseLead(job: any): Job {
  const category = job.category ?? categorizeJob(job);

  // Prefer the deeply grounded contact written by the backend enrichment pipeline.
  const enriched = job.enriched_contact ?? {};
  const groundedEmail: string | undefined =
    enriched.contact_channels?.email ||
    enriched.contact_channels?.work_email ||
    undefined;
  const groundedTitle: string | undefined =
    enriched.decision_maker_title || undefined;

  // Surface-level fields — accept only if they don't look synthetic.
  const rawEmail: string | undefined =
    job.Contact_Email || job.hrContact || job.employerEmail || undefined;
  const rawTitle: string | undefined =
    job.Decision_Maker_Title || undefined;

  const verifiedEmail: string | undefined =
    groundedEmail ||
    (rawEmail && !isSyntheticEmail(rawEmail) ? rawEmail : undefined);

  const verifiedTitle: string | undefined =
    groundedTitle ||
    (rawTitle && !SYNTHETIC_TITLE_RE.test(rawTitle.trim()) ? rawTitle : undefined);

  return {
    ...job,
    category,
    Contact_Email: verifiedEmail,
    Decision_Maker_Title: verifiedTitle,
    // Keep hrContact/employerEmail consistent with Contact_Email
    hrContact: verifiedEmail,
    employerEmail: verifiedEmail,
  } as Job;
}

/**
 * Fetch all active leads from the backend.
 * All Apify ingestion happens server-side via POST /api/sync-apify-leads.
 * The frontend only reads the already-enriched Qdrant payload from GET /api/leads.
 */
export const fetchGlobalJobs = async (): Promise<Job[]> => {
  try {
    const data = await fetcher('/leads');
    const raw: any[] = Array.isArray(data) ? data : (Array.isArray(data?.leads) ? data.leads : []);
    return raw.map(normaliseLead);
  } catch (error) {
    console.error("❌ Error fetching leads from backend:", error);
    return [];
  }
};

/**
 * Fetch Luxembourg leads from the backend and filter client-side by location.
 * Does not call Apify directly — data comes from the backend-enriched vault.
 */
export const fetchLuxembourgLeads = async (): Promise<Job[]> => {
  try {
    const data = await fetcher('/leads');
    const raw: any[] = Array.isArray(data) ? data : (Array.isArray(data?.leads) ? data.leads : []);
    return raw
      .map(normaliseLead)
      .filter(job => {
        const loc = getJobLocationString(job.location).toLowerCase();
        return loc.includes('luxembourg') || loc.includes(', lu');
      });
  } catch (error) {
    console.error("❌ Error fetching Luxembourg leads from backend:", error);
    return [];
  }
};

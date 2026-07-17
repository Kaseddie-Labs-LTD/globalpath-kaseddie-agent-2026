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

/**
 * Normalise a raw lead payload from Qdrant.
 * Fills in category via the canonical categorizeJob() when the backend hasn't
 * assigned one (e.g. older records ingested before the pipeline was fixed).
 * This is the single place on the frontend where category is resolved —
 * all hand-rolled keyword blocks have been removed.
 */
function normaliseLead(job: any): Job {
  const category = job.category ?? categorizeJob(job);
  return { ...job, category } as Job;
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

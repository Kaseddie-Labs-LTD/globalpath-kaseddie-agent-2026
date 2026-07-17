import { fetcher } from '../constants/api';
import { getJobLocationString, Job } from "../types";

// Real Job Description Scraper Config
export const SCRAPER_CONFIG = {
  maxScroll: 100,
  clickShowMore: true,
  scrollWaitMs: 3000,
  scrapeReviewCount: 20
};

/**
 * Fetch all active leads from the backend.
 * All Apify ingestion happens server-side via POST /api/sync-apify-leads.
 * The frontend only reads the already-enriched Qdrant payload from GET /api/leads.
 */
export const fetchGlobalJobs = async (): Promise<Job[]> => {
  try {
    const data = await fetcher('/leads');
    return Array.isArray(data) ? data : (Array.isArray(data?.leads) ? data.leads : []);
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
    const jobs: Job[] = Array.isArray(data) ? data : (Array.isArray(data?.leads) ? data.leads : []);
    return jobs.filter(job => {
      const loc = getJobLocationString(job.location).toLowerCase();
      return loc.includes('luxembourg') || loc.includes(', lu');
    });
  } catch (error) {
    console.error("❌ Error fetching Luxembourg leads from backend:", error);
    return [];
  }
};

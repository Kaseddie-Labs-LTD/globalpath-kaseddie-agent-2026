import { fetcher } from '../constants/api'

export interface BaytJob {
  jobId: string
  title: string
  company: string
  location: string
  salaryText: string
  applyUrl: string
  source: string
  zeroFeeMandate: boolean
}

export interface ScrapeBaytResponse {
  status: string
  jobs_found: number
  jobs: BaytJob[]
}

export async function scrapeBaytJobs(
  keyword: string = '',
  limit: number = 20,
  token?: string
): Promise<ScrapeBaytResponse> {
  try {
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const response = await fetcher(`/scrape/bayt?keyword=${encodeURIComponent(keyword)}&limit=${limit}`, {
      headers
    })
    
    return response as ScrapeBaytResponse
  } catch (error) {
    console.error('❌ Error scraping Bayt jobs:', error)
    throw error
  }
}

const ADMIN_TOKEN_STORAGE_KEY = 'gp_admin_auth_token';

export async function scrapeWesternCorridors(
  limitPerSector: number = 20,
  includeExpanded: boolean = false
): Promise<any> {
  const token = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/scrape/western-corridors', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      limit_per_sector: limitPerSector,
      include_expanded: includeExpanded,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Western corridors sync failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}
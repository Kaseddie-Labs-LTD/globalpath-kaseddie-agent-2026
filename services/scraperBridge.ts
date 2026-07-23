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
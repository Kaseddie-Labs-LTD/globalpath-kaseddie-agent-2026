import argparse
import base64
import json
import re
import logging
import os
import time
from bs4 import BeautifulSoup
from curl_cffi import requests
from urllib.parse import urlparse, unquote, urlunparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("USAScraper")

BASE_URL = "https://www.indeed.com"

# ==============================================================
# BLUE-COLLAR & TRADE FOCUS KEYWORDS FOR USA
# Targeted search terms for manual labor, construction, logistics, and hospitality roles
# ==============================================================
USA_BLUE_COLLAR_KEYWORDS = [
    "construction worker",
    "electrician",
    "plumber",
    "welder",
    "driver",
    "forklift operator",
    "warehouse worker",
    "security guard",
    "hotel assistant",
    "general cleaner",
    "maintenance technician",
    "factory assistant",
    "truck driver",
    "cargo handler",
    "painter",
    "mechanic",
    "delivery driver",
    "laborer"
]

# ==============================================================
# TARGETED USA REGIONS
# Each entry:
#   slug           -> Indeed.com URL slug/state code
#   label          -> Human-readable region label used in badges / stats
#   tag            -> Short uppercase tag for payload / quick filtering
#   corridor_field -> Value stored in Qdrant `corridor` payload field
#   sectors        -> Strategic focus areas (stored in payload for downstream AI)
# ==============================================================
USA_TARGET_REGIONS: list[dict] = [
    {
        "rank": 1,
        "slug": "tx",
        "label": "Texas",
        "tag": "TX",
        "corridor_field": "USA / Western Corridor",
        "sectors": ["construction", "oil-gas", "transportation", "warehouse", "trades"]
    },
    {
        "rank": 2,
        "slug": "ca",
        "label": "California",
        "tag": "CA",
        "corridor_field": "USA / Western Corridor",
        "sectors": ["construction", "logistics", "warehouse", "hospitality", "trades"]
    },
    {
        "rank": 3,
        "slug": "fl",
        "label": "Florida",
        "tag": "FL",
        "corridor_field": "USA / Western Corridor",
        "sectors": ["construction", "hospitality", "transportation", "warehouse", "trades"]
    },
    {
        "rank": 4,
        "slug": "ny",
        "label": "New York",
        "tag": "NY",
        "corridor_field": "USA / Western Corridor",
        "sectors": ["construction", "warehouse", "transportation", "hospitality", "trades"]
    },
    {
        "rank": 5,
        "slug": "il",
        "label": "Illinois",
        "tag": "IL",
        "corridor_field": "USA / Western Corridor",
        "sectors": ["manufacturing", "warehouse", "transportation", "trades", "logistics"]
    },
    {
        "rank": 6,
        "slug": "pa",
        "label": "Pennsylvania",
        "tag": "PA",
        "corridor_field": "USA / Western Corridor",
        "sectors": ["manufacturing", "construction", "warehouse", "trades", "transportation"]
    }
]

USA_REGION_BY_SLUG: dict[str, dict] = {c["slug"]: c for c in USA_TARGET_REGIONS}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    # Anti-bot stealth headers
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0"
}

# Proxy configuration - set to None if no proxy available
PROXY = os.environ.get("THORDATA_PROXY_URL")  # e.g., "http://user:pass@proxy-server:port"

def get_indeed_url(keyword: str, region: str = "tx", limit: int = 20) -> str:
    """
    Constructs Indeed.com search URL for blue-collar roles.
    """
    # Indeed search URL pattern
    search_url = f"{BASE_URL}/jobs"
    params = {
        "q": keyword,
        "l": region,
        "sort": "date"
    }
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return f"{search_url}?{query_string}"

def scrape_usa_jobs(keyword: str, region: str = "tx", limit: int = 20) -> list[dict]:
    """
    Scrapes blue-collar job listings from Indeed.com.
    Returns a list of job dictionaries with title, company, location, salary, etc.
    """
    logger.info(f"🔍 [USA]: Scraping Indeed.com for keyword: {keyword} in region: {region}")

    url = get_indeed_url(keyword, region, limit)
    
    try:
        # Use proxy if configured, otherwise direct request with stealth headers
        proxies = {"http": PROXY, "https": PROXY} if PROXY else None
        if PROXY:
            logger.info(f"🔒 [USA]: Using proxy: {PROXY[:20]}...")
        
        response = requests.get(url, headers=HEADERS, proxies=proxies, timeout=30, impersonate="chrome120")
        response.raise_for_status()
        logger.info(f"✅ [USA]: Successfully fetched page for {keyword}")
    except Exception as e:
        logger.error(f"❌ [USA]: Failed to fetch page: {e}")
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    jobs = []

    # Indeed.com job card structure - adapt based on actual HTML
    job_cards = soup.find_all("div", class_="job_seen_beacon") or soup.find_all("div", class_="jobsearch-SerpJobCard")

    logger.info(f"📊 [USA]: Found {len(job_cards)} job cards on page")

    for card in job_cards[:limit]:
        try:
            # Extract job title
            title_element = card.find("h2", class_="jobTitle") or card.find("span", {"title": True})
            job_title = title_element.get_text(strip=True) if title_element else "Untitled Position"

            # Extract company
            company_element = card.find("span", {"data-testid": "company-name"}) or card.find("div", class_="companyName")
            company = company_element.get_text(strip=True) if company_element else "Confidential"

            # Extract location
            location_element = card.find("div", {"data-testid": "text-location"}) or card.find("div", class_="companyLocation")
            location = location_element.get_text(strip=True) if location_element else region.upper()

            # Extract salary
            salary_element = card.find("div", {"data-testid": "salary-snippet-container"}) or card.find("div", class_="salary-snippet")
            salary = salary_element.get_text(strip=True) if salary_element else "Not specified"

            # Extract apply URL
            link_element = card.find("a", href=True)
            apply_url = link_element['href'] if link_element else "#"
            if apply_url.startswith("/"):
                apply_url = BASE_URL + apply_url

            # Extract job ID
            job_id = re.search(r'/([a-zA-Z0-9_-]+)/', apply_url)
            job_id_str = job_id.group(1) if job_id else f"us_{int(time.time() * 1000)}"

            # Extract email using regex
            text_content = card.get_text(separator=" ")
            email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text_content)
            extracted_email = email_match.group(0) if email_match else None

            # Extract phone using regex
            phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}|\+?\d{10,15}', text_content)
            extracted_phone = phone_match.group(0) if phone_match else None

            # Extract decision maker using heuristic
            decision_maker_keywords = ["hr", "human resources", "recruiter", "hiring manager", "talent acquisition", "recruitment", "personnel"]
            decision_maker_match = None
            for keyword_dm in decision_maker_keywords:
                if keyword_dm in text_content.lower():
                    keyword_idx = text_content.lower().find(keyword_dm)
                    context_start = max(0, keyword_idx - 50)
                    context_end = min(len(text_content), keyword_idx + 50)
                    context = text_content[context_start:context_end]
                    name_match = re.search(r'\b[A-Z][a-z]+ [A-Z][a-z]+\b', context)
                    if name_match:
                        decision_maker_match = name_match.group(0)
                        break
            extracted_decision_maker = decision_maker_match if decision_maker_match else None

            # Get region metadata
            region_meta = USA_REGION_BY_SLUG.get(region, {
                "corridor_field": "USA / Western Corridor",
                "label": region.upper(),
                "tag": region.upper(),
                "sectors": ["general"]
            })

            jobs.append({
                "jobId": job_id_str,
                "title": job_title,
                "company": company,
                "location": location,
                "applyUrl": apply_url,
                "salaryText": salary,
                "source": "Indeed (USA)",
                "zeroFeeMandate": True,
                # Contact information extraction
                "email": extracted_email,
                "phone": extracted_phone,
                "decision_maker": extracted_decision_maker,
                # Corridor expansion tags
                "corridor": region_meta.get("corridor_field"),
                "corridor_label": region_meta.get("label"),
                "corridor_tag": region_meta.get("tag"),
                "corridor_slug": region,
                "corridor_rank": region_meta.get("rank"),
                "target_sectors": region_meta.get("sectors"),
            })

        except Exception as e:
            logger.warning(f"⚠️ [USA]: Failed to parse job card: {e}")
            continue

    logger.info(f"✅ [USA]: Successfully extracted {len(jobs)} jobs from Indeed.com")
    return jobs

def main():
    parser = argparse.ArgumentParser(description="Scrape blue-collar jobs from Indeed.com")
    parser.add_argument("--keyword", default="driver", help="Job keyword to search")
    parser.add_argument("--region", default="tx", help="Region code (tx, ca, fl, ny, il, pa)")
    parser.add_argument("--limit", type=int, default=20, help="Number of jobs to scrape")
    args = parser.parse_args()

    jobs = scrape_usa_jobs(args.keyword, args.region, args.limit)
    print(json.dumps(jobs, indent=2))

if __name__ == "__main__":
    main()

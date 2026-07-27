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
logger = logging.getLogger("CanadaScraper")

BASE_URL = "https://www.jobbank.gc.ca"

# ==============================================================
# BLUE-COLLAR & TRADE FOCUS KEYWORDS FOR CANADA
# Targeted search terms for manual labor, construction, logistics, and hospitality roles
# ==============================================================
CANADA_BLUE_COLLAR_KEYWORDS = [
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
    "mechanic"
]

# ==============================================================
# TARGETED CANADIAN PROVINCES & TERRITORIES
# Each entry:
#   slug           -> JobBank.ca URL slug/region code
#   label          -> Human-readable region label used in badges / stats
#   tag            -> Short uppercase tag for payload / quick filtering
#   corridor_field -> Value stored in Qdrant `corridor` payload field
#   sectors        -> Strategic focus areas (stored in payload for downstream AI)
# ==============================================================
CANADA_TARGET_REGIONS: list[dict] = [
    {
        "rank": 1,
        "slug": "on",
        "label": "Ontario",
        "tag": "ON",
        "corridor_field": "Canada / Western Corridor",
        "sectors": ["construction", "transportation", "manufacturing", "hospitality", "trades"]
    },
    {
        "rank": 2,
        "slug": "bc",
        "label": "British Columbia",
        "tag": "BC",
        "corridor_field": "Canada / Western Corridor",
        "sectors": ["construction", "logistics", "warehouse", "hospitality", "trades"]
    },
    {
        "rank": 3,
        "slug": "ab",
        "label": "Alberta",
        "tag": "AB",
        "corridor_field": "Canada / Western Corridor",
        "sectors": ["oil-gas", "construction", "transportation", "trades", "warehouse"]
    },
    {
        "rank": 4,
        "slug": "qc",
        "label": "Quebec",
        "tag": "QC",
        "corridor_field": "Canada / Western Corridor",
        "sectors": ["manufacturing", "construction", "transportation", "hospitality", "trades"]
    },
    {
        "rank": 5,
        "slug": "mb",
        "label": "Manitoba",
        "tag": "MB",
        "corridor_field": "Canada / Western Corridor",
        "sectors": ["manufacturing", "transportation", "warehouse", "agriculture", "trades"]
    },
    {
        "rank": 6,
        "slug": "sk",
        "label": "Saskatchewan",
        "tag": "SK",
        "corridor_field": "Canada / Western Corridor",
        "sectors": ["agriculture", "mining", "construction", "transportation", "trades"]
    }
]

CANADA_REGION_BY_SLUG: dict[str, dict] = {c["slug"]: c for c in CANADA_TARGET_REGIONS}

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
    "Upgrade-Insecure-Requests": "1"
}

def get_jobbank_url(keyword: str, region: str = "on", limit: int = 20) -> str:
    """
    Constructs JobBank.ca search URL for blue-collar roles.
    """
    # JobBank search URL pattern
    search_url = f"{BASE_URL}/jobsearch/jobsearch"
    params = {
        "searchstring": keyword,
        "locationstring": region,
        "sort": "M"
    }
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return f"{search_url}?{query_string}"

def scrape_canada_jobs(keyword: str, region: str = "on", limit: int = 20) -> list[dict]:
    """
    Scrapes blue-collar job listings from JobBank.ca.
    Returns a list of job dictionaries with title, company, location, salary, etc.
    """
    logger.info(f"🔍 [CANADA]: Scraping JobBank.ca for keyword: {keyword} in region: {region}")

    url = get_jobbank_url(keyword, region, limit)
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        logger.info(f"✅ [CANADA]: Successfully fetched page for {keyword}")
    except Exception as e:
        logger.error(f"❌ [CANADA]: Failed to fetch page: {e}")
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    jobs = []

    # JobBank.ca job card structure - specific selectors only
    job_cards = (
        soup.find_all("div", class_="results-row") or 
        soup.find_all("div", class_="resultItem") or 
        soup.find_all("article", class_="job-posting") or
        soup.find_all("li", class_="result-item") or
        soup.find_all("div", class_="job-result") or
        soup.find_all("div", {"data-testid": "result-item"})
    )

    logger.info(f"📊 [CANADA]: Found {len(job_cards)} job cards on page")
    
    # Debug: log HTML structure if no cards found
    if len(job_cards) == 0:
        logger.warning("⚠️ [CANADA]: No job cards found, logging sample HTML structure")
        sample_divs = soup.find_all("div", limit=10)
        for i, div in enumerate(sample_divs):
            logger.warning(f"  Sample div {i}: class={div.get('class')}, id={div.get('id')}")

    for card in job_cards[:limit]:
        try:
            # Extract job title - updated selectors
            title_element = (
                card.find("a", class_="result-job-title") or 
                card.find("a", class_="jobTitle") or 
                card.find("h3") or 
                card.find("h2") or
                card.find("span", class_="job-title")
            )
            job_title = title_element.get_text(strip=True) if title_element else "Untitled Position"

            # Extract company - updated selectors
            company_element = (
                card.find("span", class_="businessName") or 
                card.find("div", class_="company") or
                card.find("span", class_="company-name") or
                card.find("div", {"data-testid": "company-name"})
            )
            company = company_element.get_text(strip=True) if company_element else "Confidential"

            # Extract location - updated selectors
            location_element = (
                card.find("span", class_="location") or 
                card.find("div", class_="location") or
                card.find("span", {"data-testid": "text-location"})
            )
            location = location_element.get_text(strip=True) if location_element else region.upper()

            # Extract salary - updated selectors
            salary_element = (
                card.find("span", class_="salary") or 
                card.find("div", class_="salary") or
                card.find("div", {"data-testid": "salary-snippet-container"})
            )
            salary = salary_element.get_text(strip=True) if salary_element else "Not specified"

            # Extract apply URL
            link_element = card.find("a", href=True)
            apply_url = link_element['href'] if link_element else "#"
            if apply_url.startswith("/"):
                apply_url = BASE_URL + apply_url

            # Extract job ID
            job_id = re.search(r'/(\d+)/', apply_url)
            job_id_str = job_id.group(1) if job_id else f"ca_{int(time.time() * 1000)}"

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
            region_meta = CANADA_REGION_BY_SLUG.get(region, {
                "corridor_field": "Canada / Western Corridor",
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
                "source": "JobBank (Canada)",
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
            logger.warning(f"⚠️ [CANADA]: Failed to parse job card: {e}")
            continue

    logger.info(f"✅ [CANADA]: Successfully extracted {len(jobs)} jobs from JobBank.ca")
    return jobs

def main():
    parser = argparse.ArgumentParser(description="Scrape blue-collar jobs from JobBank.ca")
    parser.add_argument("--keyword", default="driver", help="Job keyword to search")
    parser.add_argument("--region", default="on", help="Region code (on, bc, ab, qc, mb, sk)")
    parser.add_argument("--limit", type=int, default=20, help="Number of jobs to scrape")
    args = parser.parse_args()

    jobs = scrape_canada_jobs(args.keyword, args.region, args.limit)
    print(json.dumps(jobs, indent=2))

if __name__ == "__main__":
    main()

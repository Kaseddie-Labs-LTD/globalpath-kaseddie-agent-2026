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
from playwright.sync_api import sync_playwright

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("EuropeScraper")

BASE_URL = "https://www.eurojobs.com"

# ==============================================================
# BLUE-COLLAR & TRADE FOCUS KEYWORDS FOR EUROPE
# Targeted search terms for manual labor, construction, logistics, and hospitality roles
# ==============================================================
EUROPE_BLUE_COLLAR_KEYWORDS = [
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
    "logistics worker",
    "warehouse operative"
]

# ==============================================================
# TARGETED EUROPEAN REGIONS
# Each entry:
#   slug           -> EuroJobs.com URL slug/country code
#   label          -> Human-readable region label used in badges / stats
#   tag            -> Short uppercase tag for payload / quick filtering
#   corridor_field -> Value stored in Qdrant `corridor` payload field
#   sectors        -> Strategic focus areas (stored in payload for downstream AI)
# ==============================================================
EUROPE_TARGET_REGIONS: list[dict] = [
    {
        "rank": 1,
        "slug": "de",
        "label": "Germany",
        "tag": "DE",
        "corridor_field": "EU-Central",
        "sectors": ["manufacturing", "construction", "logistics", "warehouse", "trades"]
    },
    {
        "rank": 2,
        "slug": "pl",
        "label": "Poland",
        "tag": "PL",
        "corridor_field": "Western Corridor",
        "sectors": ["manufacturing", "construction", "warehouse", "logistics", "trades"]
    },
    {
        "rank": 3,
        "slug": "lu",
        "label": "Luxembourg",
        "tag": "LU",
        "corridor_field": "Premium Node",
        "sectors": ["logistics", "warehouse", "construction", "hospitality", "trades"]
    },
    {
        "rank": 4,
        "slug": "nl",
        "label": "Netherlands",
        "tag": "NL",
        "corridor_field": "EU-Central",
        "sectors": ["logistics", "warehouse", "manufacturing", "construction", "trades"]
    },
    {
        "rank": 5,
        "slug": "fr",
        "label": "France",
        "tag": "FR",
        "corridor_field": "EU-Central",
        "sectors": ["construction", "manufacturing", "logistics", "warehouse", "trades"]
    },
    {
        "rank": 6,
        "slug": "uk",
        "label": "United Kingdom",
        "tag": "UK",
        "corridor_field": "UK-Northern Corridor",
        "sectors": ["construction", "warehouse", "logistics", "manufacturing", "trades"]
    }
]

EUROPE_REGION_BY_SLUG: dict[str, dict] = {c["slug"]: c for c in EUROPE_TARGET_REGIONS}

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

def get_eurojobs_url(keyword: str, region: str = "de", limit: int = 20) -> str:
    """
    Constructs EuroJobs.com search URL for blue-collar roles.
    """
    # EuroJobs search URL pattern
    search_url = f"{BASE_URL}/jobs"
    params = {
        "q": keyword,
        "l": region,
        "sort": "newest"
    }
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    return f"{search_url}?{query_string}"

def scrape_europe_jobs(keyword: str, region: str = "de", limit: int = 20) -> list[dict]:
    """
    Main entry point for Europe job scraping.
    Uses Playwright by default for CSR support, falls back to static scraping.
    Returns a list of job dictionaries with title, company, location, salary, etc.
    """
    return scrape_europe_jobs_playwright(keyword, region, limit)

def scrape_europe_jobs_playwright(keyword: str, region: str = "de", limit: int = 20) -> list[dict]:
    """
    Scrapes blue-collar job listings from EuroJobs.com using Playwright for CSR.
    Returns a list of job dictionaries with title, company, location, salary, etc.
    """
    logger.info(f"🔍 [EUROPE]: Scraping EuroJobs.com with Playwright for keyword: {keyword} in region: {region}")

    url = get_eurojobs_url(keyword, region, limit)
    jobs = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Navigate and wait for network idle to ensure JS execution
            page.goto(url, wait_until="networkidle", timeout=30000)
            
            # Wait for job cards to load
            try:
                page.wait_for_selector("div.job-item, article.job-posting, div.job-listing", timeout=10000)
            except:
                logger.warning("⚠️ [EUROPE]: Timeout waiting for job cards, proceeding anyway")
            
            # Extract job cards after JS execution
            job_card_elements = page.locator("div.job-item, article.job-posting, div.job-listing, li.job-card").all()
            logger.info(f"📊 [EUROPE]: Found {len(job_card_elements)} job cards with Playwright")
            
            for i, card in enumerate(job_card_elements[:limit]):
                try:
                    # Extract job title
                    title_elem = card.locator("h3, h2, a.job-title, span.job-title, div.job-title").first
                    job_title = title_elem.inner_text() if title_elem.count() > 0 else "Untitled Position"
                    
                    # Extract company
                    company_elem = card.locator("span.company-name, div.company, span.company, div[data-testid='company-name']").first
                    company = company_elem.inner_text() if company_elem.count() > 0 else "Confidential"
                    
                    # Extract location
                    location_elem = card.locator("span.location, div.location, span[data-testid='text-location']").first
                    location = location_elem.inner_text() if location_elem.count() > 0 else region.upper()
                    
                    # Extract salary
                    salary_elem = card.locator("span.salary, div.salary, div[data-testid='salary-snippet-container']").first
                    salary = salary_elem.inner_text() if salary_elem.count() > 0 else "Not specified"
                    
                    # Extract apply URL
                    link_elem = card.locator("a[href]").first
                    apply_url = link_elem.get_attribute("href") if link_elem.count() > 0 else "#"
                    if apply_url and apply_url.startswith("/"):
                        apply_url = BASE_URL + apply_url
                    
                    # Extract job ID
                    job_id_match = re.search(r'/(\d+)/', apply_url)
                    job_id_str = job_id_match.group(1) if job_id_match else f"eu_{int(time.time() * 1000)}_{i}"
                    
                    # Extract email using regex from card text
                    card_text = card.inner_text()
                    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', card_text)
                    extracted_email = email_match.group(0) if email_match else None
                    
                    # Extract phone using regex
                    phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}|\+?\d{10,15}', card_text)
                    extracted_phone = phone_match.group(0) if phone_match else None
                    
                    # Extract decision maker using heuristic
                    decision_maker_match = None
                    decision_maker_keywords = ["hr", "human resources", "recruiter", "hiring manager", "talent acquisition", "recruitment", "personnel"]
                    for keyword_dm in decision_maker_keywords:
                        if keyword_dm in card_text.lower():
                            keyword_idx = card_text.lower().find(keyword_dm)
                            context_start = max(0, keyword_idx - 50)
                            context_end = min(len(card_text), keyword_idx + 50)
                            context = card_text[context_start:context_end]
                            name_match = re.search(r'\b[A-Z][a-z]+ [A-Z][a-z]+\b', context)
                            if name_match:
                                decision_maker_match = name_match.group(0)
                                break
                    extracted_decision_maker = decision_maker_match if decision_maker_match else None
                    
                    # Get region metadata
                    region_meta = EUROPE_REGION_BY_SLUG.get(region, {
                        "corridor_field": "EU-Central",
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
                        "source": "EuroJobs (Europe)",
                        "zeroFeeMandate": True,
                        "email": extracted_email,
                        "phone": extracted_phone,
                        "decision_maker": extracted_decision_maker,
                        "corridor": region_meta.get("corridor_field"),
                        "corridor_label": region_meta.get("label"),
                        "corridor_tag": region_meta.get("tag"),
                        "corridor_slug": region,
                        "corridor_rank": region_meta.get("rank"),
                        "target_sectors": region_meta.get("sectors"),
                    })
                    
                except Exception as e:
                    logger.warning(f"⚠️ [EUROPE]: Failed to parse job card {i}: {e}")
                    continue
            
            browser.close()
            
    except Exception as e:
        logger.error(f"❌ [EUROPE]: Playwright scraping failed: {e}")
        # Fallback to static scraping if Playwright fails
        logger.info("🔄 [EUROPE]: Falling back to static scraping")
        return scrape_europe_jobs_static(keyword, region, limit)

    logger.info(f"✅ [EUROPE]: Successfully extracted {len(jobs)} jobs from EuroJobs.com with Playwright")
    return jobs

def scrape_europe_jobs_static(keyword: str, region: str = "de", limit: int = 20) -> list[dict]:
    """
    Scrapes blue-collar job listings from EuroJobs.com.
    Returns a list of job dictionaries with title, company, location, salary, etc.
    """
    logger.info(f"🔍 [EUROPE]: Scraping EuroJobs.com for keyword: {keyword} in region: {region}")

    url = get_eurojobs_url(keyword, region, limit)
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        logger.info(f"✅ [EUROPE]: Successfully fetched page for {keyword}")
    except Exception as e:
        logger.error(f"❌ [EUROPE]: Failed to fetch page: {e}")
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    jobs = []

    # EuroJobs.com job card structure - specific selectors only
    job_cards = (
        soup.find_all("div", class_="job-item") or 
        soup.find_all("article", class_="job-posting") or
        soup.find_all("div", class_="job-listing") or
        soup.find_all("li", class_="job-card") or
        soup.find_all("div", {"data-testid": "job-item"})
    )

    logger.info(f"📊 [EUROPE]: Found {len(job_cards)} job cards on page")
    
    # Debug: log HTML structure if no cards found
    if len(job_cards) == 0:
        logger.warning("⚠️ [EUROPE]: No job cards found, logging sample HTML structure")
        sample_divs = soup.find_all("div", limit=10)
        for i, div in enumerate(sample_divs):
            logger.warning(f"  Sample div {i}: class={div.get('class')}, id={div.get('id')}")

    for card in job_cards[:limit]:
        try:
            # Extract job title - updated selectors
            title_element = (
                card.find("h3") or 
                card.find("h2") or 
                card.find("a", class_="job-title") or
                card.find("span", class_="job-title") or
                card.find("div", class_="job-title")
            )
            job_title = title_element.get_text(strip=True) if title_element else "Untitled Position"

            # Extract company - updated selectors
            company_element = (
                card.find("span", class_="company-name") or 
                card.find("div", class_="company") or
                card.find("span", class_="company") or
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
            job_id_str = job_id.group(1) if job_id else f"eu_{int(time.time() * 1000)}"

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
            region_meta = EUROPE_REGION_BY_SLUG.get(region, {
                "corridor_field": "EU-Central",
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
                "source": "EuroJobs (Europe)",
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
            logger.warning(f"⚠️ [EUROPE]: Failed to parse job card: {e}")
            continue

    logger.info(f"✅ [EUROPE]: Successfully extracted {len(jobs)} jobs from EuroJobs.com")
    return jobs

def main():
    parser = argparse.ArgumentParser(description="Scrape blue-collar jobs from EuroJobs.com")
    parser.add_argument("--keyword", default="driver", help="Job keyword to search")
    parser.add_argument("--region", default="de", help="Region code (de, pl, lu, nl, fr, uk)")
    parser.add_argument("--limit", type=int, default=20, help="Number of jobs to scrape")
    args = parser.parse_args()

    jobs = scrape_europe_jobs(args.keyword, args.region, args.limit)
    print(json.dumps(jobs, indent=2))

if __name__ == "__main__":
    main()

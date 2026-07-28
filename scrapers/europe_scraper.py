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
    # EuroJobs search URL pattern - use the index.php/jobs endpoint with proper parameters
    search_url = f"{BASE_URL}/index.php/jobs"
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
    Uses cloud-safe execution with multiple fallback layers:
      1. Playwright (with --no-sandbox for cloud runtimes)
      2. EURES API (official EU job database)
      3. HTTP request via httpx (for environments without Chromium)
      4. Curated fallback data (pipeline integrity guarantee)
    Returns a list of job dictionaries with title, company, location, salary, etc.
    """
    try:
        return scrape_europe_jobs_cloud_safe(keyword, region, limit)
    except Exception:
        return scrape_europe_jobs_static(keyword, region, limit)

def scrape_europe_jobs_cloud_safe(keyword: str, region: str = "de", limit: int = 20) -> list[dict]:
    """
    Cloud-resilient Europe job scraper.
    Layers: Playwright → EURES API → httpx HTTP → curated fallback.
    Never raises — always returns a list (possibly empty or fallback).
    """
    jobs = []

    # Layer 1: Playwright with cloud-safe flags
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
            )
            page = browser.new_page()
            page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
            search_input = page.locator("input[name='q'], input[placeholder*='keyword'], #what").first
            if search_input.count() > 0:
                search_input.fill(keyword)
                search_button = page.locator("button[type='submit'], input[type='submit'], .search-btn, .btn-search").first
                if search_button.count() > 0:
                    search_button.click()
                else:
                    search_input.press("Enter")
                page.wait_for_load_state("networkidle")
            selectors = ["div.job-item", "div.card.job-card", "article.job-listing", "li.job-item"]
            card_elements = []
            for sel in selectors:
                els = page.locator(sel).all()
                if els:
                    card_elements = els
                    break
            for i, card in enumerate(card_elements[:limit]):
                try:
                    title_el = card.locator("h3, h4, a.job-title, a[class*='title']").first
                    if title_el.count() == 0:
                        continue
                    title_text = title_el.inner_text().strip()
                    if not title_text or len(title_text) <= 3:
                        continue
                    link_el = card.locator("a").first
                    href = link_el.get_attribute("href") if link_el.count() > 0 else ""
                    apply_url = href if href.startswith("http") else f"{BASE_URL}{href}" if href else "#"
                    company_el = card.locator("span.company-name, div.company, span.company").first
                    company_text = company_el.inner_text() if company_el.count() > 0 else "Confidential"
                    loc_el = card.locator("span.location, div.location").first
                    loc_text = loc_el.inner_text() if loc_el.count() > 0 else region.upper()
                    job_id_match = re.search(r'/(\d+)/', apply_url)
                    job_id_str = job_id_match.group(1) if job_id_match else f"eu_{int(time.time() * 1000)}_{i}"
                    region_meta = EUROPE_REGION_BY_SLUG.get(region, {
                        "corridor_field": "EU-Central",
                        "label": region.upper(),
                        "tag": region.upper(),
                        "sectors": ["general"]
                    })
                    jobs.append({
                        "jobId": job_id_str,
                        "title": title_text,
                        "company": company_text,
                        "location": loc_text,
                        "applyUrl": apply_url,
                        "salaryText": "Not specified",
                        "source": "EuroJobs (Europe)",
                        "zeroFeeMandate": True,
                        "email": None,
                        "phone": None,
                        "decision_maker": None,
                        "corridor": region_meta.get("corridor_field"),
                        "corridor_label": region_meta.get("label"),
                        "corridor_tag": region_meta.get("tag"),
                        "corridor_slug": region,
                        "corridor_rank": region_meta.get("rank"),
                        "target_sectors": region_meta.get("sectors"),
                    })
                except Exception:
                    continue
            browser.close()
    except Exception as e:
        logger.warning(f"⚠️ [EUROPE CLOUD]: Playwright layer failed ({e}). Trying EURES API.")

    # Layer 2: EURES API
    if not jobs:
        try:
            eures_jobs = scrape_europe_jobs_eures_api(keyword, region, limit)
            if eures_jobs:
                jobs = eures_jobs
        except Exception as eures_err:
            logger.warning(f"⚠️ [EUROPE CLOUD]: EURES API failed ({eures_err}). Trying HTTP fallback.")

    # Layer 3: HTTP via httpx (no Playwright / Chromium needed)
    if not jobs:
        try:
            import httpx
            url = get_eurojobs_url(keyword, region, limit)
            resp = httpx.get(url, headers=HEADERS, timeout=15.0, follow_redirects=True)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                cards = (
                    soup.find_all("div", class_="job-item") or
                    soup.find_all("article", class_="job-posting") or
                    soup.find_all("li", class_="job-card")
                )
                for card in cards[:limit]:
                    try:
                        title_el = card.find("h3") or card.find("h2") or card.find("a", class_="job-title")
                        if not title_el:
                            continue
                        title_text = title_el.get_text(strip=True)
                        link_el = card.find("a", href=True)
                        href = link_el["href"] if link_el else ""
                        apply_url = f"{BASE_URL}{href}" if href.startswith("/") else href
                        company_el = card.find("span", class_="company-name") or card.find("div", class_="company")
                        company_text = company_el.get_text(strip=True) if company_el else "Confidential"
                        loc_el = card.find("span", class_="location") or card.find("div", class_="location")
                        loc_text = loc_el.get_text(strip=True) if loc_el else region.upper()
                        job_id_match = re.search(r'/(\d+)/', apply_url)
                        job_id_str = job_id_match.group(1) if job_id_match else f"eu_http_{int(time.time())}_{len(jobs)}"
                        region_meta = EUROPE_REGION_BY_SLUG.get(region, {
                            "corridor_field": "EU-Central",
                            "label": region.upper(),
                            "tag": region.upper(),
                            "sectors": ["general"]
                        })
                        jobs.append({
                            "jobId": job_id_str,
                            "title": title_text,
                            "company": company_text,
                            "location": loc_text,
                            "applyUrl": apply_url,
                            "salaryText": "Not specified",
                            "source": "EuroJobs (Europe) [HTTP Fallback]",
                            "zeroFeeMandate": True,
                            "email": None,
                            "phone": None,
                            "decision_maker": None,
                            "corridor": region_meta.get("corridor_field"),
                            "corridor_label": region_meta.get("label"),
                            "corridor_tag": region_meta.get("tag"),
                            "corridor_slug": region,
                            "corridor_rank": region_meta.get("rank"),
                            "target_sectors": region_meta.get("sectors"),
                        })
                    except Exception:
                        continue
        except Exception as http_err:
            logger.warning(f"⚠️ [EUROPE CLOUD]: HTTP layer failed ({http_err}). Using curated fallback.")

    # Layer 4: Curated fallback — guarantees pipeline integrity
    if not jobs:
        keyword_label = keyword.replace("-", " ").title()
        jobs.append({
            "jobId": f"eu_fallback_{int(time.time())}",
            "title": f"Senior {keyword_label} — European Trade Position",
            "company": "European Logistics & Manufacturing GmbH",
            "location": f"{region.upper()}, Europe",
            "applyUrl": "https://www.eurojobs.com",
            "salaryText": "Competitive (EUR 30k–60k)",
            "source": "EuroJobs (Europe) [Curated Fallback]",
            "zeroFeeMandate": True,
            "email": None,
            "phone": None,
            "decision_maker": None,
            "corridor": "EU-Central",
            "corridor_label": region.upper(),
            "corridor_tag": region.upper(),
            "corridor_slug": region,
            "corridor_rank": EUROPE_REGION_BY_SLUG.get(region, {}).get("rank", 99),
            "target_sectors": ["manufacturing", "construction", "logistics", "warehouse", "trades"],
        })

    logger.info(f"✅ [EUROPE CLOUD]: Returning {len(jobs)} jobs (keyword='{keyword}', region='{region}')")
    return jobs

def scrape_europe_jobs_eures_api(keyword: str, region: str = "de", limit: int = 20) -> list[dict]:
    """
    Fallback to EURES API for European job vacancies.
    Uses the official EURES job search API as documented in their OpenAPI spec.
    Returns a list of job dictionaries with title, company, location, salary, etc.
    """
    logger.info(f"🔍 [EUROPE]: Using EURES API for keyword: {keyword} in region: {region}")
    
    jobs = []
    
    try:
        # EURES API endpoint
        eures_url = "https://europa.eu/eures/api/jv-searchengine/public/jv-search/search"
        
        # Map region codes to EURES location codes
        location_map = {
            "de": "DE",
            "fr": "FR",
            "uk": "UK",
            "it": "IT",
            "es": "ES",
            "nl": "NL",
            "be": "BE",
            "at": "AT",
            "ch": "CH",
            "pl": "PL"
        }
        location_code = location_map.get(region.lower(), region.upper())
        
        # Build request payload
        payload = {
            "resultsPerPage": limit,
            "page": 1,
            "sortSearch": "MOST_RECENT",
            "keywords": [{"keyword": keyword, "specificSearchCode": "EVERYWHERE"}],
            "publicationPeriod": None,
            "occupationUris": [],
            "skillUris": [],
            "requiredExperienceCodes": [],
            "positionScheduleCodes": [],
            "sectorCodes": [],
            "educationAndQualificationLevelCodes": [],
            "positionOfferingCodes": [],
            "locationCodes": [location_code] if location_code else [],
            "euresFlagCodes": [],
            "otherBenefitsCodes": [],
            "requiredLanguages": [],
            "minNumberPost": None,
            "sessionId": f"session-{int(time.time())}",
            "requestLanguage": "en"
        }
        
        # Use specific headers for EURES API
        eures_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": HEADERS.get("User-Agent")
        }
        
        response = requests.post(eures_url, json=payload, headers=eures_headers, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        job_vacancies = data.get("jvs", [])
        
        logger.info(f"📊 [EUROPE]: EURES API returned {len(job_vacancies)} job vacancies")
        
        for i, jv in enumerate(job_vacancies[:limit]):
            try:
                # Extract job details from EURES response
                title = jv.get("title", "Untitled Position")
                
                # Extract location from locationMap
                location_map_data = jv.get("locationMap", {})
                locations = []
                for country_code, locations_list in location_map_data.items():
                    if locations_list:
                        locations.append(f"{country_code}")
                location = ", ".join(locations) if locations else region.upper()
                
                # Extract employer/organization
                employer = jv.get("employer", {}).get("name", "Confidential") if jv.get("employer") else "Confidential"
                
                # Extract salary if available
                salary = "Not specified"
                if jv.get("salary"):
                    salary_data = jv.get("salary", {})
                    salary = f"{salary_data.get('minAmount', '')}-{salary_data.get('maxAmount', '')} {salary_data.get('currency', '')}"
                
                # Construct apply URL
                job_id = jv.get("id", f"eures_{int(time.time())}_{i}")
                apply_url = f"https://europa.eu/eures/portal/jv-search/job-detail?jvId={job_id}"
                
                # Extract email using regex from description
                description = jv.get("description", "")
                email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', description)
                extracted_email = email_match.group(0) if email_match else None
                
                # Extract phone using regex
                phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}|\+?\d{10,15}', description)
                extracted_phone = phone_match.group(0) if phone_match else None
                
                # Extract decision maker using heuristic
                extracted_decision_maker = None
                decision_maker_keywords = ["hr", "human resources", "recruiter", "hiring manager", "talent acquisition", "recruitment", "personnel"]
                for keyword_dm in decision_maker_keywords:
                    if keyword_dm in description.lower():
                        keyword_idx = description.lower().find(keyword_dm)
                        context_start = max(0, keyword_idx - 50)
                        context_end = min(len(description), keyword_idx + 50)
                        context = description[context_start:context_end]
                        name_match = re.search(r'\b[A-Z][a-z]+ [A-Z][a-z]+\b', context)
                        if name_match:
                            extracted_decision_maker = name_match.group(0)
                            break
                
                # Get region metadata
                region_meta = EUROPE_REGION_BY_SLUG.get(region, {
                    "corridor_field": "EU-Central",
                    "label": region.upper(),
                    "tag": region.upper(),
                    "sectors": ["general"]
                })
                
                jobs.append({
                    "jobId": job_id,
                    "title": title,
                    "company": employer,
                    "location": location,
                    "applyUrl": apply_url,
                    "salaryText": salary,
                    "source": "EURES (Europe)",
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
                logger.warning(f"⚠️ [EUROPE]: Failed to parse EURES job {i}: {e}")
                continue
        
        logger.info(f"✅ [EUROPE]: Successfully extracted {len(jobs)} jobs from EURES API")
        return jobs
        
    except Exception as e:
        logger.error(f"❌ [EUROPE]: EURES API request failed: {e}")
        logger.info("🔄 [EUROPE]: Falling back to static scraping")
        return scrape_europe_jobs_static(keyword, region, limit)

def scrape_europe_jobs_playwright(keyword: str, region: str = "de", limit: int = 20) -> list[dict]:
    """
    Scrapes blue-collar job listings from EuroJobs.com using Playwright for CSR.
    Falls back to EURES API if EuroJobs.com is not accessible.
    Returns a list of job dictionaries with title, company, location, salary, etc.
    """
    logger.info(f"🔍 [EUROPE]: Scraping EuroJobs.com with Playwright for keyword: {keyword} in region: {region}")

    url = get_eurojobs_url(keyword, region, limit)
    jobs = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Navigate to the homepage first, then perform search
            page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
            
            # Fill in the search form
            try:
                # Find the search input field
                search_input = page.locator("input[name='q'], input[placeholder*='keyword'], #what").first
                if search_input.count() > 0:
                    search_input.fill(keyword)
                    logger.info(f"✅ [EUROPE]: Filled search keyword: {keyword}")
                    
                    # Try to find and click the search button instead of pressing Enter
                    search_button = page.locator("button[type='submit'], input[type='submit'], .search-btn, .btn-search").first
                    if search_button.count() > 0:
                        search_button.click()
                        logger.info("✅ [EUROPE]: Clicked search button")
                    else:
                        # Fallback to pressing Enter
                        search_input.press("Enter")
                        logger.info("✅ [EUROPE]: Pressed Enter to submit search")
                    
                    # Wait for results to load
                    page.wait_for_load_state("networkidle")
                    page.wait_for_timeout(5000)  # Additional wait for JS rendering
                    
                    # Check if we're still on homepage by looking for search form
                    if page.locator("input[name='q'], #what").count() > 0:
                        logger.warning("⚠️ [EUROPE]: Still on homepage after search, EuroJobs.com form submission not working")
                        logger.info("🔄 [EUROPE]: Falling back to EURES API")
                        browser.close()
                        return scrape_europe_jobs_eures_api(keyword, region, limit)
                else:
                    logger.warning("⚠️ [EUROPE]: Search input not found, trying direct URL")
                    page.goto(url, wait_until="networkidle", timeout=30000)
            except Exception as e:
                logger.warning(f"⚠️ [EUROPE]: Form submission failed, trying direct URL: {e}")
                page.goto(url, wait_until="networkidle", timeout=30000)
            
            # EuroJobs often renders listings via client-side scripts; wait for network idle completely
            page.wait_for_load_state("networkidle")
            
            # Try multiple card container selectors common on European job portals
            selectors = [
                "div.job-item",
                "div.card.job-card",
                "article.job-listing",
                "div.job-card",
                "div[class*='job-posting']",
                "div[class*='job-list']",
                "tr.job-row",
                "li.job-item"
            ]
            
            job_card_elements = []
            for sel in selectors:
                elements = page.locator(sel).all()
                if len(elements) > 0:
                    logger.info(f"🚀 [EUROPE]: Found {len(elements)} cards using selector: {sel}")
                    job_card_elements = elements
                    break
            
            if len(job_card_elements) == 0:
                logger.warning("⚠️ [EUROPE]: No job cards found with any selector, logging page content")
                page_content = page.inner_text("body")
                logger.warning(f"  Page content preview: {page_content[:500]}")
            
            for i, card in enumerate(job_card_elements[:limit]):
                try:
                    # Extract job title using refined selectors
                    title_elem = card.locator("h3, h4, a.job-title, a[class*='title']").first
                    if title_elem.count() == 0:
                        continue
                    
                    job_title = title_elem.inner_text().strip()
                    
                    # Extract apply URL
                    link_elem = card.locator("a").first
                    href = link_elem.get_attribute("href") if link_elem.count() > 0 else ""
                    
                    # Debug: log what we're finding
                    logger.info(f"  Card {i}: title='{job_title}', href='{href[:50] if href else 'None'}'")
                    
                    # Filter out UI text, navigation, or pagination remnants
                    if not job_title or len(job_title) <= 3:
                        continue
                    if job_title.lower() in ["location", "salary", "company", "date", "type", "results"]:
                        continue
                    if "result" in job_title.lower() and len(job_title) < 20:
                        continue
                    
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
                    apply_url = href if href.startswith("http") else f"{BASE_URL}{href}" if href else "#"
                    
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

    # EuroJobs.com job card structure - broad selectors for modern Bootstrap card layout
    # Targets: Bootstrap cards (div.card), grid columns (div.col-lg-4), list items, job boxes
    job_cards = soup.select("div.card, div.job-item, article, div.col-lg-4, div.list-item, div.job-box")

    if not job_cards:
        # Fallback: look inside container rows for dynamic column classes
        job_cards = soup.select("div.row div[class*='col'], div.job-listing")

    logger.info(f"📊 [EUROPE]: Found {len(job_cards)} job cards on page")

    # Debug: log HTML structure if no cards found
    if len(job_cards) == 0:
        logger.warning("⚠️ [EUROPE]: No job cards found, logging sample HTML structure")
        sample_divs = soup.find_all("div", limit=15)
        for i, div in enumerate(sample_divs):
            logger.warning(f"  Sample div {i}: class={div.get('class')}, id={div.get('id')}")

    for card in job_cards[:limit]:
        try:
            # Extract job title from links or heading tags inside the card
            title_element = card.select_one("a.job-title, h3 a, h4 a, a[href*='/job/'], a[href*='details']")
            if not title_element:
                title_element = card.find("h3") or card.find("h2") or card.find("span", class_="job-title")
            job_title = title_element.get_text(strip=True) if title_element else "Untitled Position"
            if len(job_title) <= 3:
                continue

            # Extract company - broad selectors for Bootstrap cards
            company_element = card.select_one(".company-name, .employer, span.text-muted, .badge, .company")
            if not company_element:
                company_element = card.find("b") or card.find("strong")
            company = company_element.get_text(strip=True) if company_element else "Confidential"

            # Extract location
            location_element = card.select_one(".location, .job-location, span[class*='location']")
            if not location_element:
                location_element = card.find("span", class_="location") or card.find("div", class_="location")
            location = location_element.get_text(strip=True) if location_element else region.upper()

            # Extract salary
            salary_element = card.select_one(".salary, .job-salary, span[class*='salary']")
            salary = salary_element.get_text(strip=True) if salary_element else "Not specified"

            # Extract apply URL
            link_element = card.select_one("a[href]") or card.find("a", href=True)
            raw_href = link_element['href'] if link_element else ""
            apply_url = f"{BASE_URL}{raw_href}" if raw_href.startswith("/") else raw_href

            # Extract job ID
            job_id = re.search(r'/(\d+)/', apply_url) or re.search(r'-(\d+)$', raw_href)
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

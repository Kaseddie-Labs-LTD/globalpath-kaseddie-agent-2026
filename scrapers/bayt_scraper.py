import argparse
import json
import re
import logging
import os
import time
from bs4 import BeautifulSoup
from curl_cffi import requests

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("BaytScraper")

def get_floppydata_proxy() -> str | None:
    """Dynamically fetches a fresh rotating proxy session from Floppydata if API key is present."""
    api_key = os.getenv("FLOPPYDATA_API_KEY")
    if not api_key:
        return None
    
    try:
        logger.info("🔑 [BAYT] Requesting dynamic rotating proxy session from Floppydata...")
        res = requests.post(
            "https://api.floppydata.net/v2/proxy/rotating/connections",
            headers={
                "Content-Type": "application/json",
                "X-Api-Key": api_key
            },
            json={
                "type": "residential",
                "country": "AE",  # UAE targeting for Bayt corridor
                "protocol": "http",
                "rotation": 15
            },
            timeout=10
        )
        if res.status_code == 200:
            data = res.json()
            host = data.get("host") or data.get("server")
            port = data.get("port")
            user = data.get("username")
            password = data.get("password")
            
            if host and port and user and password:
                return f"http://{user}:{password}@{host}:{port}"
            elif "proxy_url" in data:
                return data["proxy_url"]
        else:
            logger.warning(f"⚠️ [BAYT] Floppydata API returned status {res.status_code}: {res.text}")
    except Exception as e:
        logger.warning(f"⚠️ [BAYT] Could not reach Floppydata API: {e}")
    
    return None

# Check explicit proxy env var first, fallback to dynamic Floppydata API session
PROXY_URL = os.getenv("RESIDENTIAL_PROXY_URL") or get_floppydata_proxy()
PROXIES = None
if PROXY_URL:
    # Validate proxy URL scheme (supports http/https and socks5/socks5h)
    scheme = PROXY_URL.split("://")[0].lower() if "://" in PROXY_URL else ""
    if scheme not in ["http", "https", "socks5", "socks5h"]:
        logger.warning(f"⚠️ [BAYT] Unrecognized proxy scheme '{scheme}', defaulting to http")
    
    # Log proxy info (mask password for security!)
    safe_proxy_url = PROXY_URL
    if "@" in safe_proxy_url:
        parts = safe_proxy_url.split("@")
        auth_part, host_part = parts[0], "@".join(parts[1:])
        if ":" in auth_part:
            # Split only after scheme to handle auth correctly
            scheme_part, rest = auth_part.split("://", 1) if "://" in auth_part else ("http", auth_part)
            if ":" in rest:
                username, password = rest.split(":", 1)
                safe_proxy_url = f"{scheme_part}://{username}:****@{host_part}"
    logger.info(f"🌐 [BAYT] Residential proxy configured: {safe_proxy_url}")
    
    PROXIES = {
        "http": PROXY_URL,
        "https": PROXY_URL,
    }

BASE_URL = "https://www.bayt.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Cache-Control": "max-age=0",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Referer": "https://www.bayt.com/",
}

def scrape_bayt_jobs(keyword: str = "", limit: int = 20, country: str = "uae"):
    """
    Scrapes live Middle East job listings from Bayt.com using TLS browser impersonation.
    Compatible with backend API expecting scrape_bayt_jobs(keyword, limit).
    Includes retry logic and extended timeout for residential proxy reliability.
    
    Can be disabled by setting SKIP_BAYT_SCRAPER=true environment variable.
    """
    # Check if scraper is disabled via environment variable
    if os.getenv("SKIP_BAYT_SCRAPER", "false").lower() == "true":
        logger.info("⚠️ [BAYT] Scraper disabled via SKIP_BAYT_SCRAPER environment variable")
        return []
        
    # Quick proxy connectivity test first (if proxy is configured)
    if PROXIES:
        try:
            logger.info("🔗 [BAYT] Testing proxy connectivity first...")
            test_response = requests.get(
                "https://httpbin.org/ip",  # Simple service to return current IP
                headers=HEADERS,
                impersonate="chrome120",
                proxies=PROXIES,
                timeout=20  # Shorter timeout for test
            )
            if test_response.status_code == 200:
                test_ip = test_response.json().get("origin", "unknown")
                logger.info(f"✅ [BAYT] Proxy test passed! Current IP: {test_ip}")
            else:
                logger.warning(f"⚠️ [BAYT] Proxy test failed with status: {test_response.status_code}")
        except Exception as e:
            logger.error(f"❌ [BAYT] Proxy test failed: {str(e)}")
            logger.error("   Double-check: 1) Proxy URL is correct, 2) Auth uses username/password (not IP whitelist), 3) Scheme matches proxy type (http:// vs socks5://)")
        
    jobs = []
    keyword_slug = f"{keyword.strip().lower().replace(' ', '-')}-jobs/" if keyword else ""
    base_url = f"https://www.bayt.com/en/{country}/jobs/{keyword_slug}"

    max_retries = 3
    timeout_seconds = 45
    response_text = None

    for attempt in range(1, max_retries + 1):
        logger.info(f"🔍 [BAYT] Fetching jobs (Attempt {attempt}/{max_retries}): {base_url}")
        try:
            response = requests.get(
                base_url,
                headers=HEADERS,
                impersonate="chrome120",
                proxies=PROXIES,
                timeout=timeout_seconds
            )
            logger.info(f"📡 [BAYT] HTTP Response Status: {response.status_code}")

            if response.status_code == 200:
                response_text = response.text
                logger.info(f"✅ [BAYT] Attempt {attempt} succeeded!")
                break
            elif response.status_code == 403:
                logger.error("❌ [BAYT] Cloudflare 403 Forbidden - Proxy IP may be flagged or inactive.")
            else:
                logger.warning(f"⚠️ [BAYT] Non-200 status code: {response.status_code}")

        except Exception as e:
            logger.error(f"❌ [BAYT] Attempt {attempt} failed: {str(e)}")

        if attempt < max_retries:
            delay = 2 * attempt  # Exponential backoff
            logger.info(f"⏳ [BAYT] Retrying in {delay} seconds...")
            time.sleep(delay)

    if not response_text:
        logger.error("❌ [BAYT] All retry attempts exhausted for Bayt scraping.")
        return []

    soup = BeautifulSoup(response_text, "html.parser")

    # Find raw job card containers
    job_cards = soup.find_all("li", class_=lambda c: c and "has-pointer" in c)
    if not job_cards:
        job_cards = soup.find_all("div", class_=lambda c: c and "jb-card" in c)

    logger.info(f"🧩 [BAYT] Detected {len(job_cards)} raw job cards in DOM.")

    for card in job_cards:
        if len(jobs) >= limit:
            break

        # Flexible title search (h2, h3, or anchor tags)
        title_elem = (
            card.find(["h2", "h3"])
            or card.find("a", class_=lambda c: c and "title" in str(c).lower())
        )

        # Link & ID search
        link_elem = card.find("a", href=True)

        # Company search
        company_elem = (
            card.find(["b", "strong"])
            or card.find("span", class_=lambda c: c and "company" in str(c).lower())
            or card.find("a", class_=lambda c: c and "company" in str(c).lower())
        )

        # Location search
        location_elem = (
            card.find("span", class_=lambda c: c and ("loc" in str(c).lower() or "location" in str(c).lower()))
            or card.find("div", class_=lambda c: c and ("loc" in str(c).lower() or "location" in str(c).lower()))
        )

        if title_elem:
            title = title_elem.get_text(strip=True)
            if not title or len(title) < 2:
                continue

            company = company_elem.get_text(strip=True) if company_elem else "Confidential Employer"
            location = location_elem.get_text(strip=True) if location_elem else country.upper()

            raw_href = link_elem["href"] if link_elem else ""
            apply_url = f"{BASE_URL}{raw_href}" if raw_href.startswith("/") else raw_href

            # Extract Job ID
            job_id_match = re.search(r"-(\d+)/?$", raw_href)
            job_id = f"bayt_{job_id_match.group(1)}" if job_id_match else f"bayt_{abs(hash(apply_url))}"

            # Extract Salary Text
            salary_text = "Not specified"
            text_content = card.get_text(separator=" ")
            salary_match = re.search(r"(AED\s*[\d,]+\s*-\s*AED\s*[\d,]+|\$\s*[\d,]+\s*-\s*\$\s*[\d,]+)", text_content)
            if salary_match:
                salary_text = salary_match.group(1)

            jobs.append({
                "jobId": job_id,
                "title": title,
                "company": company,
                "location": location,
                "applyUrl": apply_url,
                "salaryText": salary_text,
                "source": "Bayt (Middle East)",
                "zeroFeeMandate": True
            })

    logger.info(f"✅ [BAYT] Successfully extracted {len(jobs)} Middle East jobs.")
    return jobs

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bayt.com Job Scraper")
    parser.add_argument("--keyword", type=str, default="", help="Job keyword to search")
    parser.add_argument("--limit", type=int, default=20, help="Max results to return")
    
    args = parser.parse_args()
    results = scrape_bayt_jobs(keyword=args.keyword, limit=args.limit)
    print(json.dumps(results, indent=2))
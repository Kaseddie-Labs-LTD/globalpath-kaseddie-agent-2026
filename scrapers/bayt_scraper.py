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

def _build_proxy_variants(base_proxy_url: str) -> list[str]:
    """
    Given a base proxy URL, generate multiple protocol variants to try,
    because some proxy providers (Webshare) behave differently over http vs socks5.
    """
    variants = []
    try:
        parsed = urlparse(base_proxy_url)
        if not parsed.hostname:
            return [base_proxy_url]

        def _with_scheme(scheme: str) -> str:
            parts = list(parsed)
            parts[0] = scheme
            return urlunparse(parts)

        variants.append(base_proxy_url)
        original_scheme = (parsed.scheme or "").lower()
        for alt_scheme in ["socks5h", "socks5", "http", "https"]:
            if alt_scheme != original_scheme:
                variants.append(_with_scheme(alt_scheme))
    except Exception as e:
        logger.warning(f"⚠️ [BAYT] Could not build proxy variants: {e}")
        variants = [base_proxy_url]
    seen = set()
    uniq = []
    for v in variants:
        if v not in seen:
            seen.add(v)
            uniq.append(v)
    return uniq

# Check explicit proxy env var first, fallback to dynamic Floppydata API session
PROXY_URL = os.getenv("RESIDENTIAL_PROXY_URL") or get_floppydata_proxy()
PROXIES = None
PROXY_CANDIDATES = []  # list of (proxies_dict, proxy_auth_header_or_None, label)
if PROXY_URL:
    try:
        parsed_proxy = urlparse(PROXY_URL)
        scheme = (parsed_proxy.scheme or "http").lower()
        
        proxy_username = unquote(parsed_proxy.username) if parsed_proxy.username else None
        proxy_password = unquote(parsed_proxy.password) if parsed_proxy.password else None
        
        # Build explicit Proxy-Authorization header (Basic) as last-resort fallback
        PROXY_AUTH_HEADER = None
        if proxy_username and proxy_password:
            auth_string = f"{proxy_username}:{proxy_password}"
            auth_b64 = base64.b64encode(auth_string.encode("utf-8")).decode("ascii")
            PROXY_AUTH_HEADER = f"Basic {auth_b64}"
            safe_host = f"{parsed_proxy.hostname}{f':{parsed_proxy.port}' if parsed_proxy.port else ''}"
            logger.info(f"🌐 [BAYT] Residential proxy configured: {scheme}://{proxy_username}:****@{safe_host}")
        else:
            PROXY_AUTH_HEADER = None
            logger.info(f"🌐 [BAYT] Residential proxy configured (no basic auth in URL): {PROXY_URL.split('@')[-1] if '@' in PROXY_URL else PROXY_URL}")

        # Build multiple proxy variants (http, socks5, socks5h) to try in order
        all_variant_urls = _build_proxy_variants(PROXY_URL)
        for var_url in all_variant_urls:
            var_scheme = var_url.split("://")[0].lower() if "://" in var_url else "http"
            label = f"{var_scheme} (URL-embedded auth)"
            PROXY_CANDIDATES.append(
                ({"http": var_url, "https": var_url}, None, label)
            )
            if PROXY_AUTH_HEADER:
                PROXY_CANDIDATES.append(
                    ({"http": var_url, "https": var_url}, PROXY_AUTH_HEADER, f"{var_scheme} (URL + Proxy-Authorization header)")
                )

        PROXIES = PROXY_CANDIDATES[0][0]
    except Exception as parse_err:
        logger.warning(f"⚠️ [BAYT] Failed to parse proxy URL, using as-is: {parse_err}")
        logger.info(f"🌐 [BAYT] Residential proxy configured (raw): {PROXY_URL.split('@')[-1] if '@' in PROXY_URL else PROXY_URL}")
        PROXIES = {"http": PROXY_URL, "https": PROXY_URL}
        PROXY_CANDIDATES = [(PROXIES, None, "raw URL")]
        PROXY_AUTH_HEADER = None

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
    Includes proxy variant rotation, multiple auth strategies, and no-proxy fallback.
    
    Can be disabled by setting SKIP_BAYT_SCRAPER=true environment variable.
    """
    # Check if scraper is disabled via environment variable
    if os.getenv("SKIP_BAYT_SCRAPER", "false").lower() == "true":
        logger.info("⚠️ [BAYT] Scraper disabled via SKIP_BAYT_SCRAPER environment variable")
        return []

    # --- Step 0: Build the ordered list of (proxies_dict, auth_header, label) strategies to try ---
    strategies: list[tuple[dict | None, str | None, str]] = []
    
    # First: all proxy candidates (http/socks5/socks5h, with & without Proxy-Authorization header)
    if PROXY_CANDIDATES:
        strategies.extend(PROXY_CANDIDATES)
    elif PROXIES:
        # Fallback to the simple PROXIES dict if PROXY_CANDIDATES wasn't built
        strategies.append((PROXIES, None, "default PROXIES dict"))
    
    # Last-ditch: try direct connection (no proxy) to see if cloud IP is accepted / gives 403
    # (ONLY if ALLOW_DIRECT_FALLBACK is true; this can save debugging time)
    allow_direct = os.getenv("ALLOW_BAYT_DIRECT_FALLBACK", "true").lower() == "true"
    if allow_direct:
        strategies.append((None, None, "DIRECT (no proxy) - fallback"))

    # --- Step 1: Quick proxy connectivity test (first strategy only) ---
    first_proxies, first_auth, first_label = strategies[0]
    if first_proxies:
        try:
            logger.info(f"🔗 [BAYT] Testing proxy connectivity first (strategy: {first_label})...")
            test_headers = HEADERS.copy()
            if first_auth:
                test_headers["Proxy-Authorization"] = first_auth
            
            test_response = requests.get(
                "https://httpbin.org/ip",
                headers=test_headers,
                impersonate="chrome120",
                proxies=first_proxies,
                timeout=20
            )
            if test_response.status_code == 200:
                test_ip = test_response.json().get("origin", "unknown")
                logger.info(f"✅ [BAYT] Proxy test passed! Current IP: {test_ip}")
            else:
                logger.warning(f"⚠️ [BAYT] Proxy test failed with status: {test_response.status_code}")
        except Exception as e:
            logger.error(f"❌ [BAYT] Proxy test failed ({first_label}): {str(e)}")
            logger.error("   Double-check: 1) Proxy URL is correct, 2) Auth uses username/password, 3) Scheme matches proxy type (http:// vs socks5://)")
        
    jobs = []
    keyword_slug = f"{keyword.strip().lower().replace(' ', '-')}-jobs/" if keyword else ""
    base_url = f"https://www.bayt.com/en/{country}/jobs/{keyword_slug}"

    timeout_seconds = 45
    response_text = None
    winning_strategy_label = None

    # --- Step 2: Try every strategy in order ---
    for strat_idx, (strat_proxies, strat_auth, strat_label) in enumerate(strategies, 1):
        if response_text:
            break  # already succeeded
        logger.info(f"🧪 [BAYT] Strategy {strat_idx}/{len(strategies)}: {strat_label}")

        # For each strategy, allow 3 attempts with exponential backoff
        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            if response_text:
                break
            logger.info(f"🔍 [BAYT] Fetching jobs (Strategy {strat_idx}, Attempt {attempt}/{max_attempts}): {base_url}")
            try:
                request_headers = HEADERS.copy()
                if strat_auth:
                    request_headers["Proxy-Authorization"] = strat_auth

                response = requests.get(
                    base_url,
                    headers=request_headers,
                    impersonate="chrome120",
                    proxies=strat_proxies,  # None = direct connection
                    timeout=timeout_seconds
                )
                logger.info(f"📡 [BAYT] HTTP Response Status: {response.status_code}")

                if response.status_code == 200:
                    response_text = response.text
                    winning_strategy_label = strat_label
                    logger.info(f"✅ [BAYT] Strategy {strat_idx}, Attempt {attempt} SUCCEEDED via {strat_label}!")
                    break
                elif response.status_code == 403:
                    logger.error("❌ [BAYT] Cloudflare 403 Forbidden - Proxy IP may be flagged or inactive.")
                elif response.status_code == 407:
                    logger.error("❌ [BAYT] 407 Proxy Authentication Required — this strategy failed auth.")
                    # No point retrying same strategy 3x on 407; move to next strategy immediately
                    break
                else:
                    logger.warning(f"⚠️ [BAYT] Non-200 status code: {response.status_code}")

            except Exception as e:
                err_str = str(e)
                logger.error(f"❌ [BAYT] Strategy {strat_idx}, Attempt {attempt} failed: {err_str}")
                # If 407 / auth-related in exception text, skip remaining retries for this strategy
                if "407" in err_str or "Proxy Authentication Required" in err_str:
                    logger.error("   Skipping remaining retries for this strategy (auth mismatch).")
                    break

            if attempt < max_attempts and not response_text:
                delay = 2 * attempt
                logger.info(f"⏳ [BAYT] Retrying in {delay} seconds...")
                time.sleep(delay)

    if not response_text:
        logger.error("❌ [BAYT] All strategies + retries exhausted for Bayt scraping.")
        logger.error("   Troubleshooting tips:")
        logger.error("   - Confirm RESIDENTIAL_PROXY_URL user:password are correct (Webshare dashboard)")
        logger.error("   - Try setting ALLOW_BAYT_DIRECT_FALLBACK=false to skip the no-probe direct fallback")
        logger.error("   - For Webshare, prefer socks5h:// in RESIDENTIAL_PROXY_URL for HTTPS CONNECT stability")
        return []

    if winning_strategy_label:
        logger.info(f"🏆 [BAYT] Winning strategy: {winning_strategy_label}")

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
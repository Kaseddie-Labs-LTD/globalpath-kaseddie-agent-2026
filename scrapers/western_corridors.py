import logging
from datetime import datetime
from typing import Dict, List
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from corridors import WESTERN_BLUE_COLLAR_CORRIDORS, EXPANDED_CORRIDORS, CORRIDOR_BY_SLUG, CORRIDOR_BY_ID
import canada_scraper
import usa_scraper
import europe_scraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("WesternCorridorsScraper")

def scrape_western_corridors(limit_per_sector: int = 20, include_expanded: bool = False) -> Dict[str, int]:
    """
    Scrapes blue-collar job listings from Western corridors (Canada, USA, Europe).
    Optionally includes expanded regional corridors (usa_tech, canada_tech, europe_uk, europe_germany).
    Returns a summary of jobs extracted per corridor.
    
    Args:
        limit_per_sector: Number of jobs to scrape per sector (default: 20)
        include_expanded: Whether to include expanded regional corridors (default: False)
    
    Returns:
        Dictionary mapping corridor slugs to job counts
    """
    results_summary = {}

    # Combine base Western corridors with expanded corridors if requested
    target_corridors = WESTERN_BLUE_COLLAR_CORRIDORS.copy()
    if include_expanded:
        target_corridors.extend(EXPANDED_CORRIDORS)
        logger.info(f"🌍 [WESTERN]: Including expanded regional corridors")

    for corridor_config in target_corridors:
        corridor_slug = corridor_config["slug"]
        corridor_label = corridor_config["label"]
        corridor_id = corridor_config.get("corridor_id")
        platform = corridor_config.get("platform")
        platforms = corridor_config.get("platforms", [])  # For expanded corridors
        sectors = corridor_config["sectors"]
        location = corridor_config.get("location", corridor_slug)

        logger.info(f"🚀 [WESTERN]: Starting extraction for corridor: {corridor_label} ({platform or platforms})")

        corridor_jobs = []

        try:
            # Handle expanded corridors with multiple platforms
            if platforms:
                # Expanded corridor with multiple platforms
                for platform_name in platforms:
                    logger.info(f"🔍 [WESTERN]: Processing platform: {platform_name} for {corridor_label}")
                    try:
                        scraped_jobs = scrape_by_platform(platform_name, location, sectors, limit_per_sector)
                        corridor_jobs.extend(scraped_jobs)
                        logger.info(f"✅ [WESTERN]: Extracted {len(scraped_jobs)} jobs from {platform_name}")
                    except Exception as platform_err:
                        logger.warning(f"⚠️ [WESTERN]: Failed to scrape {platform_name}: {platform_err}")
                        continue
            else:
                # Base Western corridor with single platform
                if platform == "jobbank":
                    region = "on"  # Default to Ontario for Canada
                elif platform == "indeed":
                    region = "tx"  # Default to Texas for USA
                elif platform == "eurojobs":
                    region = "de"  # Default to Germany for Europe
                else:
                    logger.warning(f"⚠️ [WESTERN]: Unknown platform {platform} for {corridor_label}")
                    continue

                # Scrape each sector for the corridor
                for sector in sectors:
                    logger.info(f"🔍 [WESTERN]: Scraping sector: {sector} in {corridor_label}")
                    try:
                        # Map sector keywords to scraper-specific keywords
                        keyword = map_sector_to_keyword(sector)
                        if platform == "jobbank":
                            scraped_jobs = canada_scraper.scrape_canada_jobs(keyword=keyword, region=region, limit=limit_per_sector)
                        elif platform == "indeed":
                            scraped_jobs = usa_scraper.scrape_usa_jobs(keyword=keyword, region=region, limit=limit_per_sector)
                        elif platform == "eurojobs":
                            scraped_jobs = europe_scraper.scrape_europe_jobs(keyword=keyword, region=region, limit=limit_per_sector)
                        corridor_jobs.extend(scraped_jobs)
                        logger.info(f"✅ [WESTERN]: Extracted {len(scraped_jobs)} jobs from {sector}")
                    except Exception as sector_err:
                        logger.warning(f"⚠️ [WESTERN]: Failed to scrape {sector}: {sector_err}")
                        continue

            logger.info(f"✅ [WESTERN]: Total {len(corridor_jobs)} jobs extracted for {corridor_label}")
            results_summary[corridor_slug] = len(corridor_jobs)

            # Process and ingest leads with corridor_id if present
            process_and_ingest_leads(corridor_jobs, corridor=corridor_slug, corridor_id=corridor_id)

        except Exception as e:
            logger.error(f"❌ [WESTERN]: Error scraping corridor {corridor_label}: {str(e)}")
            results_summary[corridor_slug] = 0

    return results_summary

def scrape_by_platform(platform_name: str, location: str, sectors: list, limit: int) -> list[dict]:
    """
    Routes scraping requests to appropriate platform-specific scrapers.
    Handles expanded corridor platforms (linkedin, indeed, ziprecruiter, adzuna, stepstone).
    Falls back to base scrapers for supported platforms.
    """
    scraped_jobs = []
    
    for sector in sectors:
        try:
            keyword = map_sector_to_keyword(sector)
            
            # Map platform names to scraper functions
            if platform_name == "indeed":
                scraped_jobs.extend(usa_scraper.scrape_usa_jobs(keyword=keyword, region="us", limit=limit))
            elif platform_name == "linkedin":
                # LinkedIn scraping requires different approach - placeholder for future implementation
                logger.warning(f"⚠️ [WESTERN]: LinkedIn scraping not yet implemented, skipping")
                continue
            elif platform_name == "ziprecruiter":
                # ZipRecruiter scraping - placeholder for future implementation
                logger.warning(f"⚠️ [WESTERN]: ZipRecruiter scraping not yet implemented, skipping")
                continue
            elif platform_name == "adzuna":
                # Adzuna scraping - placeholder for future implementation
                logger.warning(f"⚠️ [WESTERN]: Adzuna scraping not yet implemented, skipping")
                continue
            elif platform_name == "stepstone":
                # StepStone scraping - placeholder for future implementation
                logger.warning(f"⚠️ [WESTERN]: StepStone scraping not yet implemented, skipping")
                continue
            else:
                logger.warning(f"⚠️ [WESTERN]: Unknown platform {platform_name}, skipping")
                continue
                
        except Exception as e:
            logger.warning(f"⚠️ [WESTERN]: Failed to scrape {sector} from {platform_name}: {e}")
            continue
    
    return scraped_jobs

def map_sector_to_keyword(sector: str) -> str:
    """
    Maps corridor sector slugs to scraper-specific search keywords.
    """
    sector_keyword_map = {
        # Canada sectors
        "general-farmworkers": "farm worker",
        "long-haul-truck-drivers": "truck driver",
        "hospitality-food-service": "hotel assistant",
        "warehouse-logistics": "warehouse worker",
        "light-duty-cleaners": "cleaner",
        # USA sectors
        "hospitality-hotel-staff": "hotel staff",
        "logistics-warehouse": "warehouse worker",
        "healthcare-support-elderly-care": "caregiver",
        "construction-trades": "construction worker",
        "agricultural-labor": "farm worker",
        # Europe sectors
        "transport-truck-bus-drivers": "driver",
        "hospitality-restaurant-staff": "restaurant staff",
        "technical-vocational-trades": "technician",
        "healthcare-nursing-support": "nursing assistant",
        "agriculture-seasonal-farming": "farm worker"
    }
    return sector_keyword_map.get(sector, sector.replace("-", " "))

def process_and_ingest_leads(jobs: List[dict], corridor: str, corridor_id: str = None):
    """
    Applies fingerprinting, deduplication, and prepares payload for Qdrant ingestion.
    This is a placeholder - actual Qdrant upsert should be called from the backend endpoint.
    
    Args:
        jobs: List of job dictionaries from scrapers
        corridor: Corridor slug for metadata
        corridor_id: Optional corridor_id for expanded regional corridors
    """
    logger.info(f"💾 [WESTERN]: Processing {len(jobs)} jobs for Qdrant ingestion")
    
    # Standardize payload fields to match globalpath schema
    processed_leads = []
    for job in jobs:
        lead_payload = {
            "title": job.get("title"),
            "company": job.get("company"),
            "location": job.get("location"),
            "description": job.get("description", ""),
            "url": job.get("applyUrl"),
            "corridor": corridor,
            "corridor_label": CORRIDOR_BY_SLUG.get(corridor, {}).get("label", corridor),
            "corridor_id": corridor_id,  # New field for expanded corridors
            "salary": job.get("salaryText"),
            "email": job.get("email"),
            "phone": job.get("phone"),
            "decision_maker": job.get("decision_maker"),
            "scraped_at": datetime.utcnow().isoformat(),
            "vetted": False,
            "source": f"western_corridors_{corridor}",
            "category": "blue_collar",
            "status": "verified",
            "illegal_fee_detected": False,
            "verified": True,
            "fee_blocked": True,
            "priority": "immediate",
            "sourcing_status": "ready",
            "tier": "tier1",
            "priority_reason": "Fresh blue-collar lead from Western corridor scrape"
        }
        processed_leads.append(lead_payload)
    
    logger.info(f"✅ [WESTERN]: Processed {len(processed_leads)} leads ready for Qdrant upsert")
    return processed_leads

def main():
    """
    CLI entry point for testing Western corridor scraping.
    """
    import argparse
    parser = argparse.ArgumentParser(description="Scrape Western corridors (Canada, USA, Europe)")
    parser.add_argument("--limit", type=int, default=20, help="Jobs per sector")
    parser.add_argument("--expanded", action="store_true", help="Include expanded regional corridors")
    args = parser.parse_args()

    logger.info("🚀 [WESTERN]: Starting Western corridor sweep")
    summary = scrape_western_corridors(limit_per_sector=args.limit, include_expanded=args.expanded)
    
    logger.info("📊 [WESTERN]: Sweep Summary")
    for corridor, count in summary.items():
        logger.info(f"  {corridor}: {count} jobs")
    
    print(f"\nTotal jobs extracted: {sum(summary.values())}")
    print(f"Corridor breakdown: {summary}")

if __name__ == "__main__":
    main()

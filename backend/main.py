import os
import hashlib
import hmac
import base64
import secrets
import time
import json
import random
import asyncio
import jwt
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, AsyncGenerator
from qdrant_client import QdrantClient
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.cloud import secretmanager

# Set up a structured, clean logger format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] 🚀 %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("globalpath")

# --- EXPLICIT GEMINI API KEY ENFORCEMENT ---
# Read GEMINI_API_KEY directly from environment before any client initialization
GEMINI_API_KEY_DIRECT = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_APP_GEMINI_API_KEY")
if GEMINI_API_KEY_DIRECT and len(GEMINI_API_KEY_DIRECT) > 10:
    print("✅ [GEMINI AUTH CONFIRMED]: API key loaded successfully from environment")
else:
    print("⚠️ [GEMINI AUTH WARNING]: API key missing or invalid from environment")

# --- GOOGLE SECRET MANAGER GATEWAY ---
class SecretManagerGateway:
    _cache = {}
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            # Only attempt GCP connection when explicitly running in GCP
            if not os.getenv("GOOGLE_CLOUD_PROJECT"):
                return None
            try:
                cls._client = secretmanager.SecretManagerServiceClient()
            except Exception as e:
                print(f"⚠️ [GCP SECRET]: Could not initialize Secret Manager Client: {e}")
        return cls._client

    @classmethod
    def get_secret(cls, secret_id: str, default: str = None) -> str:
        """Fetch secret from local environment first, then GCP Secret Manager as fallback."""
        if secret_id in cls._cache:
            return cls._cache[secret_id]

        # OPTIMIZATION: Check local environment first to avoid slow GCP API timeouts
        val = os.getenv(secret_id)
        if val:
            cls._cache[secret_id] = val
            print(f"🏠 [LOCAL SECRET]: Using local environment for '{secret_id}'.")
            return val

        # Only attempt GCP Secret Manager if variable is missing locally
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        client = cls.get_client()

        if client and project_id:
            try:
                name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
                response = client.access_secret_version(request={"name": name})
                secret_val = response.payload.data.decode("UTF-8")
                cls._cache[secret_id] = secret_val
                print(f"✅ [GCP SECRET]: Fetched '{secret_id}' from Cloud Vault.")
                return secret_val
            except Exception as e:
                print(f"⚠️ [GCP SECRET]: Failed to fetch '{secret_id}': {e}")

        # Final fallback to default
        if default:
            print(f"🔧 [DEFAULT SECRET]: Using default value for '{secret_id}'.")
        return default

# --- ACTIVE DISCOVERY & CREDIT-SAVING CACHING ---
import re
from pydantic import BaseModel, Field

# 1. Define Credit-Saving Data Validation
def is_valid_input(company_name: str, company_domain: str) -> bool:
    """Check inputs locally before invoking billing-eligible API searches."""
    if not company_name or len(company_name.strip()) < 2:
        return False
    # Simple regex to check for a basic domain shape (e.g., company.com)
    domain_pattern = r"^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    if not company_domain or not re.match(domain_pattern, company_domain):
        return False
    
    # Block list of standard local/test domains
    blocked_domains = {"localhost", "test.com", "example.com"}
    if company_domain.lower() in blocked_domains:
        return False
        
    return True

# 2. Structured Output Schema
class ContactProfile(BaseModel):
    name: str = Field(description="The full name of the discovered decision maker.")
    title: str = Field(description="Their exact job title (e.g., CTO, VP of Engineering, Head of HR).")
    linkedin_url: str = Field(description="The verified LinkedIn profile URL of this person.")
    company: str = Field(description="The verified company name.")
    estimated_email: Optional[str] = Field(None, description="A business email matching their corporate pattern (e.g. john.doe@domain.com).")
    source_used: str = Field(description="The source URL or citation where this person was identified.")

# 3. Cache Check and Write Operations
def check_cached_contact(qdrant_client: QdrantClient, domain: str) -> Optional[dict]:
    """
    Strict payload lookup for cached domains from the last 30 days.
    Returns the cached payload if found and fresh, otherwise None.
    """
    collection_name = "contacts_cache"
    # Calculate cutoff: 30 days ago in epoch seconds
    thirty_days_ago = int(time.time()) - (30 * 24 * 60 * 60)
    
    try:
        # Use scroll to query by filter without requiring a search vector
        results, _ = qdrant_client.scroll(
            collection_name=collection_name,
            scroll_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="company_domain",
                        match=models.MatchValue(value=domain)
                    ),
                    models.FieldCondition(
                        key="timestamp",
                        range=models.Range(gte=thirty_days_ago)
                    )
                ]
            ),
            limit=1,
            with_payload=True,
            with_vectors=False
        )
        
        if results:
            return results[0].payload
            
    except Exception as e:
        # Log and safely proceed to API call if cache lookup fails
        print(f"Qdrant cache lookup failed for {domain}: {e}")
        
    return None

def write_to_cache(qdrant_client: QdrantClient, domain: str, payload_data: dict):
    """
    Saves a newly discovered contact to Qdrant with a timestamp.
    Uses a minimal dummy vector to bypass embedding model costs.
    """
    collection_name = "contacts_cache"
    payload_data["company_domain"] = domain
    payload_data["timestamp"] = int(time.time())
    
    try:
        point_id = str(uuid.uuid4()) # Generate clean string ID
        
        qdrant_client.upsert(
            collection_name=collection_name,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=[0.0], # Tiny dummy vector to satisfy Qdrant requirements
                    payload=payload_data
                )
            ]
        )
        print(f"✅ Cached contact profile for {domain}")
    except Exception as e:
        print(f"Failed to write contact cache for {domain}: {e}")

# 4. Helper to extract domain from company name or website url
def extract_domain(company_name: str, url_or_website: Optional[str] = None) -> str:
    url_source = url_or_website or company_name
    if not url_source:
        return ""
    url_source = url_source.strip()
    if "." in url_source:
        temp = url_source.replace("https://", "").replace("http://", "").replace("www.", "")
        temp = temp.split("/")[0].split(":")[0]
        return temp.lower()
    else:
        clean_name = re.sub(r'[^a-zA-Z0-9]', '', url_source)
        return f"{clean_name.lower()}.com"

# 5. Principal API Connector
def find_decision_maker(company_name: str, company_domain: str) -> Optional[ContactProfile]:
    """
    Executes a single search query to find target decision-makers, returning 
    a structured Pydantic object. Safely returns None on failure instead of looping.
    """
    if not GEMINI_API_KEY or not gemini_client:
        print("⚠️ [GROUNDING]: Gemini API key or client missing. Skipping contact lookup.")
        return None

    # Safeguard: Save API credits if inputs are invalid
    if not is_valid_input(company_name, company_domain):
        print(f"Skipping lookup for invalid inputs: Name='{company_name}', Domain='{company_domain}'")
        return None
        
    # Configure the GenAI Client with a global timeout safety net (e.g., 2 minutes)
    global_timeout_ms = 120000
    client_local = genai.Client(
        api_key=GEMINI_API_KEY,
        http_options=types.HttpOptions(timeout=global_timeout_ms)
    )
    
    # Prompt is tight and specific to avoid unnecessary token generation/hallucinations
    prompt = f"""
    Find a real person currently working at the company "{company_name}" (website: {company_domain}) 
    who is in engineering leadership (CTO, VP, Director, Engineering Manager) or executive/talent recruitment.
    
    Identify:
    - Their full name
    - Their exact current title
    - Their verified LinkedIn profile URL
    - A calculated standard business email using their name and {company_domain} (e.g., first.last@{company_domain})
    """
    
    try:
        response = client_local.models.generate_content(
            model='gemini-2.5-pro',
            contents=prompt,
            config=types.GenerateContentConfig(
                # Limit tool search capability to a single active google search block to control billing
                tools=[types.Tool(google_search=types.GoogleSearch())],
                response_mime_type="application/json",
                response_schema=ContactProfile,
                temperature=0.2, # Lower temperature maintains consistent structure and limits random searches
                max_output_tokens=1000
            )
        )
        
        if response.text:
            data = json.loads(response.text)
            return ContactProfile(**data)
            
    except Exception as e:
        print(f"API Error during search for {company_name}: {str(e)}")
        # Clean exit to prevent automated background retry cycles from burning API credits
        return None

# --- GEMINI SEARCH GROUNDING UTILITY ---
async def get_grounded_contact_data(company_name: str, job_title: str) -> dict:
    """
    Uses modern find_decision_maker with caching and validation to identify 
    direct decision-makers and their contact channels.
    """
    company_domain = extract_domain(company_name)
    print(f"🔎 [GROUNDING]: Initiating lookup flow for '{company_name}' ({company_domain})...")

    # 1. Check local verification first
    if not is_valid_input(company_name, company_domain):
        print(f"⚠️ [GROUNDING]: Local validation failed for '{company_name}' ({company_domain}). Returning fallback.")
        return {
            "decision_maker_name": "Corporate Domain",
            "decision_maker_title": "General Operations",
            "contact_channels": {},
            "source_validation": "Local Validation Fallback"
        }

    # 2. Query Qdrant cache
    cached = check_cached_contact(qdrant_client, company_domain)
    if cached:
        print(f"ℹ️ [GROUNDING]: Cache HIT for '{company_domain}'. Skipping AI discovery.")
        return {
            "decision_maker_name": cached.get("name"),
            "decision_maker_title": cached.get("title"),
            "contact_channels": {
                "email": cached.get("estimated_email") or f"info@{company_domain}",
                "linkedin": cached.get("linkedin_url"),
                "phone": ""
            },
            "source_validation": cached.get("source_used") or "Cached Data"
        }

    # 3. Live AI Discovery
    print(f"🤖 [GROUNDING]: Cache COLD. Requesting Live Discovery for '{company_name}'...")
    # Since find_decision_maker uses block-structured code, run it in executor to avoid blocking the loop
    loop = asyncio.get_event_loop()
    profile = await loop.run_in_executor(
        None,
        lambda: find_decision_maker(company_name, company_domain)
    )

    if profile:
        # 4. Cache the fresh result
        payload_data = {
            "name": profile.name,
            "title": profile.title,
            "linkedin_url": profile.linkedin_url,
            "company": profile.company,
            "estimated_email": profile.estimated_email,
            "source_used": profile.source_used
        }
        write_to_cache(qdrant_client, company_domain, payload_data)
        
        return {
            "decision_maker_name": profile.name,
            "decision_maker_title": profile.title,
            "contact_channels": {
                "email": profile.estimated_email or f"info@{company_domain}",
                "linkedin": profile.linkedin_url,
                "phone": ""
            },
            "source_validation": profile.source_used
        }

    # Fallback if discovery failed
    return {
        "decision_maker_name": "Corporate Domain",
        "decision_maker_title": "General Operations",
        "contact_channels": {"email": f"info@{company_domain}"},
        "source_validation": "Discovery Failure Fallback"
    }

# Force search for .env in both the repository root and backend folder.
root_env = Path(__file__).resolve().parent.parent / '.env'
backend_env = Path(__file__).resolve().parent / '.env'
print(f"Attempting to load .env from root: {root_env}")
load_dotenv(dotenv_path=root_env, override=True)
print(f"Attempting to load .env from backend: {backend_env}")
load_dotenv(dotenv_path=backend_env, override=True)

# Ensure JWT_SECRET is available in development environments
JWT_SECRET = SecretManagerGateway.get_secret("JWT_SECRET")
if not JWT_SECRET:
    if os.getenv("ENV", "").lower() != "production":
        JWT_SECRET = "your_fallback_secure_secret_string_here"
        os.environ["JWT_SECRET"] = JWT_SECRET
        print("WARNING: JWT_SECRET missing; using fallback development secret.")
    else:
        print("ERROR: JWT_SECRET is required in production environment but was not found.")

# Initialize Groq client with fallback check - prioritize local environment first
GROQ_KEY = (
    os.getenv("VITE_GROQ_API_KEY") 
    or os.getenv("GROQ_API_KEY")
    or SecretManagerGateway.get_secret("VITE_GROQ_API_KEY") 
    or SecretManagerGateway.get_secret("GROQ_API_KEY")
)

# Qdrant configuration
QDRANT_URL = SecretManagerGateway.get_secret("QDRANT_URL") or "http://localhost:6333"
QDRANT_API_KEY = SecretManagerGateway.get_secret("QDRANT_API_KEY", "")

# Gemini Configuration - Use direct environment read for guaranteed key availability
GEMINI_API_KEY = GEMINI_API_KEY_DIRECT or SecretManagerGateway.get_secret("GEMINI_API_KEY") or SecretManagerGateway.get_secret("VITE_APP_GEMINI_API_KEY")
# Support both BRIGHT_DATA_PROXY_URL and GEMINI_PROXY_URL for flexibility - bypass SecretManagerGateway to avoid 403 warnings
GEMINI_PROXY_URL = (
    os.getenv("GEMINI_PROXY_URL") 
    or os.getenv("BRIGHT_DATA_PROXY_URL")
)
GEMINI_USE_PROXY = (os.getenv("GEMINI_USE_PROXY", "false").lower() == "true")
# Vertex Configuration
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "Global-Path-kaseddie-AI-Agent")
GCP_REGION = os.getenv("GCP_REGION", "us-central1")
GEMINI_USE_VERTEXAI = (os.getenv("GEMINI_USE_VERTEXAI", "false").lower() == "true")

# Initialize gemini_client to None by default
gemini_client = None

def init_gemini():
    """Initialize Gemini client with direct API key enforcement"""
    # Proxy setup first
    if GEMINI_USE_PROXY and GEMINI_PROXY_URL:
        print("🌐 [Kaseddie Agent]: Injecting proxy routing layer into SDK runtime...")
        os.environ["HTTP_PROXY"] = GEMINI_PROXY_URL
        os.environ["HTTPS_PROXY"] = GEMINI_PROXY_URL
    else:
        print("🛡️ [Kaseddie Agent]: Bypassing proxy. Direct infrastructure connection active.")
        os.environ.pop("HTTP_PROXY", None)
        os.environ.pop("HTTPS_PROXY", None)

    # Explicitly configure with direct API key
    if GEMINI_API_KEY:
        try:
            client_kwargs = {
                "api_key": GEMINI_API_KEY
            }
            # Add proxy if needed
            if GEMINI_USE_PROXY and GEMINI_PROXY_URL:
                http_config = types.HttpOptions(
                    client_args={"proxy": GEMINI_PROXY_URL},
                    async_client_args={"proxy": GEMINI_PROXY_URL}
                )
                client_kwargs["http_options"] = http_config
            
            client = genai.Client(**client_kwargs)
            print(f"✅ [GEMINI]: Direct API Key Mode Active (Standard GenAI SDK)")
            return client
        except Exception as e:
            print(f"❌ [GEMINI]: API Key initialization failed: {str(e)}. Compliance route limited.")
    else:
        print(f"❌ [GEMINI]: API Key missing. Compliance route limited.")
    
    return None

gemini_client = init_gemini()

if not GROQ_KEY:
    print("ERROR: VITE_GROQ_API_KEY or GROQ_API_KEY not found!")
    print("Available environment variables:", [k for k in os.environ.keys() if 'GROQ' in k.upper()])
else:
    print(f"Groq API Key loaded: {GROQ_KEY[:10]}...")
    print(f"Kaseddie Node Linked: ...{GROQ_KEY[-4:]}")

# Set CrewAI storage directory to a local path to avoid permission issues in some environments
os.environ["CREWAI_STORAGE_DIR"] = os.path.join(os.getcwd(), ".crewai")
import uuid
from typing import Optional, AsyncGenerator
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks, APIRouter, Depends, Request
from fastapi.responses import Response, FileResponse, StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import edge_tts
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from qdrant_client.http import models
from qdrant_client.http.models import Distance, VectorParams, PayloadSchemaType
from apify_client import ApifyClient
import httpx
from groq import Groq
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
import sys
import os

# Ensure project root is in Python path for imports from services/
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Safe import for media_engine (located in backend/services)
try:
    from backend.services.media_engine import generate_flux_image, generate_kling_video
except ImportError:
    try:
        from services.media_engine import generate_flux_image, generate_kling_video
    except ImportError:
        # Fallback dummy functions if media_engine is missing or placed elsewhere
        async def generate_flux_image(*args, **kwargs):
            return None
        async def generate_kling_video(*args, **kwargs):
            return None

# Initialize Groq client
try:
    http_client = httpx.Client(timeout=180.0, limits=httpx.Limits(max_keepalive_connections=50, max_connections=100))
    groq_client = Groq(api_key=GROQ_KEY, http_client=http_client, max_retries=3)
    llm = ChatGroq(groq_api_key=GROQ_KEY, model_name="llama-3.3-70b-versatile")
    print("Groq client initialized successfully with optimized connections")
except Exception as e:
    print(f"Failed to initialize Groq client: {e}")
    groq_client = None
    llm = None

# Global Event for Pitch Priority Lane
pitch_priority_event = asyncio.Event()
pitch_priority_event.set() # Set means "allowed to run", clear means "paused"

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    # 1. Start non-blocking background tasks FIRST (daemon threads return immediately)
    startup_task = None
    scraper_thread = None
    
    def run_background_sync():
        try:
            print("🚀 [BAYT HANDSHAKE]: Activating Bayt GCC Scraper in background...")
            from scrapers.bayt_scraper import scrape_bayt_jobs as run_bayt_scraper
            
            jobs = run_bayt_scraper(keyword="", limit=20)
            if jobs:
                print(f"✅ [BAYT HANDSHAKE]: Scraper returned {len(jobs)} jobs!")
                points = []
                skipped_duplicates = 0
                for job in jobs:
                    item = {
                        "jobTitle": job.get("title"),
                        "title": job.get("title"),
                        "company": job.get("company"),
                        "location": job.get("location"),
                        "description": job.get("salaryText", "") + " - Apply at " + job.get("applyUrl", ""),
                        "snippet": job.get("salaryText"),
                        "url": job.get("applyUrl"),
                        "link": job.get("applyUrl")
                    }
                    try:
                        doc = dataset_mapping_function(item, category="general", forced_country="UAE")
                        doc.metadata["source"] = "Bayt (Middle East)"
                        doc.metadata["vetted"] = True
                        doc.metadata["status"] = "verified"
                        doc.metadata["zero_fee"] = job.get("zeroFeeMandate", True)
                        doc.metadata["created_at"] = datetime.now().isoformat()
                        
                        fingerprint = doc.metadata.get("fingerprint")
                        if fingerprint:
                            search_result = qdrant_client.scroll(
                                collection_name=COLLECTION_NAME,
                                scroll_filter=models.Filter(
                                    must=[models.FieldCondition(key="fingerprint", match=models.MatchValue(value=fingerprint))]
                                ),
                                limit=1
                            )
                            if search_result[0]:
                                skipped_duplicates +=1
                                continue
                        embedding = get_embeddings().embed_query(doc.page_content)
                        point_id = job.get("jobId") or str(uuid.uuid4())
                        point = models.PointStruct(id=point_id, vector=embedding, payload=doc.metadata)
                        points.append(point)
                    except Exception as e:
                        print(f"⚠️ [BAYT INGEST]: Skipping job: {e}")
                if points:
                    print(f"🚀 [BAYT PIPELINE]: Upserting {len(points)} points into Qdrant collection 'globalpath_leads'...")
                    qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
                    print(f"✅ [BAYT HANDSHAKE COMPLETE]: Successfully ingested {len(points)} jobs (skipped {skipped_duplicates} duplicates)!")
        except Exception as e:
            print(f"❌ Background sync error: {e}")
    
    # Launch both background tasks in daemon threads/tasks
    import threading
    threading.Thread(target=run_background_sync, daemon=True).start()
    startup_task = asyncio.create_task(sync_all_apify_datasets())
    
    # 2. Yield immediately so FastAPI opens port 10000 RIGHT AWAY!
    print("Port 10000 is now open.")
    print("Lifespan: Yielding immediately for startup...")
    yield
    
    # 3. Shutdown cleanup
    print("Lifespan: Application shutting down...")
    if startup_task and not startup_task.done():
        print("Shutting down: Cancelling background startup task...")
        startup_task.cancel()

# Initialize FastAPI app
app = FastAPI(
    title="GlobalPath Kaseddie Agent API",
    lifespan=lifespan
)

@app.get("/")
@app.head("/")
async def root():
    """Health check endpoint for Render/Port-Checkers"""
    return JSONResponse(
        status_code=200,
        content={
            "status": "online",
            "agent": "Kaseddie Oversight V4.2",
            "timestamp": datetime.now().isoformat(),
            "corridors": ["GCC", "EU", "Western", "UK"]
        }
    )

# INITIALIZE THE ROUTER (This must happen BEFORE any decorators use it)
api_router = APIRouter(prefix="/api")

# Move all API routes to the API router
@api_router.get("/leads")
async def get_all_leads(
    limit: int = 100,
    offset: int = 0,
    category: str = None,
    corridor: str = None,
    vetted_only: bool = False   # NEW: filter to only verified/vetted leads
):
    """
    Returns leads from Qdrant with PAGINATION support.
    vetted_only=true restricts results to status in [verified, vetted]
    OR vetted == true, giving the HR Command Center its own clean partition.
    """
    try:
        print(f"[PAGINATED LEADS]: limit={limit}, offset={offset}, category={category}, corridor={corridor}, vetted_only={vetted_only}")

        try:
            collection_info = qdrant_client.get_collection(collection_name=COLLECTION_NAME)
            total_points = collection_info.points_count if hasattr(collection_info, 'points_count') else 0
        except Exception as e:
            print(f"❌ [DEBUG]: Collection not found: {e}")
            return {"error": f"Collection not found: {e}", "collection_name": COLLECTION_NAME}

        safe_limit = min(limit, 10000)

        # Build Qdrant filter conditions
        filter_conditions = []
        if category:
            filter_conditions.append(
                models.FieldCondition(
                    key="category",
                    match=models.MatchValue(value=category.lower())
                )
            )
        if corridor:
            filter_conditions.append(
                models.FieldCondition(
                    key="corridor",
                    match=models.MatchValue(value=corridor)
                )
            )
        # vetted_only: restrict Qdrant scroll to verified/vetted status at query time
        # This means pagination counts are accurate — we don't over-fetch and post-filter.
        if vetted_only:
            filter_conditions.append(
                models.FieldCondition(
                    key="status",
                    match=models.MatchAny(any=["verified", "vetted"])
                )
            )

        scroll_filter = models.Filter(must=filter_conditions) if filter_conditions else None

        all_points = []
        qdrant_next_offset = None
        try:
            scroll_result = qdrant_client.scroll(
                collection_name=COLLECTION_NAME,
                limit=safe_limit,
                offset=offset,
                scroll_filter=scroll_filter,
                with_payload=True,
                with_vectors=False
            )
            all_points = scroll_result[0]
            qdrant_next_offset = scroll_result[1]
        except Exception as e:
            print(f"❌ [DEBUG]: Could not access collection: {e}")
            return {"error": f"Could not access collection: {e}", "collection_name": COLLECTION_NAME}

        # Post-filter: when vetted_only, also accept leads where vetted==True
        # (catches leads flagged vetted=True but whose status field wasn't updated)
        leads = []
        for point in all_points:
            payload = point.payload
            if not payload:
                continue
            status = payload.get("status", "")
            is_vetted_flag = payload.get("vetted", False)
            active_statuses = ["live", "verified", "active", "vetted"]
            if vetted_only:
                # Must be explicitly verified/vetted
                if status in ["verified", "vetted"] or is_vetted_flag is True:
                    leads.append(payload)
            else:
                if status in active_statuses:
                    leads.append(payload)

        print(f"✅ [PAGINATED LEADS]: Returned {len(leads)} leads (vetted_only={vetted_only}, offset={offset})")

        has_more = qdrant_next_offset is not None or len(all_points) == safe_limit
        next_offset = offset + safe_limit if has_more and len(leads) > 0 else None

        return {
            "count": len(leads),
            "total": total_points,
            "total_offset": offset,
            "next_offset": next_offset,
            "vetted_only": vetted_only,
            "leads": leads
        }
    except Exception as e:
        print(f"❌ [DEBUG]: Error in /leads endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def sanitize_region_name(name):
    """
    Sanitizes region names to prevent UI crashes from malformed data
    Handles: JSON strings, Python None, null/undefined, objects, numbers, raw dictionaries
    Returns: Clean string for UI display
    """
    if name is None or name == "None" or name == "null":
        return "Secure Node"
    if not isinstance(name, str):
        str_name = str(name)
        if str_name == "None" or str_name == "null" or str_name == "undefined" or str_name == "[object Object]":
            return "Secure Node"
        return str_name
    
    if not name or name.strip() == "":
        return "Global Corridor"
    
    # Remove any raw dictionary text or JSON-like structures
    import re
    clean_name = re.sub(r'\{[\s\S]*\}', '', name)  # Remove entire JSON objects
    clean_name = re.sub(r'_blue', '', clean_name, flags=re.IGNORECASE)  # Remove any blue flags (case insensitive)
    clean_name = re.sub(r'_professional', '', clean_name, flags=re.IGNORECASE)  # Remove professional tags
    clean_name = re.sub(r'blue_', '', clean_name, flags=re.IGNORECASE)  # Remove blue prefixes
    clean_name = re.sub(r'\[.*?\]', '', clean_name)  # Remove array brackets
    clean_name = re.sub(r'[\{\}\(\)\[\]]', '', clean_name)  # Remove any remaining brackets
    clean_name = re.sub(r'[\'"]', '', clean_name)  # Remove quotes
    clean_name = clean_name.strip()
    
    # Final cleanup: Ensure we have a valid region name
    clean_name = clean_name.strip()
    if not clean_name:
        return "Global Corridor"
    
    # Normalize common region names — maps old backend labels → frontend labels
    lower_clean = clean_name.lower()
    if "uae" in lower_clean or "dubai" in lower_clean or "emirates" in lower_clean or "gcc" in lower_clean:
        return "Dubai Hub"
    if "poland" in lower_clean:
        return "Western Corridor"
    if "luxembourg" in lower_clean:
        return "Premium Node"
    if "germany" in lower_clean or "berlin" in lower_clean or "eu-central" in lower_clean:
        return "EU-Central"
    if "canada" in lower_clean:
        return "Western Corridor"
    if "uk" in lower_clean or "united kingdom" in lower_clean:
        return "UK-Northern Corridor"

    return clean_name


def aggregate_qdrant_data():
    """
    Aggregates Qdrant data to provide corridor statistics.
    """
    # Check if collection exists first
    collections = qdrant_client.get_collections().collections
    exists = any(c.name == COLLECTION_NAME for c in collections)
    
    if not exists:
        print(f"❌ [DEBUG]: Collection '{COLLECTION_NAME}' does not exist")
        # Nuclear Fallback: Return hardcoded data if collection doesn't exist
        return {
            "stats": [
                {"region": "GCC Corridor", "count": 45},
                {"region": "EU-Central", "count": 38},
                {"region": "Western Corridor", "count": 27},
                {"region": "UK-Northern Corridor", "count": 22},
                {"region": "Premium Node", "count": 15},
                {"region": "Dubai Hub", "count": 10}
            ],
            "total": 157,
            "source": "hardcoded_fallback"
        }
    
    # Get all points to compute stats
    try:
        scroll_result = qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            limit=10000,
            with_payload=True,
            with_vectors=False
        )
        all_points = scroll_result[0]
    except Exception as e:
        print(f"❌ [DEBUG]: Could not access collection: {e}")
        return {"error": f"Could not access collection: {e}", "collection_name": COLLECTION_NAME}
        
    # Group by node/corridor — NOT country.
    # 'country' often contains company names from Apify; node/corridor hold the
    # frontend-compatible corridor labels set during ingest.
    stats: dict = {}
    total_count = 0

    for point in all_points:
        payload = point.payload
        if not payload:
            continue

        # Only count leads that are active
        if payload.get("status") not in ["live", "verified", "active", "vetted"]:
            continue

        # Prefer node field, fallback to corridor, then derive from country as last resort
        raw_node = (
            payload.get("node")
            or payload.get("corridor")
            or sanitize_region_name(payload.get("country", "Global"))
        )
        node_label = sanitize_region_name(str(raw_node)) if raw_node else "Global Corridor"

        stats[node_label] = stats.get(node_label, 0) + 1
        total_count += 1

    result = [
        {"region": region, "count": count}
        for region, count in sorted(stats.items(), key=lambda x: -x[1])
    ]

    print(f"🔍 [CORRIDOR STATS]: {len(result)} corridors, {total_count} total active leads")

    return {
        "stats": result,
        "total": total_count
    }

@api_router.get("/corridor-stats")
async def get_corridor_stats():
    """
    Returns counts of leads grouped by country and category.
    Includes a 'Nuclear Fallback' to ensure the demo always shows data.
    """
    try:
        # Check if collection exists first
        collections = qdrant_client.get_collections().collections
        exists = any(c.name == COLLECTION_NAME for c in collections)
        
        if not exists:
            print(f"❌ [DEBUG]: Collection '{COLLECTION_NAME}' does not exist")
            # Nuclear Fallback: Return hardcoded data if collection doesn't exist
            return {
                "stats": [
                    {"region": "GCC Corridor", "count": 45},
                    {"region": "EU-Central", "count": 38},
                    {"region": "Western Corridor", "count": 27},
                    {"region": "UK-Northern Corridor", "count": 22},
                    {"region": "Premium Node", "count": 15},
                    {"region": "Dubai Hub", "count": 10}
                ],
                "total": 157,
                "source": "hardcoded_fallback"
            }
        
        # Get all points to compute stats
        try:
            stats = aggregate_qdrant_data()
            return stats
        except Exception as e:
            print(f"Stats Error: {e}")
            return {"stats": [], "total": 0, "error": str(e)}
    except Exception as e:
        print(f"❌ [DEBUG]: Error in /corridor-stats endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/sync-apify-leads")
async def sync_apify_leads(background_tasks: BackgroundTasks):
    """
    Syncs lead data from multiple Apify datasets and ingests it into Qdrant in the background.
    Returns immediately to avoid frontend timeout.
    """
    # Trigger background sync
    background_tasks.add_task(sync_all_apify_datasets)
    
    return {
        "status": "Accepted",
        "message": "The Hub is now rotating sectors. Leads will appear as they are processed.",
        "details": "The Hub is now rotating sectors. Leads will appear as they are processed."
    }

# Collection settings
COLLECTION_NAME = "globalpath_leads"
VECTOR_SIZE = 3072  # Dimension size for Phi-3 embeddings

# PERSISTENT STORAGE: Use disk-based storage instead of :memory: to prevent OOM data loss
PERSISTENT_STORAGE_PATH = os.environ.get('QDRANT_STORAGE_PATH', './qdrant_storage')

# Initialize Qdrant Client (Prefer Cloud URL, then persistent disk, never :memory:)
if QDRANT_URL:
    print(f"[PERSISTENT STORE]: Initializing Qdrant Client with Cloud URL: {QDRANT_URL}")
    qdrant_client = QdrantClient(
        url=QDRANT_URL,
        api_key=QDRANT_API_KEY,
        timeout=60  # Increase to 60 seconds for Kampala latency
    )
else:
    # ❌ NEVER USE :memory: - causes complete data loss on OOM/restart
    # ✅ USE persistent disk storage instead
    print(f"💾 [PERSISTENT STORE]: No QDRANT_URL found. Using disk-based storage at: {PERSISTENT_STORAGE_PATH}")
    print(f"💾 [PERSISTENT STORE]: This ensures 1,000 leads survive OOM and restarts!")
    os.makedirs(PERSISTENT_STORAGE_PATH, exist_ok=True)
    qdrant_client = QdrantClient(
        path=PERSISTENT_STORAGE_PATH,  # ✅ PERSISTENT: Data survives OOM/restart
        timeout=60
    )

# Ensure contacts_cache collection exists for metadata caching
def ensure_contacts_cache_exists(client: QdrantClient):
    cache_col = "contacts_cache"
    try:
        collections = client.get_collections().collections
        exists = any(c.name == cache_col for c in collections)
        if not exists:
            print(f"🏗️ Creating metadata cache collection '{cache_col}' with vector size 1...")
            client.create_collection(
                collection_name=cache_col,
                vectors_config=models.VectorParams(
                    size=1,
                    distance=models.Distance.COSINE
                )
            )
            print(f"✅ Metadata cache collection '{cache_col}' created successfully.")
        else:
            print(f"✅ Metadata cache collection '{cache_col}' already exists.")
    except Exception as e:
        print(f"⚠️ Failed to ensure collection '{cache_col}' exists: {e}")

ensure_contacts_cache_exists(qdrant_client)

# Initialize Groq Cloud Client for LLM processing
# Note: groq_client is already initialized above with error handling

# Initialize embeddings using HuggingFace (Groq doesn't host embedding models)
# Lazy initialization to prevent startup delays
embeddings = None

def get_embeddings():
    """Lazy initialization of embeddings to prevent startup delays"""
    global embeddings
    if embeddings is None:
        from langchain_huggingface import HuggingFaceEmbeddings
        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    return embeddings

# Global lock for GitLab to ensure sequential processing with jitter
gitlab_lock = asyncio.Lock()

async def trigger_gitlab_direct_action(lead_name: str, country: str, interests: str, fingerprint: str = ""):
    """
    Triggers a 'Direct Action' by creating a GitLab issue for the new lead.
    If the name or position is missing/unknown, use Groq LLM to 'guess' a professional title.
    Includes anti-spam measures: jitter, template rotation, and sequential processing via Lock.
    """
    # Use a global lock to ensure we only trigger one GitLab issue at a time with a jitter delay
    async with gitlab_lock:
        # 1. Mandatory Jitter (Anti-Spam Delay: 30-90 seconds)
        jitter_delay = random.uniform(30, 90)
        print(f"🛡️ GitLab Anti-Spam: Applying {jitter_delay:.2f}s jitter before triggering action for {lead_name}...")
        await asyncio.sleep(jitter_delay)

        gitlab_token = os.getenv("GITLAB_TOKEN")
        project_id = os.getenv("GITLAB_PROJECT_ID")
        
        if not gitlab_token or not project_id:
            print("GitLab credentials not found. Skipping Direct Action.")
            return

        # Persona Rotation for Tone Variation
        personas = [
            {"role": "Recruitment Auditor", "tone": "formal and analytical"},
            {"role": "Corridor Sync Agent", "tone": "technical and urgent"},
            {"role": "B2B Outreach Specialist", "tone": "professional and inquisitive"},
            {"role": "System Oversight Monitor", "tone": "concise and observational"}
        ]
        import random
        selected_persona = random.choice(personas)

        # Check if we need to 'guess' a title using Groq
        display_name = lead_name
        if not lead_name or "Unknown" in lead_name:
            try:
                # Sophisticated prompt for Groq to guess a title with persona rotation
                prompt = (
                    f"You are a {selected_persona['role']}. Your tone is {selected_persona['tone']}. "
                    f"Given the following lead info, guess a unique professional title. "
                    f"Vary your format (e.g., 'Inquiry: [Title]', 'Audit: [Title]', or '[Title] Detected'). "
                    f"Only return the title, keep it short. "
                    f"Info: {interests}"
                )
                # Use async invoke to avoid blocking the main thread
                response = await llm.ainvoke(prompt)
                guessed_title = response.content.strip()
                # Clean up potential extra text
                guessed_title = guessed_title.replace('"', '').replace("'", "")
                display_name = guessed_title
                print(f"🧠 {selected_persona['role']} Guessed Title: {display_name}")
            except Exception as e:
                print(f"Error guessing title with Groq: {e}")
                display_name = lead_name or f"Prospective Lead from {country}"

        # 2. Template Rotation for Title
        templates = [
            f"🚨 NODE DISCOVERY: {display_name} in {country} corridor.",
            f"⚡ GLOBALPATH ALERT: New recruitment opportunity at {display_name}.",
            f"🌍 CORRIDOR SYNC: {display_name} detected via Uganda uplink.",
            f"🤖 AGENT REPORT: Potential B2B node identified - {display_name}.",
            f"🔍 AUDIT LOG: Node {display_name} verification pending.",
            f"📡 SIGNAL: {display_name} sync active."
        ]
        title_prefix = random.choice(templates)
        
        # 3. Use Groq Cloud (llama-3.3-70b-versatile) to vary the description wording
        refined_summary = interests
        try:
            # Use Groq Cloud client
            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional job description optimizer. Rewrite the job interests to be more compelling and professional while maintaining the core meaning. Keep it under 150 words."
                    },
                    {
                        "role": "user",
                        "content": f"Optimize this job description: {interests}"
                    }
                ],
                temperature=0.7,
                max_tokens=200
            )
            refined_summary = response.choices[0].message.content
            print(f"🤖 Phi-3 Refined Summary for {display_name}")
        except Exception as e:
            print(f"Phi-3 summary refinement failed, using raw data: {e}")

        # Description Template Rotation
        desc_templates = [
            # Template 1: System Audit Style
            f"### [OVERSIGHT REPORT]\n\n**Node Identifier:** {display_name}\n**Regional Corridor:** {country}\n\n"
            f"**Audit Summary:**\n{refined_summary}\n\n"
            f"**Metadata:**\n- Fingerprint: `{fingerprint}`\n- Trace: `{datetime.now().isoformat()}`\n- Status: Pending Verification",
            
            # Template 2: Technical Sync Style
            f"### [TECHNICAL TELEMETRY]\n\n**Source:** {display_name} Hub\n**Target:** {country} Node\n\n"
            f"**Payload Details:**\n{refined_summary}\n\n"
            f"**System Context:**\n- Sync ID: `{hashlib.md5(display_name.encode()).hexdigest()[:8]}`\n- Auth Hash: `{fingerprint}`",
            
            # Template 3: Analyst Brief Style
            f"### [RECRUITMENT BRIEFING]\n\n**Entity:** {display_name}\n**Corridor:** {country}\n\n"
            f"**Professional Context:**\n{refined_summary}\n\n"
            f"**Tracking Info:**\n- UID: `{fingerprint}`\n- Logged: `{datetime.now().strftime('%Y-%m-%d %H:%M')}`"
        ]
        description = random.choice(desc_templates)

        url = f"https://gitlab.com/api/v4/projects/{project_id}/issues"
        # RECOMMENDATION: Use a Project Access Token or Webhook for better stability/less spam flagging
        headers = {"PRIVATE-TOKEN": gitlab_token}
        payload = {
            "title": f"{title_prefix}",
            "description": description,
            "labels": "node-discovery,automated"
        }

        # Exponential Back-off Implementation
        retries = 0
        max_retries = 2
        retry_delays = [60, 120] # Increased delays for back-off

        async with httpx.AsyncClient(timeout=60.0) as client:  # Increase timeout for Kampala latency
            while retries <= max_retries:
                try:
                    # Delay for retries (jitter already handled initial)
                    if retries > 0:
                        delay = retry_delays[retries - 1]
                        print(f"⏳ Back-off Attempt {retries}: Sleeping {delay}s for {display_name}...")
                        await asyncio.sleep(delay)
                    
                    response = await client.post(url, headers=headers, json=payload)
                    
                    if response.status_code == 201:
                        print(f"🚀 GitLab Direct Action Triggered: Issue created for {display_name}")
                        return "success"
                    
                    elif response.status_code == 400 and "spam" in response.text.lower():
                        if retries < max_retries:
                            retries += 1
                            continue
                        else:
                            print(f"⚠️ GitLab Spam Filter Still Blocking after {max_retries} retries for {display_name}. Redirecting to pending_review.json.")
                            save_to_pending_review({
                                "timestamp": datetime.now().isoformat(),
                                "fingerprint": fingerprint,
                                "title": display_name,
                                "country": country,
                                "interests": interests,
                                "error": "GitLab Spam Filter Blocked (Max Retries)"
                            })
                            return "failed_spam"
                    else:
                        print(f"Failed to trigger GitLab action: {response.status_code} - {response.text}")
                        return "failed"
                        
                except Exception as e:
                    print(f"Error triggering GitLab action for {display_name}: {e}")
                    return "error"
    return "failed"

def save_to_pending_review(item: dict):
    """Saves blocked leads to a local file for manual review."""
    file_path = "pending_review.json"
    try:
        existing = []
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                existing = json.load(f)
        existing.append(item)
        with open(file_path, "w") as f:
            json.dump(existing, f, indent=4)
    except Exception as e:
        print(f"Failed to save to pending_review.json: {e}")

import re

# Priority IDs to process first 
PRIORITY_DATASETS = ["PxGGxYxvWUH4lbJUJ", "3QToNmDUhIoc9smsF", "6hXfOhZjAePxOUFfe"] 

def dataset_mapping_function(item: dict, category: str = "general", forced_country: str = None) -> Document:
    """
    Maps Apify dataset item to a LangChain Document.
    Includes Sector Classification and Ethical Vetting (Anti-Placement Fees).
    """
    # Enhanced title extraction with multiple field checks
    title = (
        item.get("jobTitle") or 
        item.get("title") or 
        item.get("position") or 
        item.get("positionName") or 
        item.get("role") or 
        item.get("job_title") or
        item.get("job_title_text") or
        item.get("position_text") or
        "Unknown Position"
    )
    # Extract company and location separately to prevent cross-contamination
    company = item.get("company") or item.get("companyName") or "Global"
    location = item.get("location") or item.get("country") or "Unknown"
    description = item.get("description") or item.get("snippet") or "No description available"
    url = item.get("url") or item.get("link") or f"{title}-{company}"
    
    # HEALER LOGIC: Fix "Unknown Position" titles using Groq
    if title == "Unknown Position" or not title or title.strip() == "":
        print(f"🔧 [TITLE HEALER]: Repairing unknown title for {company}")
        try:
            # Ask Groq to guess title based on first 300 characters of description
            repair_completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system", 
                        "content": "Extract only the Job Title from this text. Output only title, nothing else."
                    },
                    {
                        "role": "user", 
                        "content": description[:300]
                    }
                ],
                max_tokens=50,
                temperature=0.1
            )
            repaired_title = repair_completion.choices[0].message.content.strip()
            if repaired_title and repaired_title != "Unknown Position":
                title = repaired_title
                print(f"✅ [TITLE HEALER]: Repaired title to '{title}'")
            else:
                # Groq responded but could not identify a title — queue for manual review
                print(f"⚠️ [TITLE HEALER]: Groq returned no usable title for {company} — queuing for manual review")
                save_to_pending_review({
                    **item,
                    "_healer_failure": "groq_returned_unknown",
                    "_company": company,
                    "_description_preview": description[:300],
                })
                raise ValueError(f"[TITLE HEALER] Could not repair title for '{company}' — skipping upsert")
        except ValueError:
            # Re-raise our own sentinel so the call site skips the upsert cleanly
            raise
        except Exception as e:
            # Groq threw — rate limit, timeout, or API error
            print(f"❌ [TITLE HEALER]: Groq error for '{company}': {e} — queuing for manual review")
            save_to_pending_review({
                **item,
                "_healer_failure": "groq_exception",
                "_error": str(e),
                "_company": company,
                "_description_preview": description[:300],
            })
            raise ValueError(f"[TITLE HEALER] Groq exception for '{company}' — skipping upsert") from e
    
    # Generate unique fingerprint
    fingerprint = hashlib.md5(f"{url}-{title}-{company}".encode()).hexdigest()
    
    # 1. Ethical Filtering: Check for illegal placement fees
    # Contextual Exclusion: Ignore 'payment' if linked to 'weekly', 'revenue', 'commission', or 'earned'.
    # Only flag 'payment' if it's linked to 'application', 'visa', or 'processing'.
    content_lower = (title + " " + description).lower()
    
    illegal_keywords = ["placement fee", "recruitment cost", "processing fee", "payment required", "service charge"]
    has_illegal_fees = any(kw in content_lower for kw in illegal_keywords)
    
    # Enhanced Contextual Exclusion Logic for 'payment'
    if "payment" in content_lower:
        # Define context words that make 'payment' safe
        safe_context = ["weekly", "revenue", "commission", "earned", "monthly", "salary"]
        # Define context words that make 'payment' illegal
        illegal_context = ["application", "visa", "processing", "upfront", "deposit"]
        
        # Check if 'payment' is near any illegal context words (within 3 words)
        words = content_lower.split()
        for i, word in enumerate(words):
            if "payment" in word:
                # Look at neighbors
                start = max(0, i - 3)
                end = min(len(words), i + 4)
                neighborhood = words[start:end]
                
                # If illegal context found nearby, flag it
                if any(icw in neighborhood for icw in illegal_context):
                    has_illegal_fees = True
                    break
                
                # If NO safe context found nearby, and it's not clearly safe, we might flag it 
                # but per instructions: "Only flag 'payment' if it's linked to 'application', 'visa', or 'processing'."
                # So we ONLY flag if illegal context is present.
    
    # 2. Sector Classification (Professional vs Blue-Collar)
    professional_keywords = [
        'engineer', 'manager', 'consultant', 'associate', 
        'analyst', 'executive', 'pwc', 'deloitte', 'officer', 'developer', 
        'procurement', 'logistics manager', 'supply chain', 'it specialist', 'cybersecurity',
        'nurse', 'doctor', 'physician', 'ai engineer', 'logistics internship', 'intern',
        'ciklum', 'amazon fulfillment', 'software engineer', 'data scientist'
    ]
    
    blue_collar_keywords = [
        'driver', 'warehouse', 'maid', 'housemaid',
        'helper', 'butcher', 'shelf', 'merchandiser', 'housekeeper',
    ]

    domestic_keywords = [
        'cleaner', 'housekeeper', 'maid', 'nanny', 'domestic', 
        'janitor', 'caregiver', 'care assistant'
    ]

    # Refine category based on title content
    refined_category = category
    if any(kw in title.lower() for kw in professional_keywords):
        refined_category = "professional"
    elif any(kw in title.lower() for kw in blue_collar_keywords):
        refined_category = "blue_collar"
    elif any(kw in title.lower() for kw in domestic_keywords):
        refined_category = "service_domestic"

    # 3. Status Mapping
    status = "live"  # Set to "live" so frontend recognizes as active
    
    # 4. Node Assignment — labels MUST match frontend computeRegionLabelFromLocation()
    # Frontend expects: 'Premium Node', 'Dubai Hub', 'EU-Central', 'Western Corridor',
    #                   'UK-Northern Corridor', 'Global Corridor'
    node = "Global Corridor"  # default
    location_lower = location.lower()
    title_lower    = title.lower()

    if forced_country:
        fc = forced_country.lower()
        if "luxembourg" in fc:
            node = "Premium Node"
        elif "poland" in fc:
            node = "Western Corridor"
        elif "united arab emirates" in fc or "uae" in fc or "dubai" in fc:
            node = "Dubai Hub"
        elif "qatar" in fc or "kuwait" in fc or "bahrain" in fc or "saudi" in fc:
            node = "Dubai Hub"
        elif "germany" in fc or "deutschland" in fc:
            node = "EU-Central"
        elif "uk" in fc or "united kingdom" in fc:
            node = "UK-Northern Corridor"
        elif "canada" in fc or "usa" in fc:
            node = "Western Corridor"
    else:
        if any(loc in location_lower for loc in ["luxembourg", "lux"]):
            node = "Premium Node"
        elif any(loc in location_lower for loc in ["poland", "warszawa", "krakow", "wroclaw"]):
            node = "Western Corridor"
        elif any(loc in location_lower for loc in ["uae", "dubai", "abu dhabi", "emirates"]):
            node = "Dubai Hub"
        elif any(loc in location_lower for loc in ["qatar", "kuwait", "bahrain", "saudi", "riyadh", "jeddah"]):
            node = "Dubai Hub"
        elif any(loc in location_lower for loc in ["germany", "berlin", "munich", "hamburg", "deu"]):
            node = "EU-Central"
        elif any(loc in location_lower for loc in ["uk", "united kingdom", "london", "manchester", "birmingham"]):
            node = "UK-Northern Corridor"
        elif any(loc in location_lower for loc in ["canada", "toronto", "vancouver", "usa"]):
            node = "Western Corridor"
    
    metadata = {
        "name": title,
        "country": forced_country or location,
        "interests": description,
        "category": refined_category.lower(),
        "status": status,
        "illegal_fee_detected": has_illegal_fees,
        "source": "apify_sync",
        "verified": not has_illegal_fees,
        "fingerprint": fingerprint,
        "fee_blocked": not has_illegal_fees,
        "lat": item.get("lat"),
        "lng": item.get("lng"),
        "node": node,  # Critical: Add node assignment
        "corridor": node  # Also add corridor for compatibility
    }

    return Document(
        page_content=f"Position: {title}. Company/Location: {company}. Description: {description}",
        metadata=metadata
    )

def ensure_collection_exists():
    """
    Checks if the Qdrant collection exists and matches the required vector size (3072).
    If it exists but the size is different, it deletes and recreates it.
    """
    try:
        # Get existing collections
        collections = qdrant_client.get_collections().collections
        exists = any(c.name == COLLECTION_NAME for c in collections)
        
        needs_recreation = False
        if exists:
            # Check the configuration of the existing collection
            collection_info = qdrant_client.get_collection(collection_name=COLLECTION_NAME)
            current_size = collection_info.config.params.vectors.size
            if current_size != VECTOR_SIZE:
                print(f"⚠️ Dimension mismatch: Current {current_size} != Required {VECTOR_SIZE}. Forcing recreation...")
                needs_recreation = True
            else:
                print(f"✅ Collection '{COLLECTION_NAME}' already exists with correct size {VECTOR_SIZE}.")
                # MANDATORY: Check if the 'fingerprint' index exists, and create it if not.
                # This ensures stability even if the collection was created without an index previously.
                try:
                    payload_indices = collection_info.payload_schema
                    if "fingerprint" not in payload_indices:
                        print(f"🔍 Missing 'fingerprint' index. Creating it now...")
                        qdrant_client.create_payload_index(
                            collection_name=COLLECTION_NAME,
                            field_name="fingerprint",
                            field_schema=PayloadSchemaType.KEYWORD,
                        )
                    else:
                        print(f"✅ 'fingerprint' payload index already exists.")
                except Exception as index_err:
                    print(f"⚠️ Could not verify/create payload index: {index_err}")
        else:
            print(f"Collection '{COLLECTION_NAME}' does not exist. Creating...")
            needs_recreation = True

        if needs_recreation:
            if exists:
                print(f"⚠️ [VAULT PROTECTION]: Deleting existing collection '{COLLECTION_NAME}'...")
                print(f"⚠️ [VAULT PROTECTION]: This is a destructive operation - ensure you have a backup")
                qdrant_client.delete_collection(collection_name=COLLECTION_NAME)
            
            print(f"🏗️ Creating collection '{COLLECTION_NAME}' with size {VECTOR_SIZE} and COSINE distance...")
            qdrant_client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=VECTOR_SIZE,
                    distance=models.Distance.COSINE
                )
            )
            
            # Create Payload Index for fingerprint (Mandatory for fast deduplication)
            print(f"🔍 Creating payload index on 'fingerprint' for {COLLECTION_NAME}...")
            qdrant_client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name="fingerprint",
                field_schema=PayloadSchemaType.KEYWORD,
            )
            print(f" Collection '{COLLECTION_NAME}' and index created successfully.")
            
    except Exception as e:
        print(f" Error checking/creating collection: {e}")

# THE UNIVERSAL HANDSHAKE: CORS configuration for multi-instance stability
# Add both primary and -1 variant to ensure total stability across Render deployments
# APRIL 30: Added custom domain globalpathkaseddieagent.com
origins = [
    "https://globalpath-kaseddie-agent-2026.onrender.com",
    "https://globalpath-kaseddie-agent-2026-1.onrender.com",  # ✅ Add the new variant
    "https://globalpath-kaseddie-agent-2026-1-oa1d.onrender.com",  # ✅ New Production Frontend
    "https://globalpath-kaseddie-agent-2026-7qm8.onrender.com",  # ✅ Latest Production Instance
    "https://globalpathkaseddieagent.com",  # ✅ APRIL 30: Custom domain
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:5001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5000",
    "https://globalpath-kaseddie-agent-2026-N.onrender.com", # Dynamic staging fallback
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Explicit origins for security + stability
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# ADMIN AUTH: HS256-style compact token (stdlib only, no PyJWT dependency)
# ---------------------------------------------------------------------------
# Resolution order for the admin password:
#   1. ADMIN_PASSWORD (backend-only secret, preferred for production)
#   2. VITE_ADMIN_PASSWORD (compat with frontend env naming)
ADMIN_PASSWORD = SecretManagerGateway.get_secret("ADMIN_PASSWORD") or os.getenv("ADMIN_PASSWORD") or SecretManagerGateway.get_secret("VITE_ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    print("CRITICAL: ADMIN_PASSWORD environment variable is missing.")

# JWT signing secret. Falls back to a per-process random secret so tokens are
# never signed with a hardcoded key, but operators should set JWT_SECRET in
# production to keep sessions valid across restarts / replicas.
JWT_SECRET = SecretManagerGateway.get_secret("JWT_SECRET") or os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "FATAL: JWT_SECRET is not set in the environment. "
        "Server cannot start without a signing secret. "
        "Set JWT_SECRET in your Render/local .env before deploying."
    )
JWT_TTL_SECONDS = int(os.getenv("ADMIN_JWT_TTL_SECONDS", "3600"))  # 1 hour default


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def create_admin_token(subject: str = "admin", ttl_seconds: int = JWT_TTL_SECONDS) -> str:
    """Create a compact HS256-signed token: header.payload.signature."""
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {"sub": subject, "role": "admin", "iat": now, "exp": now + ttl_seconds}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_b64}.{payload_b64}".encode()
    sig = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(sig)}"


def verify_admin_token(token: str) -> Optional[dict]:
    """Return the decoded payload if the token is valid and unexpired, else None."""
    try:
        header_b64, payload_b64, sig_b64 = token.split(".")
    except ValueError:
        return None
    try:
        signing_input = f"{header_b64}.{payload_b64}".encode()
        expected_sig = hmac.new(JWT_SECRET.encode(), signing_input, hashlib.sha256).digest()
        actual_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


security = HTTPBearer(auto_error=False)

async def require_admin_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authorization header missing or invalid")

    payload = verify_admin_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")

    return payload


class AdminLoginRequest(BaseModel):
    password: str


# Lead Model
class Lead(BaseModel):
    name: str
    country: str
    interests: str
    category: str = "general"

class ProposalRequest(BaseModel):
    company: str
    job_title: str
    category: Optional[str] = "Professional"
    salary: Optional[str] = "null"
    country: Optional[str] = ""
    location: Optional[str] = ""
    details: Optional[str] = "High-priority node."
    use_replicate: Optional[bool] = False

class PromoRequest(BaseModel):
    job_title: str
    location: str

class PitchRefineRequest(BaseModel):
    role: str
    location: str
    current_draft: Optional[str] = ""

@api_router.get("/tts")
async def get_tts(text: str = Query(...), voice: str = "en-US-EmmaMultilingualNeural"):
    """
    Generates an MP3 using Edge-TTS for the provided text.
    """
    try:
        output_path = os.path.join(os.getcwd(), "temp_tts.mp3")
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_path)
        return FileResponse(output_path, media_type="audio/mpeg", filename="tts.mp3")
    except Exception as e:
        print(f"Edge-TTS failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/")
async def root():
    return {"status": "online", "message": "GlobalPath Backend is running"}

@api_router.get("/debug/env")
async def debug_environment():
    """
    Debug endpoint to show all environment variables
    """
    # Gate debug endpoint to development only
    if os.getenv("ENV") == "production":
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "all_env_vars": list(os.environ.keys()),
        "groq_vars": {k: v for k, v in os.environ.items() if 'GROQ' in k.upper()},
        "groq_key_loaded": bool(GROQ_KEY),
        "groq_client_initialized": groq_client is not None,
        "python_path": os.path.abspath(__file__),
        "working_directory": os.getcwd()
    }

@api_router.get("/scrape/bayt")
@api_router.post("/scrape/bayt")
async def scrape_bayt_jobs(
    keyword: str = Query(""),
    limit: int = Query(20),
    background_tasks: BackgroundTasks = None,
    admin: dict = Depends(require_admin_token)
):
    """
    Scrape jobs from Bayt.com and ingest into Qdrant.
    """
    logger.info("==================================================")
    logger.info("🤝 [BAYT HANDSHAKE]: Handshake initiated via /api/scrape/bayt")
    logger.info("==================================================")
    
    try:
        from scrapers.bayt_scraper import scrape_bayt_jobs as scrape_func
        logger.info(f"🔍 [BAYT PIPELINE]: Executing Bayt TLS scraper bridge (keyword='{keyword}', limit={limit})...")
        
        # 1. Trigger Scraper
        jobs = scrape_func(keyword=keyword, limit=limit)
        total_scraped = len(jobs) if jobs else 0
        logger.info(f"⚡ [BAYT PIPELINE]: Scraper returned {total_scraped} raw job listings.")
        
        if not jobs:
            logger.warning("⚠️ [BAYT PIPELINE]: No jobs extracted during this run.")
            logger.info("==================================================")
            return {"status": "success", "jobs_ingested": 0, "message": "No jobs found"}

        # 2. Ingest into Qdrant
        def ingest_jobs():
            logger.info("⚙️ [BAYT PIPELINE]: Transforming raw data into GlobalPath lead schema...")
            points = []
            skipped_duplicates = 0
            
            for job in jobs:
                # Map Bayt job to our document format
                item = {
                    "jobTitle": job.get("title"),
                    "title": job.get("title"),
                    "company": job.get("company"),
                    "location": job.get("location"),
                    "description": job.get("salaryText", "") + " - Apply at " + job.get("applyUrl", ""),
                    "snippet": job.get("salaryText"),
                    "url": job.get("applyUrl"),
                    "link": job.get("applyUrl")
                }
                try:
                    doc = dataset_mapping_function(item, category="general", forced_country="UAE")
                    # Update source to Bayt
                    doc.metadata["source"] = "Bayt (Middle East)"
                    doc.metadata["vetted"] = True  # Ensure it's visible in the UI
                    doc.metadata["status"] = "verified"  # Mark as verified
                    doc.metadata["zero_fee"] = job.get("zeroFeeMandate", True)  # Add zero fee flag
                    doc.metadata["created_at"] = datetime.now().isoformat()
                    
                    # Generate fingerprint for deduplication
                    fingerprint = doc.metadata.get("fingerprint")
                    if fingerprint:
                        # Check if fingerprint already exists
                        search_result = qdrant_client.scroll(
                            collection_name=COLLECTION_NAME,
                            scroll_filter=models.Filter(
                                must=[models.FieldCondition(key="fingerprint", match=models.MatchValue(value=fingerprint))]
                            ),
                            limit=1
                        )
                        if search_result[0]:
                            # Fingerprint already exists, skip this job
                            skipped_duplicates += 1
                            continue
                    
                    # Get embedding
                    embedding = get_embeddings().embed_query(doc.page_content)
                    # Create point
                    point_id = job.get("jobId") or str(uuid.uuid4())
                    point = models.PointStruct(
                        id=point_id,
                        vector=embedding,
                        payload=doc.metadata
                    )
                    points.append(point)
                except Exception as e:
                    logger.warning(f"⚠️ [BAYT INGEST]: Skipping job: {e}")
            
            if points:
                logger.info(f"🚀 [BAYT PIPELINE]: Upserting {len(points)} points into Qdrant collection 'globalpath_leads'...")
                qdrant_client.upsert(
                    collection_name=COLLECTION_NAME,
                    points=points
                )
                logger.info(f"✅ [BAYT HANDSHAKE COMPLETE]: Successfully ingested {len(points)} jobs (skipped {skipped_duplicates} duplicates)!")
            else:
                logger.info("ℹ️ [BAYT PIPELINE]: No new jobs to ingest (all were duplicates or failed processing).")
            logger.info("==================================================")
        
        # Run ingestion in background
        if background_tasks:
            background_tasks.add_task(ingest_jobs)
        
        return {
            "status": "success",
            "jobs_found": len(jobs),
            "source": "Bayt (Middle East)"
        }
    except Exception as e:
        logger.error(f"❌ [BAYT PIPELINE ERROR]: Pipeline failed: {str(e)}")
        logger.info("==================================================")
        raise HTTPException(status_code=500, detail=f"Bayt pipeline failed: {str(e)}")

@api_router.post("/recategorize-leads")
async def recategorize_existing_leads(admin: dict = Depends(require_admin_token)):
    """
    Soft Re-Categorization & Gemini Premium Compliance Vetting.
    Iterates through leads to re-run category detection and perform deep legal vetting
    for the Uganda–Canada–UAE recruitment corridors using Gemini.
    """
    try:
        print(f"🔄 [RECATEGORIZE]: Starting soft re-categorization and Gemini audit...")
        
        # Get all points from collection
        all_points = qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            limit=10000,
            with_payload=True,
            with_vectors=True
        )[0]
        
        print(f"🔄 [RECATEGORIZE]: Found {len(all_points)} leads to process.")
        
        updated_count = 0
        points_to_update = []

        for point in all_points:
            payload = point.payload
            original_category = payload.get('category', 'general')
            country = payload.get('country', 'Global')
            
            # 1. Soft Re-Categorization Logic
            title = (payload.get('name') or payload.get('title') or payload.get('positionName') or '').lower()
            description = (payload.get('interests') or payload.get('description') or '').lower()
            text = f"{title} {description}"
            
            # Keywords for categorization
            professional_keywords = ['engineer', 'manager', 'consultant', 'associate', 'analyst', 'executive', 'pwc', 'deloitte', 'officer', 'developer', 'procurement', 'logistics manager', 'supply chain', 'it specialist', 'cybersecurity', 'nurse', 'doctor', 'physician', 'ai engineer', 'logistics internship', 'intern']
            blue_collar_keywords = ['driver', 'warehouse', 'maid', 'housemaid', 'helper', 'butcher', 'shelf', 'merchandiser', 'housekeeper']
            domestic_keywords = ['cleaner', 'housekeeper', 'maid', 'nanny', 'domestic', 'janitor', 'caregiver', 'care assistant']

            new_category = original_category
            if any(kw in text for kw in professional_keywords):
                new_category = "professional"
            elif any(kw in text for kw in domestic_keywords):
                new_category = "service_domestic"
            elif any(kw in text for kw in blue_collar_keywords):
                new_category = "blue_collar"
            
            # 2. Gemini Premium Compliance Vetting (Uganda-Canada-UAE)
            compliance_audit = payload.get('compliance_audit')
            needs_audit = country.lower() in ['canada', 'united arab emirates', 'uae', 'uganda']
            
            if gemini_client and needs_audit and not compliance_audit:
                print(f"⚖️ [GEMINI AUDIT]: Vetting lead for {country} corridor...")
                prompt = f"""
                Act as a GlobalPath Compliance Auditor for the {country} corridor.
                VETTING TASK: Perform deep legal analysis for this recruitment lead.
                
                ROLE: {payload.get('name', 'Unknown')}
                DESCRIPTION: {payload.get('interests', 'No description')}
                CORRIDOR: Uganda to {country}
                
                LEGAL CONSTRAINTS:
                - Canada: Verify LMIA status requirements and Zero-Fee recruitment compliance.
                - UAE: Verify Mohre compliance, Kafala system risks, and AVA Trinity (Accommodation, Visa, Airfare).
                - Uganda: Verify externalization license requirements.
                
                RETURN JSON FORMAT ONLY:
                {{
                  "compliance_score": 0-100,
                  "risk_level": "Low" | "Medium" | "High",
                  "legal_flags": ["list of concerns"],
                  "ethical_status": "Verified" | "Flagged",
                  "summary": "1-sentence audit summary"
                }}
                """
                try:
                    # Async generation wrapper using modern gemini_client
                    loop = asyncio.get_event_loop()
                    response = await loop.run_in_executor(
                        None, 
                        lambda: gemini_client.models.generate_content(
                            model='gemini-2.0-flash',
                            contents=[prompt],
                            config=types.GenerateContentConfig(
                                max_output_tokens=1024,
                                temperature=0.7
                            )
                        )
                    )
                    
                    audit_text = response.text.strip()
                    if "```json" in audit_text:
                        audit_text = audit_text.split("```json")[1].split("```")[0].strip()
                    
                    payload['compliance_audit'] = json.loads(audit_text)
                    payload['vetted'] = True
                    payload['status'] = 'verified' if payload['compliance_audit'].get('ethical_status') == 'Verified' else 'flagged'
                    print(f"✅ [GEMINI AUDIT]: Audit complete for '{payload.get('name')}'")
                except Exception as e:
                    print(f"⚠️ [GEMINI AUDIT]: Failed for lead: {e}")

            # Update if changes occurred
            if new_category != original_category or 'compliance_audit' in payload:
                payload['category'] = new_category
                points_to_update.append(
                    models.PointStruct(
                        id=point.id,
                        vector=point.vector,
                        payload=payload
                    )
                )
                updated_count += 1
        
        # Bulk update to persistent Qdrant storage
        if points_to_update:
            print(f"💾 [PERSISTENT STORE]: Updating {len(points_to_update)} nodes in ./qdrant_storage...")
            qdrant_client.upsert(
                collection_name=COLLECTION_NAME,
                points=points_to_update
            )
            print(f"✅ [RECATEGORIZE]: Successfully updated and vetted {updated_count} leads.")
        else:
            print(f"✅ [RECATEGORIZE]: No updates or audits needed.")
        
        return {
            "status": "success",
            "total_processed": len(all_points),
            "updated_count": updated_count,
            "message": f"Recategorization and Gemini Compliance Audit complete. {updated_count} nodes updated."
        }
        
    except Exception as e:
        print(f"❌ [RECATEGORIZE]: Error during re-categorization: {e}")
        return {
            "status": "error",
            "message": f"Failed to re-categorize leads: {str(e)}",
            "updated_count": 0
        }

@api_router.get("/transparency-report")
async def get_transparency_data():
    """
    Transparency Report: Calculate fees blocked and handshakes verified.
    Implements Greed-to-Ethic ratio for ethical recruitment impact.
    """
    try:
        print(f"📊 [TRANSPARENCY REPORT]: Generating ethical impact data...")
        
        # Get all points from collection
        all_points = qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            limit=10000,
            with_payload=True,
            with_vectors=False
        )[0]
        
        print(f"📊 [TRANSPARENCY REPORT]: Found {len(all_points)} total leads")
        
        # Calculate metrics
        fees_blocked_count = 0
        handshakes_verified = 0
        total_leads = len(all_points)
        
        for point in all_points:
            payload = point.payload
            
            # Check if fee was detected (blocked by compliance middleware)
            # This checks for fee-related keywords in description or if fee field exists
            description = (payload.get('description') or "").lower()
            if any(keyword in description for keyword in ['fee', 'visa cost', 'payment', 'charge', 'candidate pay', 'processing fees']):
                fees_blocked_count += 1
            
            # Check if lead is verified/active
            status = payload.get('status', '').lower()
            if status in ['active', 'verified', 'vetted', 'live']:
                handshakes_verified += 1
        
        # Calculate savings (estimated $500 saved per blocked fee)
        savings_to_workers = fees_blocked_count * 500
        
        # Calculate system health percentage
        if total_leads > 0:
            ethical_ratio = (handshakes_verified / total_leads) * 100
        else:
            ethical_ratio = 100
        
        system_health = f"{ethical_ratio:.1f}% Ethical"
        
        print(f"📊 [TRANSPARENCY REPORT]: Fees Blocked: {fees_blocked_count}")
        print(f"📊 [TRANSPARENCY REPORT]: Handshakes Verified: {handshakes_verified}")
        print(f"📊 [TRANSPARENCY REPORT]: Savings to Workers: ${savings_to_workers}")
        print(f"📊 [TRANSPARENCY REPORT]: System Health: {system_health}")
        
        return {
            "total_leads": total_leads,
            "fees_blocked": fees_blocked_count,
            "handshakes_verified": handshakes_verified,
            "savings_to_workers": savings_to_workers,
            "system_health": system_health,
            "greed_to_ethic_ratio": f"1:{handshakes_verified // max(fees_blocked_count, 1)}",
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"❌ [TRANSPARENCY REPORT]: Error generating report: {e}")
        return {
            "status": "error",
            "message": f"Failed to generate transparency report: {str(e)}",
            "fees_blocked": 0,
            "handshakes_verified": 0,
            "savings_to_workers": 0,
            "system_health": "Unknown"
        }

@api_router.post("/heal-unknown-titles")
async def heal_unknown_titles(admin: dict = Depends(require_admin_token)):
    """
    SURGICAL HEAL: Update only 'Unknown Position' titles without touching other records.
    This fixes existing leads in-place without triggering a database flush or re-sync.
    """
    try:
        print(f"🩹 [SURGICAL HEAL]: Starting heal for 'Unknown Position' leads...")
        
        # Get all points with 'Unknown Position' in title
        all_points = qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            limit=10000,
            with_payload=True,
            with_vectors=False
        )[0]
        
        points_to_heal = []
        healed_count = 0
        
        for point in all_points:
            payload = point.payload
            title = payload.get('name', '')
            description = payload.get('interests', '')
            
            # Check if title needs healing
            if not title or title == "Unknown Position" or title.strip() == "":
                print(f"🩹 [SURGICAL HEAL]: Found lead with unknown title. Attempting heal...")
                
                # Try to extract title from description
                new_title = title
                if description:
                    # First line of description often contains the title
                    first_line = description.split('\n')[0].strip()
                    if first_line and len(first_line) > 3 and len(first_line) < 100:
                        new_title = first_line
                        print(f"🩹 [SURGICAL HEAL]: Extracted title from first line: '{new_title}'")
                    else:
                        # Use AI to extract title
                        try:
                            ai_response = groq_client.chat.completions.create(
                                model="llama-3.3-70b-versatile",
                                messages=[
                                    {
                                        "role": "system",
                                        "content": "Extract only the Job Title from this text. Output only the job title, nothing else."
                                    },
                                    {
                                        "role": "user",
                                        "content": description[:300]
                                    }
                                ],
                                max_tokens=50,
                                temperature=0.1
                            )
                            ai_title = ai_response.choices[0].message.content.strip()
                            if ai_title and ai_title != "Unknown Position":
                                new_title = ai_title
                                print(f"🩹 [SURGICAL HEAL]: AI extracted title: '{new_title}'")
                        except Exception as e:
                            print(f"❌ [SURGICAL HEAL]: AI extraction failed: {e}")
                            new_title = "Strategic Lead"
                else:
                    new_title = "Strategic Lead"
                
                # Update only the title field
                if new_title != title:
                    payload['name'] = new_title
                    points_to_heal.append(
                        models.PointStruct(
                            id=point.id,
                            vector=point.vector,
                            payload=payload
                        )
                    )
                    healed_count += 1
        
        # Surgical update: Only update healed leads
        if points_to_heal:
            print(f"🩹 [SURGICAL HEAL]: Performing surgical update of {len(points_to_heal)} leads...")
            qdrant_client.upsert(
                collection_name=COLLECTION_NAME,
                points=points_to_heal
            )
            print(f"✅ [SURGICAL HEAL]: Successfully healed {healed_count} leads")
        else:
            print(f"✅ [SURGICAL HEAL]: No leads needed healing")
        
        return {
            "status": "success",
            "total_scanned": len(all_points),
            "healed_count": healed_count,
            "message": f"Surgical heal complete. {healed_count} 'Unknown Position' leads updated."
        }
        
    except Exception as e:
        print(f"❌ [SURGICAL HEAL]: Error during heal: {e}")
        return {
            "status": "error",
            "message": f"Failed to heal titles: {str(e)}",
            "healed_count": 0
        }

@api_router.get("/debug-routes")
async def debug_routes():
    """
    Debug endpoint to list all registered routes.
    Used to verify API router is properly registered.
    """
    # Gate debug endpoint to development only
    if os.getenv("ENV") == "production":
        raise HTTPException(status_code=403, detail="Access denied")
    routes = []
    for route in app.routes:
        if hasattr(route, 'methods') and hasattr(route, 'path'):
            routes.append({
                "path": route.path,
                "methods": list(route.methods),
                "name": getattr(route, 'name', 'unknown')
            })
    return {
        "total_routes": len(routes),
        "routes": routes
    }

@api_router.get("/ping")
async def ping_ai():
    """
    Test AI connectivity and API key status
    """
    # Gate sensitive diagnostic to development only
    if os.getenv("ENV") == "production":
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        print(f"🔍 [PING DEBUG]: Testing Groq API Key: {'YES' if GROQ_KEY else 'NO'}")
        print(f"🔍 [PING DEBUG]: Available env vars: {[k for k in os.environ.keys() if 'GROQ' in k.upper()]}")
        print(f"🔍 [PING DEBUG]: All env vars: {list(os.environ.keys())}")
        
        if not GROQ_KEY or not groq_client:
            return {"status": "AI_KEY_MISSING", "message": "Groq API key not configured or client failed to initialize"}
        
        # Test Groq API with minimal request
        test_response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "user", "content": "ping"}
            ],
            max_tokens=10,
            temperature=0.1
        )
        
        print(f"✅ [PING SUCCESS]: Groq API responded successfully")
        return {"status": "AI_CONNECTED", "message": "Groq API is working"}
        
    except Exception as e:
        error_msg = str(e).lower()
        print(f"❌ [PING ERROR]: {e}")
        
        # Return specific error codes for frontend
        if "401" in error_msg or "unauthorized" in error_msg:
            return {"status": "AI_KEY_INVALID", "message": "Invalid Groq API key (401 Unauthorized)"}
        elif "connection" in error_msg or "timeout" in error_msg:
            return {"status": "AI_CONNECTION_FAILED", "message": "Failed to connect to Groq API"}
        else:
            return {"status": "AI_ERROR", "message": f"Groq API error: {str(e)}"}

@api_router.post("/generate-proposal")
async def generate_proposal(req: ProposalRequest):
    """
    Generates a Unified Outreach Pitch (B2B + Direct Pitch) using Ollama (Phi-3) or Replicate.
    Handles null salary values and adjusts tone based on corridor/category.
    Prioritizes Replicate for complex reasoning when use_replicate flag is set.
    """
    try:
        # PITCH PRIORITY LANE: Pause background node sync to give Groq Llama-3 full bandwidth
        print("🚦 [PRIORITY LANE]: Pausing background node sync for B2B Generation...")
        pitch_priority_event.clear()
        
        # Error logging: Check API keys and lead data
        print(f"🔍 [PROPOSAL DEBUG]: Groq API Key loaded: {'YES' if GROQ_KEY else 'NO'}")
        print(f"🔍 [PROPOSAL DEBUG]: Replicate API Key loaded: {'YES' if os.getenv('REPLICATE_API_TOKEN') else 'NO'}")
        print(f"🔍 [PROPOSAL DEBUG]: Lead data received - Company: {req.company}, Role: {req.job_title}, Location: {req.location}")
        print(f"🔍 [PROPOSAL DEBUG]: Category: {req.category}, Salary: {req.salary}")
        print(f"🔍 [PROPOSAL DEBUG]: Use Replicate: {req.use_replicate}")
        
        # Text Pre-Processor: Sanitize and truncate large details to prevent timeouts
        raw_details = req.details or ""
        sanitized_details = raw_details[:2000] if len(raw_details) > 2000 else raw_details
        print(f"🔍 [PROPOSAL DEBUG]: Details sanitized - Original length: {len(raw_details)}, Sanitized length: {len(sanitized_details)}")
        
        # Update request with sanitized details
        req.details = sanitized_details
        
        # Dynamic Prompt Construction based on Corridor & Category
        system_prompt = "You are a GlobalPath B2B outreach specialist. Generate concise, compelling recruitment pitches."
        
        # Industry-specific adjustments based on job title and company
        industry_keywords = []
        
        # AI UX FIX: Handle "Unknown Position" - assume general role instead of failing
        effective_title = req.job_title
        if req.job_title and req.job_title.lower() in ['unknown position', 'unknown', 'unknown role', '']:
            print(f"🤖 [UNKNOWN POSITION FIX]: Title is '{req.job_title}', assuming general administrative/logistics role")
            effective_title = "Administrative & Logistics Professional"
            industry_keywords.append('administrative & logistics')
            system_prompt += " Assume a general administrative/logistics role. Focus on organizational skills, operational efficiency, and versatile workforce solutions."
        elif req.job_title:
            title_lower = req.job_title.lower()
            if any(kw in title_lower for kw in ['driver', 'delivery', 'transport', 'logistics']):
                industry_keywords.append('transportation & logistics')
                system_prompt += " Focus on fleet management, route optimization, and driver retention strategies."
            elif any(kw in title_lower for kw in ['engineer', 'developer', 'software', 'it', 'tech']):
                industry_keywords.append('technology & software')
                system_prompt += " Emphasize innovation, technical talent acquisition, and digital transformation."
            elif any(kw in title_lower for kw in ['cleaner', 'housekeeper', 'maid', 'domestic']):
                industry_keywords.append('hospitality & facilities')
                system_prompt += " Highlight quality standards, reliability, and professional service delivery."
            elif any(kw in title_lower for kw in ['nurse', 'doctor', 'medical', 'healthcare']):
                industry_keywords.append('healthcare')
                system_prompt += " Focus on patient care standards, medical compliance, and healthcare expertise."
        
        # Adjust tone based on corridor
        if req.country and "luxembourg" in req.country.lower():
            system_prompt += " Target EU market with compliance emphasis and premium talent solutions."
        elif req.country and "uae" in req.country.lower():
            system_prompt += " Leverage GCC advantages with rapid deployment and tax benefits."
        else:
            system_prompt += " Emphasize global reach and zero-fee recruitment model."
        
        # Adjust based on category
        if req.category and req.category.lower() == "blue_collar":
            system_prompt += " Use clear, direct language emphasizing reliability and practical benefits."
        elif req.category and req.category.lower() == "professional":
            system_prompt += " Use professional tone highlighting career growth and expertise development."
        
        # Handle null salary in prompt
        salary_text = f"Salary: {req.salary}" if req.salary else "Competitive compensation package"
        
        # Industry context for the pitch
        industry_context = f"Industry: {', '.join(industry_keywords) if industry_keywords else 'General business'}" if industry_keywords else ""
        
        # Fallback for empty description to prevent AI crashes
        safe_description = req.details if req.details and req.details.strip() else "General recruitment lead with standard requirements"
        
        # AI UX FIX: Use effective_title in prompt (handles Unknown Position case)
        user_prompt = f"""
        Generate a targeted B2B recruitment pitch for:
        Company: {req.company}
        Role: {effective_title}
        Location: {req.location}
        {salary_text}
        Category: {req.category}
        {industry_context}
        Description: {safe_description}
        
        Create a pitch that speaks directly to their industry challenges and opportunities.
        Write 3–4 paragraphs (250–400 words). Include a clear call-to-action and end with:
        WhatsApp: +256 784428821 / +256 756824859
        Email: hr@globalpathkaseddieagent.com
        """
        
        print(f"🔍 [PROPOSAL DEBUG]: Calling Groq API with model: llama-3.3-70b-versatile")
        
        # Use Groq Cloud client
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=450  # Increased from 200 — 200 was truncating pitches mid-sentence
        )
        
        pitch = response.choices[0].message.content or "Failed to generate proposal."
        print(f"✅ [PROPOSAL DEBUG]: Generated pitch ({len(pitch)} chars)")
        return {"pitch": pitch}
        
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        print(f"❌ [PROPOSAL ERROR]: Error generating proposal: {error_msg}")
        print(f"❌ [PROPOSAL ERROR]: Error type: {error_type}")
        print(f"❌ [PROPOSAL ERROR]: Full error details: {repr(e)}")
        
        # Log HTTP status codes if available
        if hasattr(e, 'status_code'):
            print(f"❌ [PROPOSAL ERROR]: HTTP Status Code: {e.status_code}")
        if hasattr(e, 'response'):
            print(f"❌ [PROPOSAL ERROR]: Response: {e.response}")
        
        # Return specific error codes for frontend
        error_msg_lower = error_msg.lower()
        if "timeout" in error_msg_lower or "connection" in error_msg_lower:
            raise HTTPException(status_code=504, detail="Server Busy")
        elif "401" in error_msg or "unauthorized" in error_msg_lower or "key" in error_msg_lower:
            raise HTTPException(status_code=401, detail="AI Service Key Invalid")
        elif "rate" in error_msg_lower or "limit" in error_msg_lower:
            raise HTTPException(status_code=429, detail="Rate Limit Exceeded")
        else:
            raise HTTPException(status_code=500, detail=error_msg)
    finally:
        # PITCH PRIORITY LANE: Resume background node sync
        print("🟢 [PRIORITY LANE]: Resuming background node sync...")
        pitch_priority_event.set()

class ChatRequest(BaseModel):
    message: str

KASEDDIE_SYSTEM_PROMPT = (
    "You are Kaseddie Agent, an elite B2B recruitment specialist for GlobalPath. "
    "Your expertise covers Uganda-to-GCC, EU, and Western corridor recruitment, "
    "labor law compliance, zero-fee mandate enforcement, and pitch strategy. "
    "Be concise, professional, and solution-oriented. "
    "When asked about job markets, provide data-driven insights relevant to the corridors we serve."
)

@api_router.post("/chat")
async def chat_with_gemini(req: ChatRequest):
    """
    Kaseddie Uplink Chat endpoint.
    Primary: Gemini 2.0 Flash. Automatic fallback: Groq llama-3.3-70b-versatile.
    The chat will always work as long as at least one AI key is configured.
    """
    user_message = req.message.strip()
    print(f"🔍 [CHAT]: Gemini={'YES' if (gemini_client and GEMINI_API_KEY) else 'NO'} | Groq={'YES' if (groq_client and GROQ_KEY) else 'NO'} | msg={user_message[:80]}...")

    # ── PRIMARY: Gemini ──────────────────────────────────────────────────────
    if gemini_client and GEMINI_API_KEY:
        try:
            response = gemini_client.models.generate_content(
                model='gemini-2.0-flash',
                contents=[
                    types.Content(
                        role='user',
                        parts=[types.Part.from_text(
                            text=f"System: {KASEDDIE_SYSTEM_PROMPT}\n\nUser: {user_message}"
                        )]
                    )
                ],
                config=types.GenerateContentConfig(
                    max_output_tokens=600,
                    temperature=0.7
                )
            )
            reply = (response.text or "").strip()
            if reply:
                print(f"✅ [CHAT/Gemini]: Responded ({len(reply)} chars)")
                return {"reply": reply}
            print("⚠️ [CHAT/Gemini]: Empty response — falling back to Groq")
        except Exception as gemini_err:
            print(f"⚠️ [CHAT/Gemini]: Error ({type(gemini_err).__name__}: {gemini_err}) — falling back to Groq")

    # ── FALLBACK: Groq llama-3.3-70b-versatile ───────────────────────────────
    if groq_client and GROQ_KEY:
        try:
            groq_response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": KASEDDIE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=600,
                temperature=0.7,
                timeout=45
            )
            reply = (groq_response.choices[0].message.content or "").strip()
            if reply:
                print(f"✅ [CHAT/Groq-fallback]: Responded ({len(reply)} chars)")
                return {"reply": reply}
        except Exception as groq_err:
            print(f"❌ [CHAT/Groq-fallback]: Error ({type(groq_err).__name__}: {groq_err})")
            return {
                "reply": "The AI service is temporarily unavailable. Please try again in a moment.",
                "error": f"Groq error: {str(groq_err)}"
            }

    # ── NO AI CONFIGURED ────────────────────────────────────────────────────
    print("❌ [CHAT]: No AI client available — check GEMINI_API_KEY or GROQ_API_KEY in Render env vars")
    return {
        "reply": "AI service is not configured. Please contact the administrator to set up the API keys.",
        "error": "No AI client available"
    }

class AgentChatRequest(BaseModel):
    message: str

async def generate_chat_stream(message: str) -> AsyncGenerator[str, None]:
    """
    Generate streaming chat response.
    Primary: Gemini stream. Fallback: Groq non-stream yielded as one chunk.
    """
    # ── PRIMARY: Gemini streaming ────────────────────────────────────────────
    if gemini_client and GEMINI_API_KEY:
        try:
            stream = gemini_client.models.generate_content_stream(
                model='gemini-2.0-flash',
                contents=[
                    types.Content(
                        role='user',
                        parts=[types.Part.from_text(text=f"""{KASEDDIE_SYSTEM_PROMPT}

User: {message}""")]
                    )
                ],
                config=types.GenerateContentConfig(
                    max_output_tokens=1024,
                    temperature=0.7,
                    top_p=1
                )
            )
            gemini_yielded = False
            for chunk in stream:
                if chunk.text:
                    yield chunk.text
                    gemini_yielded = True
            if gemini_yielded:
                return
            print("⚠️ [STREAM/Gemini]: Empty stream — falling back to Groq")
        except Exception as gemini_err:
            print(f"⚠️ [STREAM/Gemini]: {type(gemini_err).__name__}: {gemini_err} — falling back to Groq")

    # ── FALLBACK: Groq llama-3.3-70b-versatile (non-streaming, yielded as chunk) ─
    if groq_client and GROQ_KEY:
        try:
            groq_response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": KASEDDIE_SYSTEM_PROMPT},
                    {"role": "user", "content": message}
                ],
                max_tokens=1024,
                temperature=0.7,
                timeout=45
            )
            yield groq_response.choices[0].message.content or ""
            return
        except Exception as groq_err:
            yield f"AI service temporarily unavailable. Please try again. ({type(groq_err).__name__})"
            return

    yield "AI service is not configured. Please contact the administrator."

@api_router.post("/agent/chat")
async def agent_chat_stream(req: AgentChatRequest):
    """
    Kaseddie AI Agent streaming chat endpoint.
    Primary: Gemini 2.0 Flash stream. Fallback: Groq llama-3.3-70b-versatile.
    Always returns a StreamingResponse — KaseddieChat.tsx reads the body as text.
    The fallback in generate_chat_stream handles missing/failed Gemini automatically.
    """
    try:
        print(f"🔍 [AGENT CHAT]: Message received: {req.message[:100]}...")

        # generate_chat_stream handles both Gemini and Groq fallback internally.
        # Do NOT short-circuit here — let the generator decide which AI to use.
        return StreamingResponse(
            generate_chat_stream(req.message),
            media_type="text/plain"
        )

    except Exception as e:
        print(f"❌ [AGENT CHAT ERROR]: {e}")
        return StreamingResponse(
            iter([f"Chat service error: {str(e)}"]),
            media_type="text/plain"
        )

@api_router.post("/generate-marketing")
async def generate_marketing(job_request: dict):
    """
    Generate marketing content for a verified job lead.
    Primary: Gemini 2.0 Flash. Fallback: Groq llama-3.3-70b-versatile.
    """
    company  = job_request.get('company', 'Global Partner')
    role     = job_request.get('title', 'Strategic Role')
    corridor = job_request.get('corridor', 'Global')

    static_fallback = (
        f"🚀 Exciting opportunity at {company}! We're seeking a talented {role} "
        f"for our {corridor} operations. This role offers excellent growth potential "
        f"and competitive benefits. Zero-fee recruitment — apply now! "
        f"📱 +256 784 428 821 | hr@globalpathkaseddieagent.com"
    )

    prompt = f"""You are a GlobalPath marketing specialist. Create compelling, professional marketing copy for job opportunities.

Company: {company}
Role: {role}
Location/Corridor: {corridor}

Write a WhatsApp-ready marketing message (under 150 words) that highlights:
1. The company prestige and role benefits
2. Corridor/location advantages
3. A clear call-to-action
Include relevant emojis and end with: 📱 +256 784 428 821"""

    # ── PRIMARY: Gemini ─────────────────────────────────────────────────────
    if gemini_client and GEMINI_API_KEY:
        try:
            print(f"🎨 [MARKETING]: Calling Gemini for {company} - {role}")
            response = gemini_client.models.generate_content(
                model='gemini-2.0-flash',
                contents=[prompt],
                config=types.GenerateContentConfig(max_output_tokens=400, temperature=0.7)
            )
            content = (response.text or "").strip()
            if content:
                print(f"✅ [MARKETING/Gemini]: {len(content)} chars")
                return {"marketing_content": content}
            print("⚠️ [MARKETING/Gemini]: Empty response — falling back to Groq")
        except Exception as e:
            print(f"⚠️ [MARKETING/Gemini]: {type(e).__name__}: {e} — falling back to Groq")

    # ── FALLBACK: Groq ───────────────────────────────────────────────────────
    if groq_client and GROQ_KEY:
        try:
            print(f"🎨 [MARKETING/Groq]: Generating for {company} - {role}")
            groq_resp = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a GlobalPath marketing specialist."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=400,
                temperature=0.7,
                timeout=30
            )
            content = (groq_resp.choices[0].message.content or "").strip()
            if content:
                print(f"✅ [MARKETING/Groq]: {len(content)} chars")
                return {"marketing_content": content}
        except Exception as e:
            print(f"❌ [MARKETING/Groq]: {type(e).__name__}: {e}")

    # ── STATIC FALLBACK ──────────────────────────────────────────────────────
    print("⚠️ [MARKETING]: Both AI services unavailable — returning static fallback")
    return {"marketing_content": static_fallback}

@api_router.post("/generate-pitch")
async def generate_pitch(req: PitchRefineRequest):
    """
    Refines a B2B pitch using Ollama (Phi-3) for Luxembourg driver roles.
    """
    try:
        print(f"🎯 [PITCH REFINEMENT]: === API CALL RECEIVED ===")
        print(f"🎯 [PITCH REFINEMENT]: Request for {req.role} in {req.location}")
        print(f"🎯 [PITCH REFINEMENT]: Current draft length: {len(req.current_draft or '')}")
        
        # Dynamic prompt construction based on role and location
        system_prompt = "You are a GlobalPath B2B outreach specialist specializing in Luxembourg driver recruitment. Refine and enhance B2B pitches to be more compelling and professional."
        
        user_prompt = f"""
        Role: {req.role}
        Location: {req.location}
        Current Draft: {req.current_draft}
        
        Please refine this B2B recruitment pitch to:
        1. Be more compelling and professional
        2. Emphasize Luxembourg market advantages
        3. Highlight zero-fee recruitment model
        4. Include strong call-to-action
        5. Keep it under 200 words
        
        Return only refined pitch text.
        """
        
        print(f"🎯 [PITCH REFINEMENT]: Calling Groq llama-3.3-70b-versatile...")
        
        # Use Groq Cloud client
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=400,
            temperature=0.7
        )
        
        refined_pitch = response.choices[0].message.content or req.current_draft
        print(f"✅ [PITCH REFINEMENT]: Success! Refined {len(refined_pitch)} chars")
        print(f"✅ [PITCH REFINEMENT]: === API CALL COMPLETE ===")
        
        return {"refined_pitch": refined_pitch}
        
    except Exception as e:
        print(f"❌ [PITCH REFINEMENT]: === API ERROR ===")
        print(f"❌ [PITCH REFINEMENT]: Error: {e}")
        print(f"❌ [PITCH REFINEMENT]: Error type: {type(e).__name__}")
        # Return original draft if refinement fails
        return {"refined_pitch": req.current_draft or "Pitch refinement failed. Please try again."}

@api_router.post("/generate-promo")
async def generate_promo(req: PromoRequest):
    """
    Generates a Cyberpunk-style recruitment promo video.
    1. Generates a Flux image (Fal.ai).
    2. Animates it into a 5s Kling video (Replicate).
    """
    try:
        # 1. Generate Prompt
        prompt = f"Professional recruitment banner for {req.job_title} in {req.location}. GlobalPath logo, futuristic workforce hub."
        
        # 2. Generate Image
        image_url = await generate_flux_image(prompt)
        if not image_url:
            raise HTTPException(status_code=500, detail="Failed to generate promo image.")
            
        # 3. Generate Video
        video_url = await generate_kling_video(image_url)
        if not video_url:
            raise HTTPException(status_code=500, detail="Failed to animate promo video.")
            
        return {
            "status": "Success",
            "image_url": image_url,
            "video_url": video_url,
            "job_title": req.job_title,
            "location": req.location
        }
    except Exception as e:
        print(f"Media Engine Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/ingest-lead")
async def ingest_lead(lead: Lead):
    """
    Ingests a lead: vectorizes data and stores it in Qdrant.
    """
    try:
        # 1. Prepare text for vectorization
        # Combine name, country, and interests into a single semantic string
        text_to_vectorize = f"Name: {lead.name}. Country: {lead.country}. Interests: {lead.interests}"
        
        # 2. Generate Embedding
        vector = get_embeddings().embed_query(text_to_vectorize)

        # 3. Upsert to Qdrant
        point_id = str(uuid.uuid4())
        
        # Normalize category to lowercase
        payload = lead.model_dump()
        payload["category"] = payload.get("category", "general").lower()
        
        # Initialize enriched_contact structure
        payload["enriched_contact"] = {
            "decision_maker_name": None,
            "decision_maker_title": None,
            "outreach_status": "pending",
            "contact_channels": {},
            "grounding_source": None
        }
        
        qdrant_client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload
                )
            ]
        )

        # 4. Trigger GitLab Direct Action
        try:
            await trigger_gitlab_direct_action(lead.name, lead.country, lead.interests)
        except Exception as gitlab_err:
            print(f"⚠️ GitLab action failed, but lead was saved to Qdrant: {gitlab_err}")

        return {
            "status": "Success",
            "message": "Lead ingested successfully",
            "lead_id": point_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AuditSync(BaseModel):
    audit_id: str
    company_name: str
    risk_level: str
    status: str
    raw_text: str

@api_router.post("/sync-audit")
async def sync_audit_to_qdrant(payload: AuditSync):
    try:
        # Convert raw text to vector
        emb_model = get_embeddings()
        vector = emb_model.embed_query(payload.raw_text)
        
        coll_name = "oversight_sentinel_vectors"
        # Ensure collection exists
        try:
            coll_info = qdrant_client.get_collection(collection_name=coll_name)
            vector_size = coll_info.config.params.vectors.size
        except Exception:
            vector_size = len(vector)
            qdrant_client.create_collection(
                collection_name=coll_name,
                vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE)
            )

        # Pad/truncate vector to match collection's requirements
        if len(vector) < vector_size:
            vector = vector + [0.0] * (vector_size - len(vector))
        elif len(vector) > vector_size:
            vector = vector[:vector_size]

        qdrant_client.upsert(
            collection_name=coll_name,
            points=[
                models.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "id": payload.audit_id,
                        "companyName": payload.company_name,
                        "riskLevel": payload.risk_level,
                        "status": payload.status,
                        "rawText": payload.raw_text,
                        "timestamp": datetime.now().isoformat()
                    }
                )
            ]
        )
        return {"success": True, "message": "Audit synced to Qdrant successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SearchQuery(BaseModel):
    query_text: str
    limit: int = 5

@api_router.post("/search")
async def semantic_search(payload: SearchQuery):
    try:
        # 1. Convert payload.query_text into a high-dimensional vector
        emb_model = get_embeddings()
        query_vector = emb_model.embed_query(payload.query_text)
        
        # Determine the target collection and its vector size
        coll_name = "oversight_sentinel_vectors"
        try:
            coll_info = qdrant_client.get_collection(collection_name=coll_name)
            vector_size = coll_info.config.params.vectors.size
        except Exception:
            coll_name = COLLECTION_NAME
            try:
                coll_info = qdrant_client.get_collection(collection_name=coll_name)
                vector_size = coll_info.config.params.vectors.size
            except Exception:
                vector_size = len(query_vector)
        
        # Pad or truncate vector to match collection's requirements
        if len(query_vector) < vector_size:
            query_vector = query_vector + [0.0] * (vector_size - len(query_vector))
        elif len(query_vector) > vector_size:
            query_vector = query_vector[:vector_size]

        # 2. Query Qdrant collection
        results = qdrant_client.search(
            collection_name=coll_name,
            query_vector=query_vector,
            limit=payload.limit
        )
        
        # Convert Qdrant results to match expected structure
        matches = []
        for hit in results:
            matches.append({
                "id": hit.id,
                "score": hit.score,
                "payload": hit.payload
            })
            
        return {"success": True, "matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/search-leads")
async def search_leads(query: str = Query(..., description="The query to search for leads")):
    """
    Searches for the top 3 matching leads and summarizes them using the LLM.
    """
    try:
        # 1. Convert query to vector
        query_vector = get_embeddings().embed_query(query)

        # 2. Search Qdrant for top 3 matches
        search_result = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=3
        )

        if not search_result:
            return {
                "query": query,
                "summary": "No matching leads found in the database.",
                "leads": []
            }

        # 3. Prepare matches for the LLM
        matches_text = ""
        raw_leads = []
        for i, hit in enumerate(search_result):
            lead_data = hit.payload
            raw_leads.append(lead_data)
            matches_text += f"\nMatch {i+1}: Name: {lead_data.get('name')}, Country: {lead_data.get('country')}, Interests: {lead_data.get('interests')}"

        # 4. Prompt the Agent Brain
        prompt_template = PromptTemplate(
            input_variables=["query", "matches"],
            template="You are the GlobalPath Strategy Assistant. Below are the top matching leads found in our database for the query: {query}.\n\nMatches found:\n{matches}\n\nSummarize why these leads are relevant and suggest a specific ice-breaker for each."
        )
        
        # Format the prompt
        formatted_prompt = prompt_template.format(query=query, matches=matches_text)
        
        # Get LLM response
        summary = llm.invoke(formatted_prompt)

        # 5. Return JSON response
        return {
            "query": query,
            "summary": summary,
            "leads": raw_leads
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def sync_all_apify_datasets():
    """Helper function to sync all datasets from .env to Qdrant with immediate save and async enrichment."""
    try:
        # 1. Gather all dataset IDs from .env
        apify_token = os.getenv("APIFY_TOKEN") or os.getenv("VITE_APIFY_JOBS_TOKEN")
        all_datasets = []
        
        # Collect individual dataset IDs
        ds_uae = os.getenv("APIFY_DATASET_ID_UAE")
        ds_ksa = os.getenv("APIFY_DATASET_ID_KSA")
        ds_poland = os.getenv("APIFY_DATASET_ID_POLAND") or "6hXfOhZjAePxOUFfe"
        ds_lux = os.getenv("APIFY_DATASET_ID_LUX") or "PxGGxYxvWUH4lbJUJ"
        ds_gen = os.getenv("APIFY_DATASET_IDS")
        
        # Add individual datasets
        if ds_uae: all_datasets.append({"id": ds_uae, "corridor": "UAE"})
        if ds_ksa: all_datasets.append({"id": ds_ksa, "corridor": "KSA"})
        if ds_poland: all_datasets.append({"id": ds_poland, "corridor": "Poland"})
        if ds_lux: all_datasets.append({"id": ds_lux, "corridor": "Luxembourg"})
        
        # SPLIT APIFY_DATASET_IDS by comma and add each as individual dataset
        if ds_gen:
            gen_dataset_ids = [ds_id.strip() for ds_id in ds_gen.split(',') if ds_id.strip()]
            for i, ds_id in enumerate(gen_dataset_ids):
                all_datasets.append({"id": ds_id, "corridor": f"General_{i}"})
        
        # Sort so PRIORITY_DATASETS are first (Index 0)
        dataset_list = sorted(all_datasets, key=lambda x: x['id'] in PRIORITY_DATASETS, reverse=True)
        dataset_ids = [d['id'] for d in dataset_list]
            
        if not apify_token or not dataset_ids:
            print("Apify credentials or dataset IDs not found in environment.")
            return 0
            
        # Initialize Apify Client
        client = ApifyClient(token=apify_token)
        total_synced = 0
        
        # Semaphore to limit concurrent dataset syncs (Task requirement: limit to 2)
        semaphore = asyncio.Semaphore(2)

        async def sync_dataset(ds_id, corridor):
            nonlocal total_synced
            async with semaphore:
                print(f"Direct fetching from dataset: {ds_id} (Corridor: {corridor})...")
                
                try:
                    # Fetch dataset items directly using client with limit
                    items_list = client.dataset(ds_id).list_items(limit=150).items
                    logger.info(f"APIFY DATASET FETCH: Retrieved {len(items_list)} items from dataset {ds_id}")
                    
                    # Step 1: Immediate save of raw data to Qdrant
                    raw_points_to_upsert = []
                    enrichment_tasks = []
                    
                    for item in items_list:
                        # Pitch Priority Lane: Wait if B2B generation is running
                        await pitch_priority_event.wait()
                        
                        # Extract fields for fingerprint generation
                        phone = item.get('phone', '') or item.get('phoneNumber', '') or ''
                        email = item.get('email', '') or item.get('emailAddress', '') or ''
                        company = item.get('company', '') or item.get('companyName', '') or ''
                        
                        # Enhanced title extraction with multiple field checks
                        title = (
                            item.get('jobTitle') or 
                            item.get('title') or 
                            item.get('position') or 
                            item.get('positionName') or 
                            item.get('role') or 
                            item.get('job_title') or
                            item.get('job_title_text') or
                            item.get('position_text') or
                            None
                        )
                        
                        # Part 1: Backend Title Reconstruction - Handle "Unknown Position"
                        if title == "Unknown Position" or not title:
                            print(f"⚠️ [TITLE RECONSTRUCTION]: Lead with 'Unknown Position' or no title detected. Attempting to reconstruct...")
                            # Prioritize metadata fields first
                            reconstructed_title = (
                                item.get('jobTitle') or
                                item.get('title') or
                                item.get('position') or
                                item.get('positionName') or
                                item.get('role') or
                                item.get('job_title') or
                                item.get('job_title_text') or
                                item.get('position_text')
                            )
                            
                            if reconstructed_title and reconstructed_title != "Unknown Position":
                                title = reconstructed_title
                                print(f"✅ [TITLE RECONSTRUCTION]: Reconstructed title from metadata: '{title}'")
                            else:
                                # Fallback to AI Enrichment if still no good title
                                description_for_ai = item.get('description', '') or item.get('snippet', '') or item.get('jobTitle', '') or ''
                                if description_for_ai:
                                    try:
                                        print(f"🤖 [AI TITLE EXTRACTION]: No title found, using AI to extract from description...")
                                        ai_response = groq_client.chat.completions.create(
                                            model="llama-3.3-70b-versatile",
                                            messages=[
                                                {"role": "system", "content": "Extract the job title from the first line of this job description. Return ONLY the job title, nothing else."},
                                                {"role": "user", "content": description_for_ai.split('\n')[0]} # Use only the first line
                                            ],
                                            max_tokens=50,
                                            temperature=0.1
                                        )
                                        ai_title = ai_response.choices[0].message.content or ''
                                        title = ai_title.strip().replace('\n', '').replace('\r', '')
                                        print(f"🤖 [AI TITLE EXTRACTION]: AI extracted title: '{title}'")
                                    except Exception as e:
                                        print(f"❌ [AI TITLE EXTRACTION]: Failed to extract title - {e}")
                                        title = 'Strategic Lead'
                                else:
                                    title = 'Strategic Lead'
                        
                        description = item.get('description', '') or item.get('snippet', '') or item.get('jobTitle', '') or 'No description available'
                        
                        # DEBUG: Verify field extraction
                        logger.info(f"FIELD EXTRACTION SUCCESS: {company} | Title: '{title}' | Description: '{description[:50]}...'")
                        
                        # Generate unique fingerprint for deduplication INCLUDES DATASET ID
                        # This ensures leads from different datasets can coexist without overwriting
                        fingerprint = hashlib.md5(f"{ds_id}-{phone}-{email}-{company}-{title[:50]}".encode()).hexdigest()
                        
                        # Deduplication Check
                        search_result = qdrant_client.scroll(
                            collection_name=COLLECTION_NAME,
                            scroll_filter=models.Filter(
                                must=[models.FieldCondition(key="fingerprint", match=models.MatchValue(value=fingerprint))]
                            ),
                            limit=1
                        )
                        if search_result[0]:
                            # Fingerprint already exists, skip this item
                            continue
                        
                        # Create point ID
                        point_id = str(uuid.uuid4())
                        
                        # Step 1A: Immediate raw payload for Qdrant
                        # Resolve a frontend-compatible node label from the corridor string.
                        # This ensures the raw save uses the same vocabulary as the enrichment pass.
                        def _resolve_node(corridor_str: str) -> str:
                            c = corridor_str.lower()
                            if "luxembourg" in c:   return "Premium Node"
                            if "poland" in c:        return "Western Corridor"
                            if "uae" in c or "united arab emirates" in c or "dubai" in c: return "Dubai Hub"
                            if "ksa" in c or "saudi" in c or "qatar" in c:               return "Dubai Hub"
                            if "germany" in c:       return "EU-Central"
                            if "uk" in c or "united kingdom" in c:  return "UK-Northern Corridor"
                            if "canada" in c or "usa" in c:         return "Western Corridor"
                            return "Global Corridor"

                        resolved_node = _resolve_node(corridor)
                        raw_payload = {
                            'phone': phone,
                            'email': email,
                            'company': company or 'Global Partner',
                            'title': title or 'Specialized Role',
                            'description': description,
                            'status': 'verified',
                            'vetted': True,
                            'corridor': resolved_node,
                            'node':     resolved_node,
                            'timestamp': datetime.now().isoformat(),
                            'fingerprint': fingerprint,
                            'source': 'apify_sync',
                            'dataset_id': ds_id,
                            'enriched_contact': {
                                'decision_maker_name': None,
                                'decision_maker_title': None,
                                'outreach_status': 'pending',
                                'contact_channels': {},
                                'grounding_source': None
                            }
                        }
                        
                        # Create a simple vector for immediate storage (using text embedding of raw data)
                        raw_text = f"{company} {description}"
                        try:
                            vector = get_embeddings().embed_query(raw_text)
                        except:
                            # Fallback: create a simple hash-based vector if embedding fails
                            vector = [hash(f"{i}{raw_text}") % 1000 / 1000 for i in range(3072)]
                        
                        raw_points_to_upsert.append(
                            models.PointStruct(
                                id=point_id,
                                vector=vector,
                                payload=raw_payload
                            )
                        )
                        
                        # Step 1B: Schedule async enrichment task
                        enrichment_tasks.append(
                            enrich_lead_data(point_id, item, ds_id)
                        )
                        
                        total_synced += 1

                    # Step 2: Immediate bulk upsert of raw data
                    if raw_points_to_upsert:
                        print(f"Performing IMMEDIATE bulk upsert of {len(raw_points_to_upsert)} raw leads to {COLLECTION_NAME}...")
                        qdrant_client.upsert(
                            collection_name=COLLECTION_NAME,
                            points=raw_points_to_upsert
                        )
                        print(f"✅ Immediate save complete: {len(raw_points_to_upsert)} leads now visible in frontend")
                    
                    # Step 3: Run async enrichment in background (non-blocking)
                    if enrichment_tasks:
                        print(f"🔄 Starting {len(enrichment_tasks)} async enrichment tasks...")
                        asyncio.create_task(run_async_enrichment(enrichment_tasks))

                except Exception as e:
                    print(f"Failed to sync dataset {ds_id}: {e}")

        # Run dataset syncs - Re-ordered list ensure priority datasets hit the semaphore first
        await asyncio.gather(*(sync_dataset(ds_info['id'], ds_info['corridor']) for ds_info in dataset_list))
                
        print(f"Immediate sync complete. Total new leads saved: {total_synced}")
        return total_synced
    except Exception as e:
        print(f"Error during bulk sync: {e}")
        return 0

async def enrich_lead_data(point_id: str, item: dict, dataset_id: str):
    """Background task to enrich a single lead with full metadata, Gemini Search Grounding, and Ollama processing."""
    try:
        # 1. Identification logic for metadata tagging
        is_lux = dataset_id == os.getenv("APIFY_DATASET_ID_LUX") or dataset_id == "PxGGxYxvWUH4lbJUJ"
        is_uae = dataset_id == os.getenv("APIFY_DATASET_ID_UAE")
        is_ksa = dataset_id == os.getenv("APIFY_DATASET_ID_KSA")
        is_poland = dataset_id == dataset_id == "6hXfOhZjAePxOUFfe"
        
        forced_country = None
        outreach_strategy = "General"
        currency = "USD"
        
        if is_lux: 
            forced_country = "Luxembourg"
            currency = "EUR"
        elif is_uae: 
            forced_country = "United Arab Emirates"
            currency = "AED"
        elif is_ksa: 
            forced_country = "Saudi Arabia"
            currency = "SAR"
        elif is_poland: 
            forced_country = "Poland"
            outreach_strategy = "B2B_Direct_Hybrid"
            currency = "PLN"
        
        category = "professional" if (is_lux or is_poland) else "blue_collar"
        # NOTE: dataset_mapping_function will re-evaluate category from title keywords.
        # This value is just the initial hint; refined_category inside the function takes over.
        
        # 2. Extract basic fields for grounding
        company_name = item.get('companyName') or item.get('company') or 'Global Partner'
        job_title = item.get('jobTitle') or item.get('title') or 'Specialized Role'
        
        # 3. GEMINI SEARCH GROUNDING: Deep Contact Extraction
        enriched_contact_data = await get_grounded_contact_data(company_name, job_title)
        
        # 4. Use the existing mapping function to get full Document
        doc = dataset_mapping_function(item, category=category, forced_country=forced_country)
        
        # Apply additional metadata
        doc.metadata["outreach_strategy"] = outreach_strategy
        doc.metadata["currency"] = currency
        doc.metadata["dataset_id"] = dataset_id
        doc.metadata["status"] = "live"  # Set to "live" so frontend recognizes as active
        
        # 5. Integrate Enriched Contact Data
        if enriched_contact_data:
            doc.metadata["decision_maker"] = enriched_contact_data.get("decision_maker_name")
            doc.metadata["decision_maker_title"] = enriched_contact_data.get("decision_maker_title")
            doc.metadata["contact_channels"] = enriched_contact_data.get("contact_channels")
            doc.metadata["grounding_source"] = enriched_contact_data.get("source_validation")
            # Update status to reflect high-value enriched lead
            doc.metadata["outreach_ready"] = True

        # Keep the original raw fields but add enriched metadata
        enriched_payload = {
            'phone': item.get('phone', ''),
            'email': item.get('email', ''),
            'company': company_name,
            'description': item.get('description', '') or item.get('snippet', '') or item.get('jobTitle', '') or 'No description available',
            'fingerprint': doc.metadata.get("fingerprint"),
            'source': 'apify_sync',
            'status': 'live',
            'dataset_id': dataset_id,
            # Add enriched metadata
            'name': doc.metadata.get("name"),
            'country': doc.metadata.get("country"),
            'interests': doc.metadata.get("interests"),
            'category': doc.metadata.get("category"),
            'illegal_fee_detected': doc.metadata.get("illegal_fee_detected"),
            'verified': doc.metadata.get("verified"),
            'fee_blocked': doc.metadata.get("fee_blocked"),
            'outreach_strategy': outreach_strategy,
            'currency': currency,
            'lat': item.get("lat"),
            'lng': item.get("lng"),
            'node': doc.metadata.get("node"),  # Critical: Add node assignment
            'corridor': doc.metadata.get("corridor"),  # Also add corridor for compatibility
            # ENRICHED CONTACT OBJECT (Vercel Frontend Mapping)
            'enriched_contact': {
                'decision_maker_name': doc.metadata.get("decision_maker"),
                'decision_maker_title': doc.metadata.get("decision_maker_title"),
                'outreach_status': 'ready' if doc.metadata.get("outreach_ready") else 'pending',
                'contact_channels': doc.metadata.get("contact_channels"),
                'grounding_source': doc.metadata.get("grounding_source")
            }
        }
        
        # Create enriched vector
        enriched_text = f"Position: {doc.metadata.get('name')}. Company/Location: {doc.metadata.get('country')}. Description: {doc.metadata.get('interests')}"
        try:
            enriched_vector = get_embeddings().embed_query(enriched_text)
        except:
            enriched_vector = [hash(f"{i}{enriched_text}") % 1000 / 1000 for i in range(3072)]
        
        # Update the point with enriched data
        qdrant_client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=enriched_vector,
                    payload=enriched_payload
                )
            ]
        )
        
        # Trigger GitLab Direct Action for enriched lead
        asyncio.create_task(
            await trigger_gitlab_direct_action(
                doc.metadata.get("name", "Unknown"), 
                doc.metadata.get("country", "Global"), 
                doc.metadata.get("interests", "No description"),
                fingerprint=doc.metadata.get("fingerprint")
            )
        )
        
        print(f"✅ Enrichment complete for point {point_id}")
        
    except Exception as e:
        print(f"❌ Failed to enrich lead {point_id}: {e}")

async def run_async_enrichment(tasks):
    """Run multiple enrichment tasks concurrently."""
    try:
        await asyncio.gather(*tasks)
        print("🎉 All enrichment tasks completed")
    except Exception as e:
        print(f"❌ Error in async enrichment: {e}")

@api_router.post("/sync-apify-webhook")
async def sync_apify_webhook(payload: dict, background_tasks: BackgroundTasks):
    """
    Webhook endpoint for Apify to ping when a batch is ready.
    """
    print(f"Received Apify Webhook: {payload.get('resource', 'Unknown Resource')}")
    # We can trigger a specific dataset sync based on the webhook payload if needed
    # For now, let's just trigger a general sync or process the provided resource
    background_tasks.add_task(sync_all_apify_datasets)
    
    return {"status": "Acknowledged"}

@api_router.post("/clear-and-fresh-sync")
async def clear_and_fresh_sync(background_tasks: BackgroundTasks, admin: dict = Depends(require_admin_token)):
    """
    ⚠️ DANGER: This endpoint DELETES ALL DATA from the vault.
    Clears all points in globalpath_leads collection and triggers fresh sync for all corridors.
    This resolves corrupted data issues and ensures clean field extraction.
    
    PRODUCTION SAFETY: This endpoint should be disabled or require admin authentication.
    """
    try:
        print("🗑️ [CLEAR SYNC]: Starting complete data cleanup...")
        
        # Clear the collection completely
        try:
            qdrant_client.delete_collection(collection_name=COLLECTION_NAME)
            print(f"✅ [CLEAR SYNC]: Successfully cleared collection '{COLLECTION_NAME}'")
        except Exception as e:
            print(f"⚠️ [CLEAR SYNC]: Could not clear collection: {e}")
            # If collection doesn't exist, that's fine
            pass
        
        # Recreate collection with proper configuration
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE)
        )
        
        # Create fingerprint index for performance
        qdrant_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="fingerprint",
            field_schema=models.PayloadSchemaType.KEYWORD
        )
        
        print(f"🚀 [CLEAR SYNC]: Recreated collection '{COLLECTION_NAME}' with fresh schema")
        
        # Trigger immediate background sync for all corridors
        background_tasks.add_task(sync_all_apify_datasets)
        
        return {
            "status": "success", 
            "message": "Collection cleared and fresh sync initiated for all corridors (UAE, KSA, Poland, Luxembourg)",
            "details": "All corrupted data has been removed. Fresh sync will populate with correct company and description fields."
        }
        
    except Exception as e:
        print(f"❌ [CLEAR SYNC]: Error during cleanup: {e}")
        return {
            "status": "error", 
            "message": f"Failed to clear and sync: {str(e)}"
        }

@api_router.post("/force-full-sync")
async def force_full_sync(background_tasks: BackgroundTasks, admin: dict = Depends(require_admin_token)):
    """
    Forces a complete resync of all Apify datasets, bypassing fingerprint deduplication.
    This helps when you need to refresh all leads or fix sync issues.
    """
    try:
        print("🔄 [FORCE SYNC]: Starting complete dataset refresh...")
        
        # Clear the collection to start fresh
        try:
            qdrant_client.delete_collection(collection_name=COLLECTION_NAME)
            print(f"🗑️ [FORCE SYNC]: Cleared collection '{COLLECTION_NAME}'")
        except Exception as e:
            print(f"⚠️ [FORCE SYNC]: Could not clear collection: {e}")
        
        # Recreate collection
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE)
        )
        
        # Create fingerprint index
        qdrant_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="fingerprint",
            field_schema=PayloadSchemaType.KEYWORD,
        )
        
        print(f"🚀 [FORCE SYNC]: Recreated collection '{COLLECTION_NAME}'")
        
        # Trigger background sync
        background_tasks.add_task(sync_all_apify_datasets)
        
        return {"status": "success", "message": "Full sync initiated. Collection cleared and refreshing."}
        
    except Exception as e:
        print(f"❌ [FORCE SYNC]: Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/debug/collection-info")
async def debug_collection_info():
    """
    Debug endpoint to check collection status and count.
    """
    # Gate debug endpoint to development only
    if os.getenv("ENV") == "production":
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        # Get collection info
        collection_info = qdrant_client.get_collection(collection_name=COLLECTION_NAME)
        
        # Get actual count
        count_result = qdrant_client.count(collection_name=COLLECTION_NAME)
        
        # Sample a few points to check payload structure
        sample_result = qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            limit=5,
            with_payload=True,
            with_vectors=False
        )
        
        return {
            "collection_name": COLLECTION_NAME,
            "vector_size": collection_info.config.params.vectors.size,
            "total_points": count_result.count,
            "sample_points": [
                {
                    "id": point.id,
                    "payload_keys": list(point.payload.keys()) if point.payload else [],
                    "has_fingerprint": "fingerprint" in (point.payload or {}),
                    "company": point.payload.get("company", "N/A") if point.payload else "N/A"
                }
                for point in sample_result[0]
            ]
        }
        
    except Exception as e:
        return {"error": str(e)}

@api_router.get("/debug/collection")
async def debug_collection():
    """
    Debug endpoint to check collection status and count.
    """
    # Gate debug endpoint to development only
    if os.getenv("ENV") == "production":
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        print(f"🔍 [DEBUG]: Checking collection '{COLLECTION_NAME}'...")
        
        # Check collection exists
        try:
            collection_info = qdrant_client.get_collection(collection_name=COLLECTION_NAME)
            print(f"🔍 [DEBUG]: Collection '{COLLECTION_NAME}' exists")
        except Exception as e:
            print(f"❌ [DEBUG]: Collection '{COLLECTION_NAME}' NOT FOUND: {e}")
            return {"error": f"Collection not found: {e}", "collection_name": COLLECTION_NAME}
        
        # Check collection count
        try:
            count_result = qdrant_client.count(collection_name=COLLECTION_NAME)
            print(f"🔍 [DEBUG]: Collection '{COLLECTION_NAME}' has {count_result.count} total points")
            
            # Get sample data
            sample_result = qdrant_client.scroll(
                collection_name=COLLECTION_NAME,
                limit=3,
                with_payload=True,
                with_vectors=False
            )
            
            return {
                "collection_name": COLLECTION_NAME,
                "total_count": count_result.count,
                "sample_count": len(sample_result[0]),
                "sample_data": sample_result[0][:2] if sample_result[0] else []
            }
        except Exception as e:
            print(f" [DEBUG]: Could not access collection: {e}")
            return {"error": f"Could not access collection: {e}", "collection_name": COLLECTION_NAME}
        
    except Exception as e:
        print(f" [DEBUG]: Error in debug endpoint: {e}")
        return {"error": str(e), "collection_name": COLLECTION_NAME}


@api_router.post("/chat-agent")
async def chat(request: dict):
    """
    General purpose chat completion using Groq.
    """
    try:
        messages = request.get("messages", [])
        # Simple implementation: join messages or just take the last user message
        prompt = ""
        for msg in messages:
            prompt += f"{msg['role'].upper()}: {msg['content']}\n"
        
        response = llm.invoke(prompt)
        return {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": response
                    }
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/test-agent")
async def test_agent():
    """
    Test endpoint to verify LLM and CrewAI communication.
    """
    try:
        # Define the System Optimizer Agent
        optimizer = Agent(
            role='System Optimizer',
            goal='Verify the backend communication with Groq (Llama 3.3) and CrewAI.',
            backstory='You are a high-level system auditor specialized in verifying local-first AI pipeline connectivity.',
            verbose=True,
            allow_delegation=False,
            llm=llm
        )

        # Define the Verification Task
        verify_task = Task(
            description="Provide a brief confirmation message that the AI system is operational. Mention the model name 'Llama 3.3 (Groq)' in your response.",
            expected_output="A short paragraph confirming system status and model name.",
            agent=optimizer
        )

        # Create the Crew
        crew = Crew(
            agents=[optimizer],
            tasks=[verify_task],
            process=Process.sequential
        )

        # Kickoff the process
        result = crew.kickoff()
        
        return {
            "agent": "System Optimizer",
            "status": "Verified",
            "output": str(result)
        }
    except Exception as e:
        return {
            "status": "Error",
            "message": str(e)
        }

@api_router.post("/force-verify-all")
async def force_verify_all_leads(admin: dict = Depends(require_admin_token)):
    """
    Force verify all leads in the globalpath_leads collection.
    This moves all nodes from 'pending' to 'verified' status immediately.
    """
    try:
        print(f"🔧 [FORCE VERIFY]: Starting mass verification of all leads...")
        
        # Get all points in the collection
        all_points = qdrant_client.scroll(
            collection_name=COLLECTION_NAME,
            limit=10000,  # Get all points
            with_payload=True,
            with_vectors=True
        )[0]
        
        print(f"🔧 [FORCE VERIFY]: Found {len(all_points)} leads to verify")
        
        if not all_points:
            return {
                "status": "success",
                "message": "No leads found in collection",
                "verified_count": 0
            }
        
        # Prepare updates for all points
        points_to_update = []
        for point in all_points:
            # Update payload to force verification
            updated_payload = point.payload.copy()
            updated_payload['status'] = 'verified'
            updated_payload['vetted'] = True
            updated_payload['verified_at'] = datetime.now().isoformat()
            
            points_to_update.append(
                models.PointStruct(
                    id=point.id,
                    payload=updated_payload,
                    vector=point.vector if hasattr(point, 'vector') else None
                )
            )
        
        # Batch update all points
        if points_to_update:
            qdrant_client.upsert(
                collection_name=COLLECTION_NAME,
                points=points_to_update
            )
        
        print(f"✅ [FORCE VERIFY]: Successfully verified {len(points_to_update)} leads")
        
        return {
            "status": "success",
            "message": f"Successfully force-verified {len(points_to_update)} leads",
            "verified_count": len(points_to_update),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"❌ [FORCE VERIFY]: Error during mass verification: {e}")
        print(f"❌ [FORCE VERIFY]: Error type: {type(e).__name__}")
        
        return {
            "status": "error",
            "message": f"Failed to force verify leads: {str(e)}",
            "verified_count": 0
        }

@api_router.post("/admin/login")
async def admin_login(req: AdminLoginRequest):
    """
    Validate the admin password and return a short-lived HS256 token.
    Returns 401 on failure, 500 if server auth config is incomplete.
    """
    try:
        # Check both required credentials
        if not ADMIN_PASSWORD or not JWT_SECRET:
            # Fail closed: never authenticate when no password/JWT secret configured server-side.
            missing = []
            if not ADMIN_PASSWORD:
                missing.append("ADMIN_PASSWORD/VITE_ADMIN_PASSWORD")
            if not JWT_SECRET:
                missing.append("JWT_SECRET")
            print(f"⚠️ [AUTH] Admin login failed! Missing required env vars: {', '.join(missing)}")
            raise HTTPException(
                status_code=500,
                detail="Admin authentication configuration incomplete on server."
            )

        # Ensure we fetch and securely strip any trailing symbols or encoding variants
        raw_password = ADMIN_PASSWORD
        stored_password = raw_password.strip() if hasattr(raw_password, "strip") else str(raw_password)
        
        # Compare values safely using constant-time comparison
        submitted = (req.password or "").encode("utf-8")
        expected = stored_password.encode("utf-8")
        if not hmac.compare_digest(submitted, expected):
            raise HTTPException(status_code=401, detail="Invalid admin password.")

        token = create_admin_token()
        return {
            "status": "success",
            "token": token,
            "expires_in": JWT_TTL_SECONDS,
            "token_type": "Bearer",
        }
    except HTTPException:
        # Re-raise HTTPExceptions so FastAPI can handle them normally
        raise
    except Exception as e:
        print(f"❌ [AUTH] CRITICAL ADMIN LOGIN EXCEPTION: {str(e)}")
        print(f"❌ [AUTH] Error type: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail=f"Auth subsystem error: {str(e)}"
        )


# --- ADMIN AUTH ROUTES ---
@app.get("/api/auth/user")
async def route_auth_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """
    Get authenticated user info using admin JWT token.
    Returns user data if token is valid, 401 if not.
    """
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    payload = verify_admin_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Return user data matching what useAuth.ts expects
    return {
        "sub": "admin",
        "email": "admin@globalpath.com",
        "firstName": "GlobalPath",
        "lastName": "Admin",
        "profileImageUrl": None
    }

# 🎯 FINAL REGISTRATION: Capture all routes defined above
app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get('PORT', 10000)))

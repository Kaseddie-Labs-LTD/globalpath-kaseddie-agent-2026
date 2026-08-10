import os
import json
from bson import ObjectId
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

# Force search for .env in both the repository root and backend folder.
root_env = Path(__file__).resolve().parent / ".env"
backend_env = Path(__file__).resolve().parent / "backend" / ".env"
print(f"Attempting to load .env from root: {root_env}")
load_dotenv(dotenv_path=root_env, override=True)
print(f"Attempting to load .env from backend: {backend_env}")
load_dotenv(dotenv_path=backend_env, override=True)

print("Loading environment configurations...")
print("GEMINI_API_KEY found:", bool(os.getenv("GEMINI_API_KEY") or os.getenv("VITE_APP_GEMINI_API_KEY")))

# Load the MongoDB URI from environment — never hardcode credentials in source.
mongo_uri = os.getenv("MDB_URI")
if not mongo_uri:
    raise SystemExit("MDB_URI not found in environment. Set it in .env (see .env.example).")
client = MongoClient(mongo_uri)
db = client["Sentinel-Memory-Vault"]

print(f"Connected to database: {db.name}")

# Helper to serialize MongoDB objects to clean JSON
def clean_json(doc):
    return {
        "Mongo _id": str(doc.get("_id")),
        "created_at": doc.get("created_at").isoformat() if isinstance(doc.get("created_at"), datetime) else str(doc.get("created_at")),
        "metadata_title": doc.get("metadata", {}).get("title", None) if isinstance(doc.get("metadata"), dict) else None,
        "metadata_location": doc.get("metadata", {}).get("location", None) if isinstance(doc.get("metadata"), dict) else None,
        "summary": (doc.get("text", "")[:100] + "...") if doc.get("text") else "No text field present"
    }

# Fetch the 10 most recent records from the 'documents' collection
try:
    # 1. Print out all collections inside Sentinel-Memory-Vault
    collections = db.list_collection_names()
    print(f"\n📁 Available collections in Sentinel-Memory-Vault: {collections}")
    
    # 2. Check if a different database exists by listing all database names
    all_dbs = client.list_database_names()
    print(f"🗄️ All databases available on this cluster: {all_dbs}\n")

except Exception as e:
    print(f"Error scanning cluster: {e}")

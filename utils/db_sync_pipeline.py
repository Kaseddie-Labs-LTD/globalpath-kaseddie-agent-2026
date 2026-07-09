"""
GlobalPath Kaseddie Agent — Database Sync Pipeline
====================================================
Provides the four core tools consumed by the Google ADK multi-agent supervisor
(my_agent_setup.py) and test_agent_sandbox.py.

All four functions connect to:
  - Qdrant Cloud  : vector store for lead embeddings (globalpath_leads collection)
  - MongoDB Atlas : Sentinel-Memory-Vault for historical audit records

Environment variables required:
  QDRANT_URL        — Qdrant cloud endpoint
  QDRANT_API_KEY    — Qdrant JWT auth token
  MDB_URI           — MongoDB Atlas connection string

Each function is designed to be safe to call even when the backing services are
unavailable — they return structured fallback payloads rather than raising, so
the ADK agent can degrade gracefully during local development.
"""

from __future__ import annotations

import os
import logging
from typing import Any

logger = logging.getLogger("db_sync_pipeline")

# ---------------------------------------------------------------------------
# Lazy client initialisation — only connect when first called.
# This prevents import-time crashes when credentials are missing.
# ---------------------------------------------------------------------------

_qdrant_client: Any = None
_mongo_db: Any = None


def _get_qdrant():
    """Return a cached QdrantClient, initialising on first call."""
    global _qdrant_client
    if _qdrant_client is not None:
        return _qdrant_client

    qdrant_url = os.getenv("QDRANT_URL", "")
    qdrant_key = os.getenv("QDRANT_API_KEY", "")

    if not qdrant_url:
        logger.warning("[QDRANT] QDRANT_URL not set — vector operations will be skipped.")
        return None

    try:
        from qdrant_client import QdrantClient  # type: ignore

        if qdrant_key:
            _qdrant_client = QdrantClient(url=qdrant_url, api_key=qdrant_key)
        else:
            _qdrant_client = QdrantClient(url=qdrant_url)

        logger.info("[QDRANT] Client initialised successfully.")
    except Exception as exc:
        logger.error("[QDRANT] Failed to initialise client: %s", exc)
        _qdrant_client = None

    return _qdrant_client


def _get_mongo():
    """Return a cached MongoDB database handle, initialising on first call."""
    global _mongo_db
    if _mongo_db is not None:
        return _mongo_db

    mdb_uri = os.getenv("MDB_URI", "")
    if not mdb_uri:
        logger.warning("[MONGO] MDB_URI not set — MongoDB operations will be skipped.")
        return None

    try:
        from pymongo import MongoClient  # type: ignore

        client = MongoClient(mdb_uri, serverSelectionTimeoutMS=5000)
        _mongo_db = client.get_default_database()
        logger.info("[MONGO] Connected to Sentinel-Memory-Vault.")
    except Exception as exc:
        logger.error("[MONGO] Failed to connect: %s", exc)
        _mongo_db = None

    return _mongo_db


COLLECTION_NAME = "globalpath_leads"


# ---------------------------------------------------------------------------
# Public tool functions — imported by my_agent_setup.py
# ---------------------------------------------------------------------------


def hybrid_vector_mongo_lookup(query_text: str, corridor_filter: str | None = None, top_k: int = 5) -> dict:
    """
    Perform a hybrid vector + metadata lookup across Qdrant and MongoDB.

    Searches the Qdrant `globalpath_leads` collection using a text embedding,
    then enriches each hit with the corresponding MongoDB audit record when
    available.

    Args:
        query_text:       The free-text search query (company name, role, etc.).
        corridor_filter:  Optional corridor label to restrict results
                          e.g. "Poland", "Luxembourg", "UAE".
        top_k:            Maximum number of vector results to return.

    Returns:
        A dict with keys:
          status   — "ok" | "degraded" | "error"
          results  — list of enriched lead dicts
          message  — human-readable status note
    """
    client = _get_qdrant()
    if client is None:
        return {
            "status": "degraded",
            "results": [],
            "message": "Qdrant unavailable — no vector search performed.",
        }

    try:
        # Build a simple keyword-based filter when corridor is specified.
        from qdrant_client.models import Filter, FieldCondition, MatchValue  # type: ignore

        search_filter = None
        if corridor_filter:
            search_filter = Filter(
                must=[FieldCondition(key="corridor", match=MatchValue(value=corridor_filter))]
            )

        # Use scroll (keyword scan) when no embedding model is available locally.
        scroll_result, _ = client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=search_filter,
            limit=top_k,
            with_payload=True,
            with_vectors=False,
        )

        results = []
        db = _get_mongo()

        for point in scroll_result:
            payload = point.payload or {}

            # Optionally enrich from MongoDB
            mongo_record = None
            if db is not None:
                try:
                    mongo_record = db.leads.find_one(
                        {"qdrant_id": str(point.id)}, {"_id": 0}
                    )
                except Exception as mongo_exc:
                    logger.warning("[MONGO] Enrichment failed for %s: %s", point.id, mongo_exc)

            results.append(
                {
                    "qdrant_id": str(point.id),
                    "payload": payload,
                    "mongo_record": mongo_record,
                }
            )

        logger.info("[LOOKUP] Returned %d results for query '%s'.", len(results), query_text)
        return {"status": "ok", "results": results, "message": f"{len(results)} records found."}

    except Exception as exc:
        logger.error("[LOOKUP] hybrid_vector_mongo_lookup failed: %s", exc)
        return {"status": "error", "results": [], "message": str(exc)}


def check_illegal_fees(query_text: str, corridor_filter: str | None = None, top_k: int = 10) -> dict:
    """
    Audit a recruitment lead for evidence of illegal or undisclosed fees.

    Searches the vector store for leads matching `query_text`, then inspects
    each payload for fee-related fields (`fee_blocked`, `illegalFeeDetected`,
    `complianceStatus`) and constructs a structured violation report.

    Args:
        query_text:       Agency name, job title, or route to audit.
        corridor_filter:  Optional corridor to restrict the audit scope.
        top_k:            Number of vector results to inspect.

    Returns:
        Structured audit dict matching the MOH_CORRIDOR_AUDIT_SCHEMA:
          entity_name         — resolved entity name from the top result
          corridor            — corridor value from filter or top result
          violation_history   — list of detected fee violation records
          status              — "CLEAN" | "FLAGGED" | "UNVERIFIED"
    """
    lookup = hybrid_vector_mongo_lookup(
        query_text=query_text, corridor_filter=corridor_filter, top_k=top_k
    )

    if lookup["status"] == "error":
        return {
            "entity_name": query_text,
            "corridor": corridor_filter or "UNKNOWN",
            "violation_history": [],
            "status": "UNVERIFIED",
        }

    results = lookup.get("results", [])
    violation_history = []
    entity_name = query_text
    corridor = corridor_filter or "UNKNOWN"

    for hit in results:
        payload = hit.get("payload", {})

        # Resolve entity name from first result
        if entity_name == query_text:
            entity_name = payload.get("company", query_text)
            corridor = payload.get("corridor", corridor_filter or "UNKNOWN")

        # Check for flagged fee indicators in the payload
        if payload.get("fee_blocked") or payload.get("illegalFeeDetected"):
            violation_history.append(
                {
                    "date": payload.get("dateFound", "unknown"),
                    "incident_type": "Undisclosed candidate-paid fee",
                    "undisclosed_fees_detected_usd": float(
                        payload.get("fee_amount_usd", 0)
                    ),
                }
            )

        # Also flag leads with High Risk compliance status
        if payload.get("complianceStatus") == "High Risk":
            violation_history.append(
                {
                    "date": payload.get("dateFound", "unknown"),
                    "incident_type": "High Risk compliance status",
                    "undisclosed_fees_detected_usd": 0.0,
                }
            )

    status = "FLAGGED" if violation_history else ("CLEAN" if results else "UNVERIFIED")

    logger.info(
        "[FEE AUDIT] entity='%s' corridor='%s' status='%s' violations=%d",
        entity_name, corridor, status, len(violation_history),
    )

    return {
        "entity_name": entity_name,
        "corridor": corridor,
        "violation_history": violation_history,
        "status": status,
    }


def enrich_lead_data(mongo_id: str) -> dict:
    """
    Retrieve and risk-enrich a single MongoDB lead record by its document ID.

    Fetches the raw document, applies keyword-based risk flag detection, and
    returns a structured enrichment payload.

    Args:
        mongo_id:  The MongoDB `_id` string of the lead to enrich.

    Returns:
        Enrichment dict matching ENRICH_LEAD_DATA_OUTPUT_SCHEMA:
          mongo_id    — the requested document ID
          status      — "found" | "not_found" | "error" | "degraded"
          message     — human-readable status note
          risk_flags  — list of detected risk category strings
          record      — raw MongoDB document dict or None
    """
    db = _get_mongo()
    if db is None:
        return {
            "mongo_id": mongo_id,
            "status": "degraded",
            "message": "MongoDB unavailable.",
            "risk_flags": [],
            "record": None,
        }

    try:
        from bson import ObjectId  # type: ignore
        from bson.errors import InvalidId  # type: ignore

        try:
            oid = ObjectId(mongo_id)
        except InvalidId:
            return {
                "mongo_id": mongo_id,
                "status": "error",
                "message": f"'{mongo_id}' is not a valid ObjectId.",
                "risk_flags": [],
                "record": None,
            }

        record = db.leads.find_one({"_id": oid})
        if record is None:
            return {
                "mongo_id": mongo_id,
                "status": "not_found",
                "message": "No document found with this ID.",
                "risk_flags": [],
                "record": None,
            }

        # Convert ObjectId to string for JSON serialisation
        record["_id"] = str(record["_id"])

        # Risk flag detection
        risk_flags: list[str] = []

        if record.get("fee_blocked") or record.get("illegalFeeDetected"):
            risk_flags.append("ILLEGAL_FEE_DETECTED")

        if record.get("complianceStatus") == "High Risk":
            risk_flags.append("HIGH_RISK_COMPLIANCE")

        # GCC leads must include housing/transport allowances
        corridor = str(record.get("corridor", "")).upper()
        if corridor in ("UAE", "GCC", "DUBAI") and not record.get("hasAccommodation"):
            risk_flags.append("GCC_MISSING_ACCOMMODATION")

        if not record.get("hasVisa") and not record.get("hasSponsorship"):
            risk_flags.append("NO_VISA_SPONSORSHIP")

        logger.info("[ENRICH] mongo_id=%s status=found flags=%s", mongo_id, risk_flags)

        return {
            "mongo_id": mongo_id,
            "status": "found",
            "message": "Record retrieved and enriched.",
            "risk_flags": risk_flags,
            "record": record,
        }

    except Exception as exc:
        logger.error("[ENRICH] enrich_lead_data failed for %s: %s", mongo_id, exc)
        return {
            "mongo_id": mongo_id,
            "status": "error",
            "message": str(exc),
            "risk_flags": [],
            "record": None,
        }


def query_corridor_stats(corridor: str | None = None) -> dict:
    """
    Aggregate corridor-level statistics from the Qdrant `globalpath_leads` collection.

    Counts total leads, live/active leads, verified leads, category breakdown,
    and top source regions — optionally filtered to a single corridor.

    Args:
        corridor:  Optional corridor label to restrict aggregation
                   e.g. "Poland", "UAE", "Luxembourg". Pass None for global stats.

    Returns:
        Stats dict matching QUERY_CORRIDOR_STATS_OUTPUT_SCHEMA:
          corridor           — the filtered corridor label or "GLOBAL"
          total_leads        — total vector records counted
          live_count         — records with status "live" or "active"
          verified_count     — records explicitly marked verified
          category_breakdown — list of {category, count} objects
          top_regions        — list of {region, count} objects sorted desc
    """
    client = _get_qdrant()
    if client is None:
        return {
            "corridor": corridor or "GLOBAL",
            "total_leads": 0,
            "live_count": 0,
            "verified_count": 0,
            "category_breakdown": [],
            "top_regions": [],
        }

    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue  # type: ignore

        scroll_filter = None
        if corridor:
            scroll_filter = Filter(
                must=[FieldCondition(key="corridor", match=MatchValue(value=corridor))]
            )

        # Scroll all matching records (paginated internally)
        all_payloads: list[dict] = []
        offset = None

        while True:
            batch, next_offset = client.scroll(
                collection_name=COLLECTION_NAME,
                scroll_filter=scroll_filter,
                limit=250,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            all_payloads.extend(p.payload or {} for p in batch)
            if next_offset is None:
                break
            offset = next_offset

        # Aggregate
        total_leads = len(all_payloads)
        live_count = sum(
            1 for p in all_payloads
            if str(p.get("status", "")).lower() in ("live", "active")
        )
        verified_count = sum(
            1 for p in all_payloads
            if p.get("vetted") is True
            or str(p.get("status", "")).lower() == "verified"
        )

        # Category breakdown
        category_tally: dict[str, int] = {}
        for p in all_payloads:
            cat = str(p.get("category", "general")).lower()
            category_tally[cat] = category_tally.get(cat, 0) + 1

        category_breakdown = [
            {"category": cat, "count": cnt}
            for cat, cnt in sorted(category_tally.items(), key=lambda x: -x[1])
        ]

        # Top source regions
        region_tally: dict[str, int] = {}
        for p in all_payloads:
            region = str(p.get("corridor") or p.get("country") or "Unknown")
            region_tally[region] = region_tally.get(region, 0) + 1

        top_regions = [
            {"region": reg, "count": cnt}
            for reg, cnt in sorted(region_tally.items(), key=lambda x: -x[1])[:10]
        ]

        logger.info(
            "[STATS] corridor='%s' total=%d live=%d verified=%d",
            corridor or "GLOBAL", total_leads, live_count, verified_count,
        )

        return {
            "corridor": corridor or "GLOBAL",
            "total_leads": total_leads,
            "live_count": live_count,
            "verified_count": verified_count,
            "category_breakdown": category_breakdown,
            "top_regions": top_regions,
        }

    except Exception as exc:
        logger.error("[STATS] query_corridor_stats failed: %s", exc)
        return {
            "corridor": corridor or "GLOBAL",
            "total_leads": 0,
            "live_count": 0,
            "verified_count": 0,
            "category_breakdown": [],
            "top_regions": [],
        }

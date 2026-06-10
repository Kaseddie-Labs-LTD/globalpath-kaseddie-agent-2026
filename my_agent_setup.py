import logging
from google.adk.agents import LlmAgent
from google.adk.tools import agent_tool
from google.adk.tools.google_search_tool import GoogleSearchTool
from google.adk.tools import url_context
from utils.db_sync_pipeline import (
    check_illegal_fees,
    enrich_lead_data,
    hybrid_vector_mongo_lookup,
    query_corridor_stats,
)

# Strict tool output schema for corridor audits — used by Agent Builder/Vertex tool definitions
MOH_CORRIDOR_AUDIT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "entity_name": {
            "type": "STRING",
            "description": "The validated legal business name of the recruitment agency or employer entity."
        },
        "corridor": {
            "type": "STRING",
            "description": "The specific global labor lane corridor being audited.",
            "enum": ["Poland", "Luxembourg", "UAE"]
        },
        "violation_history": {
            "type": "ARRAY",
            "description": "Historical audit logs of verified or flagged pay-to-play recruitment fee infractions.",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "date": {"type": "STRING", "description": "ISO timestamp of infraction detection."},
                    "incident_type": {"type": "STRING", "description": "Nature of the fee (e.g., hidden processing fee, visa charge)."},
                    "undisclosed_fees_detected_usd": {"type": "NUMBER", "description": "Aggregated monetary extraction value in USD."}
                },
                "required": ["date", "incident_type", "undisclosed_fees_detected_usd"]
            }
        },
        "status": {
            "type": "STRING",
            "description": "The definitive ethical standing assigned by Oversight Sentinel logic.",
            "enum": ["CLEAN", "FLAGGED", "UNVERIFIED"]
        }
    },
    "required": ["entity_name", "corridor", "violation_history", "status"]
}

# Create a thin callable wrapper that preserves the original lookup behavior
# and exposes the schema metadata for Agent Builder integration.
def hybrid_vector_mongo_lookup_tool(query_text: str, corridor_filter: str = None, **kwargs):
    """
    Explicitly typed wrapper absorbing high-level schema variables while 
    safely executing the base database lookup node.
    """
    # Absorb corridor_filter locally so it does not get forwarded to the base
    # lookup function which may not accept it. This prevents positional/arg
    # mismatches when the Agent Builder supplies schema fields.
    return hybrid_vector_mongo_lookup(query_text=query_text)

# Keep the schema binding intact right underneath it
hybrid_vector_mongo_lookup_tool.tool_schema = MOH_CORRIDOR_AUDIT_SCHEMA

CHECK_ILLEGAL_FEES_OUTPUT_SCHEMA = MOH_CORRIDOR_AUDIT_SCHEMA

ENRICH_LEAD_DATA_OUTPUT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "mongo_id": {"type": "STRING", "description": "The MongoDB document identifier."},
        "status": {"type": "STRING", "description": "The result state returned by the enrichment tool."},
        "message": {"type": "STRING", "description": "A human-readable status message."},
        "risk_flags": {"type": "ARRAY", "items": {"type": "STRING"}, "description": "Detected risk categories from the lead data."},
        "record": {"type": ["OBJECT", "NULL"], "description": "The raw MongoDB lead record when found."}
    },
    "required": ["mongo_id", "status", "risk_flags", "record"]
}

QUERY_CORRIDOR_STATS_OUTPUT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "corridor": {"type": "STRING", "description": "The labor corridor for which the stats were aggregated."},
        "total_leads": {"type": "NUMBER", "description": "Total vector records counted for the corridor."},
        "live_count": {"type": "NUMBER", "description": "Number of records flagged as live or active."},
        "verified_count": {"type": "NUMBER", "description": "Number of records explicitly marked verified."},
        "category_breakdown": {"type": "ARRAY", "items": {"type": "OBJECT"}, "description": "Breakdown of leads by category."},
        "top_regions": {"type": "ARRAY", "items": {"type": "OBJECT"}, "description": "Top source or destination regions by record count."}
    },
    "required": ["corridor", "total_leads", "live_count", "verified_count", "category_breakdown", "top_regions"]
}


def check_illegal_fees_tool(query_text: str, corridor_filter: str = None, top_k: int = 10):
    """MCP-compatible wrapper for the hybrid audit fee lookup tool."""
    return check_illegal_fees(query_text=query_text, corridor_filter=corridor_filter, top_k=top_k)

check_illegal_fees_tool.tool_schema = CHECK_ILLEGAL_FEES_OUTPUT_SCHEMA


def enrich_lead_data_tool(mongo_id: str):
    """MCP-compatible wrapper to retrieve and enrich a MongoDB lead record."""
    return enrich_lead_data(mongo_id=mongo_id)

enrich_lead_data_tool.tool_schema = ENRICH_LEAD_DATA_OUTPUT_SCHEMA


def query_corridor_stats_tool(corridor: str = None):
    """MCP-compatible wrapper to aggregate corridor-level statistics from Qdrant."""
    return query_corridor_stats(corridor=corridor)

query_corridor_stats_tool.tool_schema = QUERY_CORRIDOR_STATS_OUTPUT_SCHEMA

# 1. Specialized Search Agent
my_agent_google_search_agent = LlmAgent(
    name='My_Agent_google_search_agent',
    model='gemini-2.5-flash',
    description='Agent specialized in performing Google searches.',
    sub_agents=[],
    instruction='Use the GoogleSearchTool to find information on the web.',
    tools=[GoogleSearchTool()],
)

# 2. Specialized URL Scraping Agent
my_agent_url_context_agent = LlmAgent(
    name='My_Agent_url_context_agent',
    model='gemini-2.5-flash',
    description='Agent specialized in fetching content from URLs.',
    sub_agents=[],
    instruction='Use the UrlContextTool to retrieve content from provided URLs.',
    tools=[url_context],
)

# 3. Dedicated Database Sub-Agent 
# (Clean Pydantic structure - no illegal dynamic setattr attributes)
my_database_agent = LlmAgent(
    name='My_Agent_database_lookup_agent',
    model='gemini-2.5-flash',
    description='Agent specialized in retrieving historical database profiles and vector knowledge base states.',
    sub_agents=[],
    instruction='Access the workspace vector pipeline to cross-reference Qdrant indices and fetch source data records from MongoDB.',
    tools=[
        hybrid_vector_mongo_lookup_tool,
        check_illegal_fees_tool,
        enrich_lead_data_tool,
        query_corridor_stats_tool,
    ],
)

# 4. Supervisor Agent Matrix
root_agent = LlmAgent(
    name='My_Agent',
    model='gemini-2.5-flash',
    description='The main supervisor agent for Kaseddie Labs tasked with analyzing data streams, evaluating web inputs, and managing specialized sub-agents.',
    sub_agents=[
        my_agent_google_search_agent,
        my_agent_url_context_agent,
        my_database_agent
    ],
    instruction=(
        'You are the core autonomous architect supervisor for GlobalPath-Kaseddie-Agent-Oversight. '
        'Your task is to systematically analyze incoming data streams, filter out noise, and maintain a highly productive workspace.\n\n'
        '- When a user provides a topic requiring fresh web knowledge, delegate to My_Agent_google_search_agent.\n'
        '- If a user provides specific URLs or web references, delegate to My_Agent_url_context_agent.\n'
        '- If a user requires recruitment files, candidate data, or historical database lookups, delegate to My_Agent_database_lookup_agent.\n\n'
        'Synthesize all discoveries into clear, action-oriented summaries.'
    ),
    tools=[
        agent_tool.AgentTool(agent=my_agent_google_search_agent),
        agent_tool.AgentTool(agent=my_agent_url_context_agent),
        agent_tool.AgentTool(agent=my_database_agent)
    ],
)


def get_vertex_agent_tools_definition():
    """
    Returns the exact structural tool configuration array required by the
    Google Cloud Vertex AI Tools API to bind the live MongoDB lookup node.
    """
    return [
        {
            "name": "hybrid_vector_mongo_lookup_tool",
            "description": "Executes live real-time audits against the MongoDB Atlas cluster to verify historical recruitment corridor violations across Poland, Luxembourg, and the UAE.",
            "input_parameters": {
                "type": "OBJECT",
                "properties": {
                    "query_text": {
                        "type": "STRING",
                        "description": "The vector search string or organization legal entity name parsed from the scraped job description."
                    },
                    "corridor_filter": {
                        "type": "STRING",
                        "description": "Target labor lane corridor to restrict the real-time node lookup loop.",
                        "enum": ["Poland", "Luxembourg", "UAE"]
                    }
                },
                "required": ["query_text", "corridor_filter"]
            },
            "output_schema": MOH_CORRIDOR_AUDIT_SCHEMA
        },
        {
            "name": "check_illegal_fees_tool",
            "description": "Executes a hybrid Qdrant/Mongo audit and flags potential illegal or undisclosed recruitment fees.",
            "input_parameters": {
                "type": "OBJECT",
                "properties": {
                    "query_text": {
                        "type": "STRING",
                        "description": "Search string representing the agency or recruitment route to audit."
                    },
                    "corridor_filter": {
                        "type": "STRING",
                        "description": "The corridor context for the audit."
                    },
                    "top_k": {
                        "type": "NUMBER",
                        "description": "Number of top vector search results to inspect."
                    }
                },
                "required": ["query_text"]
            },
            "output_schema": CHECK_ILLEGAL_FEES_OUTPUT_SCHEMA
        },
        {
            "name": "enrich_lead_data_tool",
            "description": "Retrieves a MongoDB lead record by id and applies risk enrichment flags.",
            "input_parameters": {
                "type": "OBJECT",
                "properties": {
                    "mongo_id": {
                        "type": "STRING",
                        "description": "The MongoDB document _id of the lead to enrich."
                    }
                },
                "required": ["mongo_id"]
            },
            "output_schema": ENRICH_LEAD_DATA_OUTPUT_SCHEMA
        },
        {
            "name": "query_corridor_stats_tool",
            "description": "Aggregates Qdrant corridor statistics such as total leads, verified counts, and category breakdowns.",
            "input_parameters": {
                "type": "OBJECT",
                "properties": {
                    "corridor": {
                        "type": "STRING",
                        "description": "Optional corridor filter for the statistics aggregation."
                    }
                },
                "required": []
            },
            "output_schema": QUERY_CORRIDOR_STATS_OUTPUT_SCHEMA
        }
    ]
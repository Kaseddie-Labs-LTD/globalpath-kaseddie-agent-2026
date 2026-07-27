"""
Unified Corridor Configuration for GlobalPath Kaseddie Agent
Defines all target corridors (GCC Middle East, North America, Europe) with their
respective job boards, sectors, and search parameters.
"""

# ==============================================================
# GCC MIDDLE EAST CORRIDORS (Bayt.com)
# ==============================================================
BAYT_TARGET_CORRIDORS: list[dict] = [
    {
        "rank": 1,
        "slug": "uae",
        "label": "UAE (Federal)",
        "tag": "UAE",
        "corridor_field": "UAE / Middle East",
        "sectors": ["construction", "transport-logistics", "maintenance", "security-guard", "housemaid"],
        "platform": "bayt",
        "platform_url": "https://www.bayt.com"
    },
    {
        "rank": 2,
        "slug": "saudi-arabia",
        "label": "Saudi Arabia",
        "tag": "KSA",
        "corridor_field": "Saudi Arabia / Middle East",
        "sectors": ["construction-building", "drivers-transport", "hospitality-restaurant", "facilities-management", "housemaid"],
        "platform": "bayt",
        "platform_url": "https://www.bayt.com"
    },
    {
        "rank": 3,
        "slug": "dubai",
        "label": "Dubai Hub",
        "tag": "DXB",
        "corridor_field": "Dubai / Middle East",
        "sectors": ["hospitality", "housekeeping", "delivery-drivers", "warehouse-operations", "housemaid"],
        "platform": "bayt",
        "platform_url": "https://www.bayt.com"
    },
    {
        "rank": 4,
        "slug": "qatar",
        "label": "Qatar",
        "tag": "QAT",
        "corridor_field": "Qatar / Middle East",
        "sectors": ["construction", "mechanical-trades", "cleaning-services", "hospitality", "housemaid"],
        "platform": "bayt",
        "platform_url": "https://www.bayt.com"
    },
    {
        "rank": 5,
        "slug": "jordan",
        "label": "Jordan",
        "tag": "JOR",
        "corridor_field": "Jordan / Middle East",
        "sectors": ["manufacturing", "technical-trades", "driving-logistics", "building", "housemaid"],
        "platform": "bayt",
        "platform_url": "https://www.bayt.com"
    },
    {
        "rank": 6,
        "slug": "kuwait",
        "label": "Kuwait",
        "tag": "KWT",
        "corridor_field": "Kuwait / Middle East",
        "sectors": ["oil-gas-field-operations", "construction", "transportation", "hospitality", "housemaid"],
        "platform": "bayt",
        "platform_url": "https://www.bayt.com"
    },
    {
        "rank": 7,
        "slug": "lebanon",
        "label": "Lebanon",
        "tag": "LBN",
        "corridor_field": "Lebanon / Middle East",
        "sectors": ["hospitality", "maintenance", "skilled-trades", "logistics", "housemaid"],
        "platform": "bayt",
        "platform_url": "https://www.bayt.com"
    },
    {
        "rank": 8,
        "slug": "oman",
        "label": "Oman",
        "tag": "OMN",
        "corridor_field": "Oman / Middle East",
        "sectors": ["construction", "transport-logistics", "port-operations", "manufacturing", "housemaid"],
        "platform": "bayt",
        "platform_url": "https://www.bayt.com"
    },
    {
        "rank": 9,
        "slug": "bahrain",
        "label": "Bahrain",
        "tag": "BHR",
        "corridor_field": "Bahrain / Middle East",
        "sectors": ["hospitality", "manufacturing", "construction", "logistics", "housemaid"],
        "platform": "bayt",
        "platform_url": "https://www.bayt.com"
    },
]

# ==============================================================
# WESTERN BLUE-COLLAR CORRIDORS (North America & Europe)
# ==============================================================
WESTERN_BLUE_COLLAR_CORRIDORS: list[dict] = [
    {
        "rank": 10,
        "slug": "canada",
        "label": "Canada",
        "tag": "CAN",
        "corridor_field": "Canada / North America",
        "sectors": [
            "general-farmworkers",
            "long-haul-truck-drivers",
            "hospitality-food-service",
            "warehouse-logistics",
            "light-duty-cleaners"
        ],
        "platform": "jobbank",
        "platform_url": "https://www.jobbank.gc.ca",
        "active": True
    },
    {
        "rank": 11,
        "slug": "usa",
        "label": "United States",
        "tag": "USA",
        "corridor_field": "USA / North America",
        "sectors": [
            "hospitality-hotel-staff",
            "logistics-warehouse",
            "healthcare-support-elderly-care",
            "construction-trades",
            "agricultural-labor"
        ],
        "platform": "indeed",
        "platform_url": "https://www.indeed.com",
        "active": True
    },
    {
        "rank": 12,
        "slug": "europe",
        "label": "Europe Hub",
        "tag": "EUR",
        "corridor_field": "Europe / EU",
        "sectors": [
            "transport-truck-bus-drivers",
            "hospitality-restaurant-staff",
            "technical-vocational-trades",
            "healthcare-nursing-support",
            "agriculture-seasonal-farming"
        ],
        "platform": "eurojobs",
        "platform_url": "https://www.eurojobs.com",
        "active": True
    },
]

# ==============================================================
# EXPANDED REGIONAL CORRIDORS (Granular breakdown for specific regions)
# ==============================================================
EXPANDED_CORRIDORS: list[dict] = [
    {
        "corridor_id": "usa_tech",
        "country": "United States",
        "location": "United States",
        "platforms": ["linkedin", "indeed", "ziprecruiter"],
        "active": True,
        "rank": 13,
        "slug": "usa_tech",
        "label": "USA Tech",
        "tag": "USA-TECH",
        "corridor_field": "USA / North America",
        "sectors": ["technology", "software", "data-science", "engineering"]
    },
    {
        "corridor_id": "canada_tech",
        "country": "Canada",
        "location": "Canada",
        "platforms": ["linkedin", "indeed"],
        "active": True,
        "rank": 14,
        "slug": "canada_tech",
        "label": "Canada Tech",
        "tag": "CAN-TECH",
        "corridor_field": "Canada / North America",
        "sectors": ["technology", "software", "data-science", "engineering"]
    },
    {
        "corridor_id": "europe_uk",
        "country": "United Kingdom",
        "location": "United Kingdom, London",
        "platforms": ["linkedin", "adzuna"],
        "active": True,
        "rank": 15,
        "slug": "europe_uk",
        "label": "Europe UK",
        "tag": "UK",
        "corridor_field": "Europe / EU",
        "sectors": ["technology", "finance", "healthcare", "engineering"]
    },
    {
        "corridor_id": "europe_germany",
        "country": "Germany",
        "location": "Germany, Berlin",
        "platforms": ["linkedin", "stepstone"],
        "active": True,
        "rank": 16,
        "slug": "europe_germany",
        "label": "Europe Germany",
        "tag": "DE",
        "corridor_field": "Europe / EU",
        "sectors": ["technology", "manufacturing", "engineering", "healthcare"]
    }
]

# ==============================================================
# Unified Corridor Registry
# ==============================================================
ALL_CORRIDORS = BAYT_TARGET_CORRIDORS + WESTERN_BLUE_COLLAR_CORRIDORS + EXPANDED_CORRIDORS

CORRIDOR_BY_SLUG: dict[str, dict] = {c["slug"]: c for c in ALL_CORRIDORS}
CORRIDOR_BY_TAG: dict[str, dict] = {c["tag"]: c for c in ALL_CORRIDORS}
CORRIDOR_BY_ID: dict[str, dict] = {c.get("corridor_id", c["slug"]): c for c in ALL_CORRIDORS}

# Platform-specific corridor groupings
BAYT_CORRIDORS = [c for c in ALL_CORRIDORS if c.get("platform") == "bayt"]
WESTERN_CORRIDORS = [c for c in ALL_CORRIDORS if c.get("platform") in ["jobbank", "indeed", "eurojobs"]]
EXPANDED_REGIONAL_CORRIDORS = [c for c in ALL_CORRIDORS if c.get("corridor_id") in ["usa_tech", "canada_tech", "europe_uk", "europe_germany"]]

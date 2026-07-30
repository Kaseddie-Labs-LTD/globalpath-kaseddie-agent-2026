"""
Standalone audit report: fetches ALL leads from a deployed /api/leads endpoint
and produces a sector-distribution report with per-sector job mapping & descriptions.

Usage:
    python scripts/audit_sector_report.py --url https://your-app.onrender.com
    python scripts/audit_sector_report.py --url https://your-app.onrender.com --token YOUR_ADMIN_TOKEN
"""
import argparse
import json
import sys
import urllib.request
import urllib.error
from collections import defaultdict

def fetch_all_leads(base_url: str, token: str = "") -> list[dict]:
    all_leads = []
    offset = 0
    limit = 500

    while True:
        url = f"{base_url.rstrip('/')}/api/leads?limit={limit}&offset={offset}"
        req = urllib.request.Request(url)
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            print(f"HTTP {e.code} at offset {offset}: {e.reason}")
            break
        except Exception as e:
            print(f"Error at offset {offset}: {e}")
            break

        leads = data.get("leads") or data.get("data") or []
        if not leads:
            break

        all_leads.extend(leads)
        if len(leads) < limit:
            break
        offset += limit

    return all_leads


def generate_report(leads: list[dict]) -> dict:
    sectors = defaultdict(list)
    corridors = set()

    for lead in leads:
        cat = (lead.get("category") or lead.get("sector") or "uncategorized").lower()
        sectors[cat].append(lead)
        corr = lead.get("corridor") or lead.get("node") or lead.get("country") or lead.get("location") or "unknown"
        corridors.add(corr)

    total = len(leads)
    corridors_sorted = sorted(corridors)

    # Cross-tab
    cross_tab = {}
    for corr in corridors_sorted:
        cross_tab[corr] = {}
        for cat in sectors:
            cross_tab[corr][cat] = sum(
                1 for l in sectors[cat]
                if (l.get("corridor") or l.get("node") or l.get("country") or l.get("location") or "unknown") == corr
            )

    report = {
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "total_leads": total,
        "corridors_found": list(corridors_sorted),
        "sector_distribution": {},
        "cross_tab": cross_tab,
    }

    for cat, points in sectors.items():
        count = len(points)
        # Corridor breakdown
        corr_counts = defaultdict(int)
        for l in points:
            c = l.get("corridor") or l.get("node") or l.get("country") or l.get("location") or "unknown"
            corr_counts[c] += 1

        # Sample titles & descriptions
        titles = []
        descriptions = []
        for l in points[:15]:
            t = l.get("title") or l.get("name") or ""
            if t:
                titles.append(t)
        for l in points[:5]:
            t = l.get("title") or l.get("name") or "Untitled"
            d = l.get("description") or l.get("interests") or l.get("snippet") or ""
            if d:
                descriptions.append({"title": t, "snippet": d[:300]})

        fee_blocked = sum(
            1 for l in points if l.get("fee_blocked") or l.get("illegal_fee_detected")
        )
        zero_fee = sum(1 for l in points if l.get("zero_fee") or l.get("verified"))

        report["sector_distribution"][cat] = {
            "count": count,
            "percentage": round(count / total * 100, 1) if total else 0,
            "fee_blocked": fee_blocked,
            "zero_fee_compliant": zero_fee,
            "corridor_breakdown": dict(sorted(corr_counts.items(), key=lambda x: -x[1])),
            "sample_titles": titles[:10],
            "sample_descriptions": descriptions,
        }

    return report


def main():
    parser = argparse.ArgumentParser(description="Generate sector audit report from /api/leads")
    parser.add_argument("--url", default="http://localhost:10000", help="Base URL of the deployed app")
    parser.add_argument("--token", default="", help="Admin Bearer token if required")
    parser.add_argument("--output", default="", help="Save report to file")
    args = parser.parse_args()

    print(f"Fetching leads from {args.url}/api/leads ...")
    leads = fetch_all_leads(args.url, args.token)
    print(f"Fetched {len(leads)} leads total\n")

    if not leads:
        print("No leads found. Is the endpoint correct and reachable?")
        sys.exit(1)

    report = generate_report(leads)

    for cat, info in report["sector_distribution"].items():
        print(f"\n{'='*60}")
        print(f"  SECTOR: {cat.upper()}")
        print(f"{'='*60}")
        print(f"  Count:      {info['count']} ({info['percentage']}%)")
        print(f"  Fee Blocked: {info['fee_blocked']}")
        print(f"  Zero-Fee:    {info['zero_fee_compliant']}")
        print(f"  Corridor Breakdown:")
        for corr, c in info["corridor_breakdown"].items():
            bar = "█" * max(1, int(c / max(1, info["count"]) * 40))
            print(f"    {corr:20s}: {c:4d} {bar}")
        print(f"  Sample Titles ({len(info['sample_titles'])}):")
        for t in info["sample_titles"]:
            print(f"    • {t}")
        if info["sample_descriptions"]:
            print(f"  Sample Descriptions:")
            for sd in info["sample_descriptions"]:
                print(f"    [{sd['title']}] {sd['snippet'][:100]}...")

    print(f"\n{'='*60}")
    print(f"  CROSS-TAB: Sector × Corridor")
    print(f"{'='*60}")
    cats = list(report["sector_distribution"].keys())
    header = f"{'Corridor':20s}" + "".join(f"{c:14s}" for c in cats)
    print(header)
    print("-" * len(header))
    for corr in report["corridors_found"]:
        row = f"{corr:20s}"
        for cat in cats:
            v = report["cross_tab"].get(corr, {}).get(cat, 0)
            row += f"{v:<14d}"
        print(row)

    if args.output:
        with open(args.output, "w") as f:
            json.dump(report, f, indent=2, default=str)
        print(f"\nReport saved to {args.output}")


if __name__ == "__main__":
    main()

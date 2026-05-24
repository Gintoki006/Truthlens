"""
Signal 4 — Serper cross-verification (weight: 20% of final score).

Searches Google via the Serper API for the article headline using Gemini to
extract topics, keywords, and subject. Checks results against Supabase `source` table.
"""

import os
import json
import logging
from urllib.parse import urlparse
import httpx
from services.claim_analyzer import analyze_claim

logger = logging.getLogger(__name__)

SERPER_URL = "https://google.serper.dev/search"

# Score mapping: number of corroborating trusted outlets → crosscheck score
_SCORE_MAP = {5: 100, 4: 85, 3: 70, 2: 50, 1: 30, 0: 10}

from services.crosscheck_utils import (
    _extract_domain,
    is_relevant_by_snippet
)

async def crosscheck(headline: str, is_text_only: bool = False) -> dict:
    """
    Cross-verify an article headline via Serper (Google Search).
    """
    SERPER_API_KEY = os.getenv("SERPER_API_KEY")

    if not SERPER_API_KEY or SERPER_API_KEY in ("your-serper-api-key", ""):
        return {
            "crosscheck_score": None,
            "corroborating_sources": [],
            "results_found": 0,
            "serper_available": False,
        }

    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    supabase_client = create_client(url, key)

    # Step 1 — Gemini classifies claim + extracts keywords + subject
    claim_analysis = await analyze_claim(headline)
    topic        = claim_analysis.get("topic", "general")
    keywords     = claim_analysis.get("keywords", [])
    subject      = claim_analysis.get("primary_subject", headline[:60])

    print(f"[CROSSCHECK] topic={topic} | keywords={keywords} | subject={subject}")

    # Fetch ALL trusted domains — paginate to bypass Supabase 1000 row default limit
    all_trusted = []
    page_size = 1000
    offset = 0

    while True:
        response = supabase_client.table("source") \
            .select("domain, trust_score, category, topics") \
            .gte("trust_score", 70) \
            .range(offset, offset + page_size - 1) \
            .execute()
        
        batch = response.data or []
        all_trusted.extend(batch)
        
        print(f"[DEBUG] fetched batch offset={offset} size={len(batch)}")
        
        if len(batch) < page_size:
            break  # last page
        offset += page_size

    print(f"[DEBUG] total fetched: {len(all_trusted)}")
    print(f"[DEBUG] nasa in all_trusted: {any(r['domain'] == 'nasa.gov' for r in all_trusted)}")
    print(f"[DEBUG] reuters in all_trusted: {any(r['domain'] == 'reuters.com' for r in all_trusted)}")

    # Exact topic matches first
    exact_domains = sorted(
        [row for row in all_trusted if topic in (row.get("topics") or [])],
        key=lambda x: int(str(x.get("trust_score") or 0)),  # str() first in case it's already int
        reverse=True
    )
    
    print(f"[DEBUG] exact_domains top 5: {[(r['domain'], r['trust_score']) for r in exact_domains[:5]]}")

    # General fallback — only domains explicitly tagged "general", exclude exact matches
    general_domains = sorted(
        [
            row for row in all_trusted
            if "general" in (row.get("topics") or [])
            and row["domain"] not in {r["domain"] for r in exact_domains}
        ],
        key=lambda x: int(str(x.get("trust_score") or 0)),
        reverse=True
    )

    # Science first, general after — take top 8 total
    combined = (exact_domains + general_domains)[:8]

    # Edge case — nothing at all
    if not combined:
        print(f"[CROSSCHECK] no domains found — falling back to all trusted")
        combined = sorted(
            all_trusted,
            key=lambda x: int(str(x.get("trust_score") or 0)),
            reverse=True
        )[:8]

    site_hints = " OR ".join(f"site:{row['domain']}" for row in combined)
    if site_hints:
        site_hints = f"({site_hints})"

    print(
        f"[CROSSCHECK] exact={len(exact_domains)} '{topic}' domains | "
        f"general={len(general_domains)} fallback domains | "
        f"top 8 -> {[r['domain'] for r in combined]}"
    )
    print(f"[CROSSCHECK] site hints -> {site_hints}")

    # Step 3 — Build Serper query
    keyword_str = " ".join(keywords[:3])  # top 3 keywords keeps query clean
    query = f'"{subject}" {keyword_str} {site_hints}'.strip()

    print(f"[CROSSCHECK] Serper query -> {query}")
    
    if not query.strip():
        return {
            "crosscheck_score": 10,
            "corroborating_sources": [],
            "results_found": 0,
            "serper_available": True,
        }

    try:
        # Step 4 — Run Serper
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                SERPER_URL,
                headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
                json={"q": query[:200], "num": 10}
            )
            resp.raise_for_status()
            
        raw_results = resp.json().get("organic", [])
        print(f"[CROSSCHECK] Serper returned {len(raw_results)} results")

        # Build source lookup from the trusted domains we already fetched
        source_lookup = {row["domain"]: row for row in all_trusted}

        CORROBORATING_CATEGORIES = {"reliable"}

        # Step 5 — Score results using keyword relevance check
        corroborating = []
        seen_domains = set()  # add this before the loop

        for r in raw_results:
            domain = _extract_domain(r.get("link", ""))
            source = source_lookup.get(domain)

            if not source or source.get("category") not in CORROBORATING_CATEGORIES:
                continue

            # Skip if we already counted this domain
            if domain in seen_domains:
                print(f"[CROSSCHECK] ⏭ duplicate domain skipped: {domain}")
                continue

            title   = r.get("title", "")
            snippet = r.get("snippet", "")
            searchable = (title + " " + snippet).lower()

            matches = [kw for kw in keywords if kw.lower() in searchable]

            if not matches and keywords:
                print(f"[CROSSCHECK] ❌ skipped {domain} — keyword mismatch | title='{title[:60]}'")
                continue

            # NEW: Groq Semantic Relevance Check
            groq_result = await is_relevant_by_snippet(headline, title, snippet)
            if not groq_result["relevant"]:
                print(f"[CROSSCHECK] ❌ skipped {domain} — Groq deemed irrelevant | title='{title[:60]}'")
                continue

            stance = groq_result["stance"]
            seen_domains.add(domain)  # mark domain as counted
            corroborating.append({
                "name": source.get("name", domain),
                "domain": domain,
                "url": r.get("link", ""),
                "trust_score": source["trust_score"],
                "stance": stance
            })

            if stance == "debunks":
                print(f"[CROSSCHECK] ⚠️ {domain} DEBUNKS this claim — counting against")
                continue
            elif stance == "supports":
                print(f"[CROSSCHECK] ✅ {domain} SUPPORTS claim | matches={matches}")
            else:
                print(f"[CROSSCHECK] ➡️ {domain} NEUTRAL on claim | matches={matches}")
        # After first pass
        MAX_ROUNDS = 4  # max 4 Serper calls = 4 × 10 = 40 results total
        round_num  = 2
        
        # Keep track of domains we have already searched so we can paginate them
        queried_domains = set([r["domain"] for r in combined])

        while len(corroborating) < 5 and round_num <= MAX_ROUNDS:
            fresh_domains = [
                r for r in (exact_domains + general_domains)
                if r["domain"] not in queried_domains
            ][:12]

            # Mark these fresh domains as queried so the next round moves on
            for r in fresh_domains:
                queried_domains.add(r["domain"])

            if not fresh_domains:
                print(f"[CROSSCHECK] no fresh domains left — stopping at round {round_num}")
                break

            site_hints_next = "(" + " OR ".join(f"site:{r['domain']}" for r in fresh_domains) + ")"
            query_next = f'"{subject}" {keyword_str} {site_hints_next}'.strip()
            print(f"[CROSSCHECK] Round {round_num} -> {len(corroborating)}/5 so far | query -> {query_next}")

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp_next = await client.post(
                        SERPER_URL,
                        headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
                        json={"q": query_next[:200], "num": 10}
                    )
                    resp_next.raise_for_status()

                raw_next = resp_next.json().get("organic", [])
                print(f"[CROSSCHECK] Round {round_num} returned {len(raw_next)} results")

                found_new = False
                for r in raw_next:
                    if len(corroborating) >= 5:
                        break

                    domain = _extract_domain(r.get("link", ""))
                    source = source_lookup.get(domain)

                    if not source or source.get("category") not in CORROBORATING_CATEGORIES:
                        continue
                    if domain in seen_domains:
                        continue

                    title      = r.get("title", "")
                    snippet    = r.get("snippet", "")
                    searchable = (title + " " + snippet).lower()
                    matches    = [kw for kw in keywords if kw.lower() in searchable]

                    if not matches and keywords:
                        continue

                    # NEW: Groq Semantic Relevance Check
                    groq_result = await is_relevant_by_snippet(headline, title, snippet)
                    if not groq_result["relevant"]:
                        print(f"[CROSSCHECK] ❌ skipped {domain} (round {round_num}) — Groq deemed irrelevant | title='{title[:60]}'")
                        continue

                    stance = groq_result["stance"]
                    seen_domains.add(domain)
                    found_new = True
                    corroborating.append({
                        "name": source.get("name", domain),
                        "domain": domain,
                        "url": r.get("link", ""),
                        "trust_score": source["trust_score"],
                        "stance": stance
                    })

                    if stance == "debunks":
                        print(f"[CROSSCHECK] ⚠️ {domain} DEBUNKS this claim (round {round_num})")
                        continue
                    elif stance == "supports":
                        print(f"[CROSSCHECK] ✅ {domain} SUPPORTS claim (round {round_num}) | matches={matches}")
                    else:
                        print(f"[CROSSCHECK] ➡️ {domain} NEUTRAL on claim (round {round_num}) | matches={matches}")

                if not found_new:
                    print(f"[CROSSCHECK] round {round_num} found no new domains — moving to next round")

            except Exception as e:
                print(f"[CROSSCHECK] Round {round_num} error: {e}")
                break

            round_num += 1

        # Final fallback — if still under 5 sources, search without site hints
        if len(corroborating) < 5:
            query_fallback = f'"{subject}" {keyword_str} fact check'.strip()
            print(f"[CROSSCHECK] Fallback round — no site hints | query -> {query_fallback}")

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp_fallback = await client.post(
                        SERPER_URL,
                        headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
                        json={"q": query_fallback[:200], "num": 10}
                    )
                    resp_fallback.raise_for_status()

                raw_fallback = resp_fallback.json().get("organic", [])
                print(f"[CROSSCHECK] Fallback returned {len(raw_fallback)} results")

                for r in raw_fallback:
                    if len(corroborating) >= 5:
                        break

                    domain = _extract_domain(r.get("link", ""))
                    source = source_lookup.get(domain)

                    # In fallback — accept any trusted domain, not just reliable
                    if not source or source.get("trust_score", 0) < 70:
                        continue
                    if domain in seen_domains:
                        continue

                    title      = r.get("title", "")
                    snippet    = r.get("snippet", "")
                    searchable = (title + " " + snippet).lower()
                    matches    = [kw for kw in keywords if kw.lower() in searchable]

                    if not matches and keywords:
                        continue
                    
                    # Groq Semantic Relevance Check
                    groq_result = await is_relevant_by_snippet(headline, title, snippet)
                    if not groq_result["relevant"]:
                        print(f"[CROSSCHECK] ❌ skipped {domain} (fallback) — Groq deemed irrelevant | title='{title[:60]}'")
                        continue

                    stance = groq_result["stance"]
                    seen_domains.add(domain)
                    corroborating.append({
                        "name": source.get("name", domain),
                        "domain": domain,
                        "url": r.get("link", ""),
                        "trust_score": source["trust_score"],
                        "stance": stance
                    })

                    if stance == "debunks":
                        print(f"[CROSSCHECK] ⚠️ {domain} DEBUNKS this claim (fallback)")
                        continue
                    elif stance == "supports":
                        print(f"[CROSSCHECK] ✅ {domain} SUPPORTS claim (fallback) | matches={matches}")
                    else:
                        print(f"[CROSSCHECK] ➡️ {domain} NEUTRAL on claim (fallback) | matches={matches}")

            except Exception as e:
                print(f"[CROSSCHECK] Fallback round error: {e}")

        print(f"[CROSSCHECK] final unique corroborating domains: {len(corroborating)}/5")

        # Score only sources that support or are neutral — not debunking ones
        supporting = [s for s in corroborating if s.get("stance") != "debunks"]
        debunking  = [s for s in corroborating if s.get("stance") == "debunks"]

        count = len(supporting)
        crosscheck_score = _SCORE_MAP.get(min(count, 5), 10)

        # Penalise for debunking sources — each trusted outlet debunking reduces score
        if debunking:
            penalty = min(len(debunking) * 15, 40)  # max -40 penalty
            crosscheck_score = max(crosscheck_score - penalty, 0)
            print(f"[CROSSCHECK] ⚠️ {len(debunking)} debunking sources — penalty -{penalty}")

        print(f"[CROSSCHECK] supporting={len(supporting)} | debunking={len(debunking)} | score={crosscheck_score}")

        return {
            "crosscheck_score": crosscheck_score,
            "corroborating_sources": corroborating,
            "results_found": len(corroborating),
            "serper_available": True,
            "topic": topic,
            "keywords_used": keywords
        }

    except Exception as e:
        print(f"Serper crosscheck error: {e}")
        # On any error, return null so fallback formula is applied
        return {
            "crosscheck_score": None,
            "corroborating_sources": [],
            "results_found": 0,
            "serper_available": False,
        }

"""
Signal 4 — Serper cross-verification (weight: 20% of final score).

Searches Google via the Serper API for the article headline using Gemini to
extract topics, keywords, and subject. Checks results against Supabase `source` table.
"""

import os
from urllib.parse import urlparse
import httpx
from services.claim_analyzer import analyze_claim

SERPER_URL = "https://google.serper.dev/search"

# Score mapping: number of corroborating trusted outlets → crosscheck score
_SCORE_MAP = {5: 100, 4: 85, 3: 70, 2: 50, 1: 30, 0: 10}

_nlp_model = None

def _get_nlp():
    """Lazily load spaCy model."""
    global _nlp_model
    if _nlp_model is None:
        import spacy
        _nlp_model = spacy.load("en_core_web_sm")
    return _nlp_model

# ─── Contradiction Detection ──────────────────────────────────────────────────

def extract_named_entities_from_text(text: str) -> list[str]:
    nlp = _get_nlp()
    doc = nlp(text)
    return [
        ent.text.lower().strip()
        for ent in doc.ents
        if ent.label_ in ("ORG", "GPE", "NORP", "LOC", "PERSON", "PRODUCT", "EVENT")
    ]


def is_same_nationality(ent1: str, ent2: str) -> bool:
    """
    Check if two geographic entities are related 
    (city within a country, demonym of same country etc.)
    Uses simple substring matching on common cases.
    spaCy doesn't resolve this, so we check if one contains the other's root.
    """
    nlp = _get_nlp()
    doc1 = nlp(ent1)
    doc2 = nlp(ent2)
    
    labels1 = {t.ent_type_ for t in doc1}
    labels2 = {t.ent_type_ for t in doc2}
    
    if "GPE" in labels1 and "NORP" in labels2:
        return True
    if "NORP" in labels1 and "GPE" in labels2:
        return True

    return False


def is_contradicted_by_title(claim: str, article_title: str) -> bool:
    nlp = _get_nlp()
    claim_doc = nlp(claim)
    title_doc = nlp(article_title)

    claim_by_label = {}
    for ent in claim_doc.ents:
        if ent.label_ in ("GPE", "NORP", "ORG", "PERSON", "LOC"):
            claim_by_label.setdefault(ent.label_, []).append(ent.text.lower())

    title_by_label = {}
    for ent in title_doc.ents:
        if ent.label_ in ("GPE", "NORP", "ORG", "PERSON", "LOC"):
            title_by_label.setdefault(ent.label_, []).append(ent.text.lower())

    nationality_labels = {"NORP", "GPE"}
    claim_nationality = [
        e for label in nationality_labels
        for e in claim_by_label.get(label, [])
    ]
    title_nationality = [
        e for label in nationality_labels
        for e in title_by_label.get(label, [])
    ]

    if claim_nationality and title_nationality:
        for c_nat in claim_nationality:
            for t_nat in title_nationality:
                if c_nat not in t_nat and t_nat not in c_nat:
                    if not is_same_nationality(c_nat, t_nat):
                        print(
                            f"[CROSSCHECK] ⚠️ CONTRADICTION DETECTED: "
                            f"claim says '{c_nat}' but title mentions '{t_nat}' | title='{article_title}'"
                        )
                        return True

    return False


def _extract_domain(url: str) -> str:
    """Extract the bare domain from a URL (strip common prefixes)."""
    try:
        netloc = urlparse(url).netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        if netloc.startswith("m."):
            netloc = netloc[2:]
        if netloc.startswith("news."):
            netloc = netloc[5:]
        if netloc.startswith("en."):
            netloc = netloc[3:]
        return netloc
    except Exception:
        return ""


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

            if is_contradicted_by_title(headline, title):
                continue

            seen_domains.add(domain)  # mark domain as counted
            corroborating.append({
                "name": source.get("name", domain),
                "domain": domain,
                "url": r.get("link", ""),
                "trust_score": source["trust_score"]
            })
            print(f"[CROSSCHECK] ✅ corroborated by {domain} | matches={matches}")
        # After first pass
        MAX_ROUNDS = 4  # max 4 Serper calls = 4 × 10 = 40 results total
        round_num  = 2

        while len(corroborating) < 5 and round_num <= MAX_ROUNDS:
            fresh_domains = [
                r for r in (exact_domains + general_domains)
                if r["domain"] not in seen_domains
            ][:12]

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
                    if is_contradicted_by_title(headline, title):
                        continue

                    seen_domains.add(domain)
                    found_new = True
                    corroborating.append({
                        "name": source.get("name", domain),
                        "domain": domain,
                        "url": r.get("link", ""),
                        "trust_score": source["trust_score"]
                    })
                    print(f"[CROSSCHECK] ✅ round {round_num} corroborated by {domain} | matches={matches}")

                if not found_new:
                    print(f"[CROSSCHECK] round {round_num} found no new domains — stopping")
                    break

            except Exception as e:
                print(f"[CROSSCHECK] Round {round_num} error: {e}")
                break

            round_num += 1

        print(f"[CROSSCHECK] final unique corroborating domains: {len(corroborating)}/5")

        count = len(corroborating)
        crosscheck_score = _SCORE_MAP.get(min(count, 5), 10)

        return {
            "crosscheck_score": crosscheck_score,
            "corroborating_sources": corroborating,
            "results_found": count,
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

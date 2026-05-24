"""
Signal 4 — Serper cross-verification (weight: 20% of final score).

Searches Google via the Serper API for the article headline, checks the
top 5 results against the Supabase `source` table, and counts how many
come from trusted outlets (trust_score >= 70).

Scoring map:
  5 trusted → 100
  4 trusted → 85
  3 trusted → 70
  2 trusted → 50
  1 trusted → 30
  0 trusted → 10
"""

import os
from urllib.parse import urlparse

import httpx

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

_dynamic_site_hints = None

def _get_dynamic_site_hints() -> str:
    global _dynamic_site_hints
    if _dynamic_site_hints is not None:
        return _dynamic_site_hints

    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            return ""

        supabase = create_client(url, key)
        result = supabase.table("source").select("domain").eq("category", "reliable").gte("trust_score", 85).order("trust_score", desc=True).limit(10).execute()
        
        if result.data:
            domains = [row["domain"] for row in result.data]
            _dynamic_site_hints = " (" + " OR ".join(f"site:{d}" for d in domains) + ")"
            print(f"[STARTUP] Dynamic site hints loaded: {_dynamic_site_hints}")
            return _dynamic_site_hints
    except Exception as e:
        print(f"Error loading dynamic site hints: {e}")

    # Fallback if DB is empty or connection fails
    _dynamic_site_hints = " (site:wikipedia.org OR site:bbc.com OR site:reuters.com OR site:apnews.com OR site:ndtv.com OR site:thehindu.com OR site:npr.org)"
    return _dynamic_site_hints


def _build_search_query(headline: str, is_text_only: bool = False) -> str:
    """
    Build an optimised search query using spaCy NER.
    """
    headline = headline.strip()
    site_hints = _get_dynamic_site_hints()
    
    if not is_text_only and len(headline) <= 120 and not headline.endswith("."):
        return headline[:120] + site_hints
    
    # Text mode — extract key entities instead of sending full sentence
    nlp = _get_nlp()
    doc = nlp(headline)
    
    # Extract named entities
    entities = [
        ent.text for ent in doc.ents
        if ent.label_ in ("ORG", "GPE", "EVENT", "PERSON", "PRODUCT", "DATE", "LOC", "FAC")
    ]
    
    # Extract proper nouns and important nouns that weren't caught by NER
    pos_keywords = [
        token.text for token in doc
        if token.pos_ in ("PROPN", "NOUN") and not token.is_stop 
        and not any(token.text in e for e in entities)
    ]
    
    # Combine entities first, then proper/common nouns
    keywords = entities + pos_keywords
    
    keyword_query = " ".join(keywords[:6])  # cap at 6 terms
    return f"{keyword_query}{site_hints}"


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


def _lookup_sources_batch(domains: list[str]) -> dict:
    """
    Look up multiple domains in the Supabase `source` table in one query.

    Returns:
        dict mapping domain → {trust_score, category, ...}
    """
    from supabase import create_client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    supabase = create_client(url, key)

    # Supabase .in_() filter for batch lookup
    result = supabase.table("source").select("*").in_("domain", domains).execute()

    lookup = {}
    if result.data:
        for row in result.data:
            lookup[row["domain"]] = row
    return lookup


def crosscheck(headline: str, is_text_only: bool = False) -> dict:
    """
    Cross-verify an article headline via Serper (Google Search).

    Args:
        headline: The article headline or primary claim (will be truncated to 120 chars).
        is_text_only: Whether the input is a plain text snippet rather than a URL.

    Returns:
        dict with keys:
          - crosscheck_score (int 0–100)
          - corroborating_sources (list of dicts: [{name, domain, url, trust_score}])
          - results_found (int: number of corroborating trusted outlets)
    """
    api_key = os.getenv("SERPER_API_KEY")

    if not api_key or api_key in ("your-serper-api-key", ""):
        # No Serper key configured — return null-like result so fallback triggers
        return {
            "crosscheck_score": None,
            "corroborating_sources": [],
            "results_found": 0,
            "serper_available": False,
        }

    # Build an optimized search query (extracts keywords for sentence-style claims)
    query = _build_search_query(headline, is_text_only) if headline else ""
    
    print(f"[SERPER QUERY] is_text_only={is_text_only} | query={query}")
    
    if not query.strip():
        return {
            "crosscheck_score": 10,
            "corroborating_sources": [],
            "results_found": 0,
            "serper_available": True,
        }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                SERPER_URL,
                headers={
                    "X-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
                json={"q": query, "num": 5},
            )
            resp.raise_for_status()

        results = resp.json().get("organic", [])
        print(f"[CROSSCHECK] Serper returned {len(results)} results")

        if not results:
            return {
                "crosscheck_score": 10,
                "corroborating_sources": [],
                "results_found": 0,
                "serper_available": True,
            }

        # Extract domains from search results
        result_domains = []
        domain_to_result = {}
        for r in results:
            link = r.get("link", "")
            domain = _extract_domain(link)
            if domain:
                result_domains.append(domain)
                domain_to_result[domain] = r

        # Batch lookup in source table
        source_lookup = _lookup_sources_batch(result_domains) if result_domains else {}

        CORROBORATING_CATEGORIES = {"reliable"}
        NON_CORROBORATING_CATEGORIES = {"fake", "conspiracy", "junksci", "hate", "clickbait"}

        # Find corroborating sources based on category
        corroborating = []
        for r in results:
            link = r.get("link", "")
            domain = _extract_domain(link)
            if not domain:
                continue
                
            source_data = source_lookup.get(domain)
            in_db = source_data is not None
            trust_score = source_data.get("trust_score", "N/A") if source_data else "N/A"
            category = source_data.get("category", "") if source_data else ""
            
            print(f"[CROSSCHECK]   raw={link} | normalized={domain} | in_db={in_db} | score={trust_score} | category={category} | title={r.get('title', '')[:50]}")
            
            if not source_data:
                print(f"[CROSSCHECK] ❌ skipped {domain} — not in DB")
                continue

            if category in CORROBORATING_CATEGORIES:
                corroborating.append({
                    "name": r.get("title", domain),
                    "domain": domain,
                    "url": link,
                    "trust_score": trust_score,
                })
                print(f"[CROSSCHECK] ✅ corroborated by {domain} (category={category})")
            elif category in NON_CORROBORATING_CATEGORIES:
                # Finding the claim exclusively on fake news networks doesn't corroborate it
                print(f"[CROSSCHECK] ❌ skipped {domain} — known untrustworthy category: {category}")
            else:
                # Neutral/unclassified category
                print(f"[CROSSCHECK] ❌ skipped {domain} — category '{category}' is not explicitly reliable")

        count = len(corroborating)
        crosscheck_score = _SCORE_MAP.get(min(count, 5), 10)

        return {
            "crosscheck_score": crosscheck_score,
            "corroborating_sources": corroborating,
            "results_found": count,
            "serper_available": True,
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

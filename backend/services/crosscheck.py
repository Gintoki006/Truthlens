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

# Common stop words to strip from search queries
_STOP_WORDS = {
    "a", "an", "the", "is", "was", "were", "are", "been", "be", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "shall", "may", "might", "can", "that", "this", "these",
    "those", "it", "its", "in", "on", "at", "by", "for", "of", "to",
    "from", "with", "and", "or", "but", "not", "no", "so", "if", "as",
    "about", "which", "who", "whom", "what", "where", "when", "how",
    "very", "also", "just", "than", "then", "into", "over", "after",
    "before", "between", "under", "above", "during", "through", "an",
    "successfully", "completely", "approximately", "actually", "really",
}


def _build_search_query(headline: str) -> str:
    """
    Build an optimised search query from a headline or claim.

    For short text that looks like a headline, use it as-is.
    For longer sentence-style claims (plain text input), extract key
    nouns/proper nouns and build a shorter keyword query.
    """
    headline = headline.strip()

    # If it looks like a real headline (short, no period at end), use as-is
    if len(headline) <= 100 and not headline.endswith("."):
        return headline[:120]

    # Extract meaningful keywords for sentence-style claims
    words = headline.replace(",", " ").replace(".", " ").split()
    keywords = []

    for word in words:
        clean = word.strip("\"'()[]{}!?;:")
        if not clean or clean.lower() in _STOP_WORDS or len(clean) <= 2:
            continue
        keywords.append(clean)

    # Prioritise capitalised words (proper nouns / entities) — put them first
    proper = [w for w in keywords if w[0].isupper()]
    common = [w for w in keywords if not w[0].isupper()]

    # Build query: proper nouns first, then important common words
    query_words = proper + common
    query = " ".join(query_words[:10])  # max 10 keywords

    # Append trusted site hints to force Google to look for high-quality corroboration
    site_hints = " (site:wikipedia.org OR site:bbc.com OR site:reuters.com OR site:apnews.com OR site:npr.org)"
    base_query = query[:120] if query else headline[:120]
    
    return base_query + site_hints


def _extract_domain(url: str) -> str:
    """Extract the bare domain from a URL (strip www. prefix)."""
    try:
        netloc = urlparse(url).netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
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


def crosscheck(headline: str) -> dict:
    """
    Cross-verify an article headline via Serper (Google Search).

    Args:
        headline: The article headline or primary claim (will be truncated to 120 chars).

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
    query = _build_search_query(headline) if headline else ""
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

        # Find corroborating sources (trust_score >= 70)
        corroborating = []
        for domain, source_data in source_lookup.items():
            trust_score = source_data.get("trust_score", 0)
            if trust_score >= 70:
                search_result = domain_to_result.get(domain, {})
                corroborating.append({
                    "name": search_result.get("title", domain),
                    "domain": domain,
                    "url": search_result.get("link", f"https://{domain}"),
                    "trust_score": trust_score,
                })

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

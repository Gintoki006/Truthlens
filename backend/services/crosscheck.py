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


def _extract_query_keywords(text: str) -> list[str]:
    """
    Use spaCy NER + POS to extract the most meaningful search terms.
    Prioritizes named entities, falls back to proper nouns.
    Returns at most 6 terms.
    """
    nlp = _get_nlp()
    doc = nlp(text)

    # Named entities first — most specific
    keywords = [
        ent.text for ent in doc.ents
        if ent.label_ in ("ORG", "GPE", "EVENT", "PERSON", "PRODUCT", "DATE", "LOC", "NORP")
    ]

    # Fallback to proper nouns if NER found nothing
    if not keywords:
        keywords = [
            token.text for token in doc
            if token.pos_ == "PROPN" and not token.is_stop and len(token.text) > 2
        ]

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for k in keywords:
        if k.lower() not in seen:
            seen.add(k.lower())
            unique.append(k)

    return unique[:6]


def _build_search_query(headline: str, is_text_only: bool = False) -> str:
    """
    Build an optimised search query using spaCy NER.
    Always anchor the search with the primary subject in quotes.
    """
    headline = headline.strip()
    site_hints = _get_dynamic_site_hints()
    
    if not is_text_only and len(headline) <= 120 and not headline.endswith("."):
        return headline[:120] + site_hints
    
    keywords = _extract_query_keywords(headline)
    
    # Always put the primary subject first and quoted
    # Primary subject = first ORG/PRODUCT/EVENT/GPE/PERSON/FAC entity found
    nlp = _get_nlp()
    doc = nlp(headline)
    primary_subject = next(
        (ent.text for ent in doc.ents 
         if ent.label_ in ("ORG", "PRODUCT", "EVENT", "GPE", "PERSON", "FAC")),
        None
    )

    if not primary_subject:
        # Fallback — use first proper noun
        primary_subject = next(
            (t.text for t in doc if t.pos_ == "PROPN"), 
            headline[:50]
        )

    # Only the subject — quoted — plus site hints
    # Never include the predicate/modifier (the potentially false part)
    query = f'"{primary_subject}" {site_hints}'
    print(f"[SERPER QUERY] is_text_only={is_text_only} | query={query}")
    return query

# ─── Contradiction Detection ──────────────────────────────────────────────────

def extract_topic_keywords(claim: str) -> list[str]:
    """
    Extract non-entity content words that define what the claim is ABOUT.
    These are the words that should appear in a truly corroborating article.
    Filters out stopwords and the primary subject itself.
    """
    nlp = _get_nlp()
    doc = nlp(claim)
    
    # Get entity texts to exclude (primary subject words)
    entity_words = {token.lower() for ent in doc.ents for token in ent.text.lower().split()}
    
    # Keep meaningful non-entity words — nouns, verbs, adjectives
    topic_words = [
        token.lemma_.lower() for token in doc
        if not token.is_stop
        and not token.is_punct
        and token.pos_ in ("NOUN", "VERB", "ADJ")
        and token.lower_ not in entity_words
        and len(token.text) > 3
    ]
    
    print(f"[CROSSCHECK] Topic keywords: {topic_words}")
    return topic_words


def is_topically_relevant(claim: str, article_title: str, article_snippet: str = "") -> bool:
    """
    Check if an article is actually about the claim's topic,
    not just about the primary subject in a different context.
    
    Requires at least 1 topic keyword to appear in title or snippet.
    """
    topic_keywords = extract_topic_keywords(claim)
    
    if not topic_keywords:
        return True  # can't determine — give benefit of doubt
    
    searchable_text = (article_title + " " + article_snippet).lower()
    
    matches = [kw for kw in topic_keywords if kw in searchable_text]
    
    print(
        f"[CROSSCHECK] Relevance check: matches={matches} | "
        f"title='{article_title[:60]}'"
    )
    
    # At least 1 topic keyword must appear
    return len(matches) > 0


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
    
    # If one is a NORP (nationality adjective like "Japanese") and 
    # the other is a GPE (place), they might refer to the same country.
    # Only flag contradiction if BOTH are countries/nationalities,
    # not if one is a city.
    if "GPE" in labels1 and "NORP" in labels2:
        return True   # likely same country expressed differently
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
                # Check if this reliable article's title contradicts the claim
                title = r.get("title", "")
                snippet = r.get("snippet", "")
                
                # Check topical relevance BEFORE counting as corroboration
                if not is_topically_relevant(headline, title, snippet):
                    print(
                        f"[CROSSCHECK] ❌ skipped {domain} — article not about this claim | "
                        f"title='{title[:60]}'"
                    )
                    continue
                    
                if is_contradicted_by_title(headline, title):
                    print(f"[CROSSCHECK] ⚠️ skipped {domain} — title contradicts claim | title='{title}'")
                    continue

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

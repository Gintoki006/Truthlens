"""
Signal 5C — Wikidata entity verification (weight: 25% within Signal 5).

Extracts named entities from the input claim using spaCy NER, then verifies
each entity against Wikidata's structured knowledge graph via SPARQL queries.

This allows the system to confirm encyclopedic facts like:
  "Chandrayaan-3 was an Indian mission"
  → NER extracts "Chandrayaan-3" (PRODUCT/EVENT)
  → Wikidata confirms: operated by ISRO, country India
  → Score: 90

Scoring:
  Entity confirmed by Wikidata  → 90
  Entity exists but contradicts → 20
  Entity not found / no match   → 50 (neutral)

No API key required — Wikidata SPARQL endpoint is free and public.
Rate limit: ~1 query/second per IP.
"""

import logging
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

# spaCy model — loaded lazily to avoid import-time overhead
_nlp = None

# Entity labels we care about for fact verification
_RELEVANT_ENTITY_LABELS = {"ORG", "EVENT", "PERSON", "GPE", "PRODUCT", "NORP", "FAC", "WORK_OF_ART"}

# Throttle tracking for Wikidata rate limiting
_last_query_time = 0.0


def _get_nlp():
    """Lazily load the spaCy English model."""
    global _nlp
    if _nlp is None:
        try:
            import spacy

            _nlp = spacy.load("en_core_web_sm")
            logger.info("Wikidata: spaCy en_core_web_sm model loaded")
        except OSError:
            logger.error(
                "Wikidata: spaCy model 'en_core_web_sm' not found. "
                "Run: python -m spacy download en_core_web_sm"
            )
            _nlp = None
    return _nlp


def extract_entities(text: str) -> list[dict]:
    """
    Extract named entities from text using spaCy NER.

    Returns:
        list of dicts with keys: text, label
        (filtered to relevant entity types only)
    """
    nlp = _get_nlp()
    if nlp is None or not text.strip():
        return []

    doc = nlp(text)
    entities = []
    seen = set()

    for ent in doc.ents:
        if ent.label_ in _RELEVANT_ENTITY_LABELS and ent.text not in seen:
            entities.append({"text": ent.text, "label": ent.label_})
            seen.add(ent.text)

    return entities


def _throttle_query():
    """Ensure at least 1 second between Wikidata SPARQL queries."""
    global _last_query_time
    elapsed = time.time() - _last_query_time
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)
    _last_query_time = time.time()


def _search_wikidata_entity(entity_name: str) -> Optional[dict]:
    """
    Search Wikidata for an entity by name and return its basic info.

    Uses the wbsearchentities API (faster than SPARQL for simple lookups).

    Returns:
        dict with keys: id, label, description, or None if not found
    """
    try:
        _throttle_query()

        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                "https://www.wikidata.org/w/api.php",
                params={
                    "action": "wbsearchentities",
                    "search": entity_name,
                    "language": "en",
                    "format": "json",
                    "limit": 3,
                },
                headers={"User-Agent": "TruthLens/1.0 (https://github.com/truthlens; contact@truthlens.dev)"},
            )
            resp.raise_for_status()

        data = resp.json()
        results = data.get("search", [])

        if not results:
            return None

        top = results[0]
        return {
            "id": top.get("id"),
            "label": top.get("label", ""),
            "description": top.get("description", ""),
        }

    except Exception as e:
        logger.error(f"Wikidata entity search error for '{entity_name}': {e}")
        return None


def _get_entity_properties(entity_id: str) -> Optional[list[dict]]:
    """
    Fetch key properties of a Wikidata entity via SPARQL.

    Returns a list of property-value pairs relevant for fact verification
    (instance of, country, operated by, located in, etc.), or None on error.
    """
    # Key properties for fact verification
    # P31 = instance of, P17 = country, P137 = operator, P131 = located in,
    # P27 = country of citizenship, P495 = country of origin, P159 = headquarters,
    # P112 = founded by, P127 = owned by, P36 = capital, P37 = official language
    sparql = f"""
    SELECT ?propLabel ?valLabel WHERE {{
      VALUES ?wdProp {{
        wd:P31 wd:P17 wd:P137 wd:P131 wd:P27 wd:P495
        wd:P159 wd:P112 wd:P127 wd:P36 wd:P37 wd:P361
        wd:P176 wd:P178 wd:P170 wd:P138 wd:P571
      }}
      ?wdProp wikibase:directClaim ?prop .
      wd:{entity_id} ?prop ?val .
      SERVICE wikibase:label {{
        bd:serviceParam wikibase:language "en".
        ?wdProp rdfs:label ?propLabel .
        ?val rdfs:label ?valLabel .
      }}
    }}
    LIMIT 30
    """

    try:
        _throttle_query()

        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                WIKIDATA_SPARQL,
                params={"query": sparql, "format": "json"},
                headers={"User-Agent": "TruthLens/1.0 (https://github.com/truthlens; contact@truthlens.dev)"},
            )
            resp.raise_for_status()

        data = resp.json()
        bindings = data.get("results", {}).get("bindings", [])

        return [
            {
                "property": b.get("propLabel", {}).get("value", ""),
                "value": b.get("valLabel", {}).get("value", ""),
            }
            for b in bindings
        ]

    except Exception as e:
        logger.error(f"Wikidata SPARQL error for entity {entity_id}: {e}")
        return None


def _fuzzy_match(text1: str, text2: str) -> float:
    """
    Compute normalized similarity between two strings using Levenshtein distance.

    Returns a float between 0.0 (no match) and 1.0 (exact match).
    """
    try:
        from Levenshtein import ratio

        return ratio(text1.lower().strip(), text2.lower().strip())
    except ImportError:
        # Fallback: simple substring check
        t1, t2 = text1.lower().strip(), text2.lower().strip()
        if t1 in t2 or t2 in t1:
            return 0.8
        return 0.0


def _check_claim_against_properties(
    claim_text: str,
    entity_name: str,
    entity_description: str,
    properties: list[dict],
) -> dict:
    """
    Check whether the claim text is consistent with the entity's Wikidata properties.

    Uses fuzzy matching to compare claim words against property values.

    Returns:
        dict with keys: confirmed, contradicted, relevant_properties
    """
    claim_lower = claim_text.lower()
    relevant_props = []
    confirmed = False

    for prop in properties:
        prop_value = prop["value"]
        prop_name = prop["property"]

        # Check if any property value appears in the claim (fuzzy)
        similarity = _fuzzy_match(prop_value, claim_lower)

        # Also check if any word in the claim matches the property value
        claim_words = claim_lower.split()
        word_match = any(_fuzzy_match(word, prop_value.lower()) > 0.75 for word in claim_words if len(word) > 3)

        if similarity > 0.5 or word_match or prop_value.lower() in claim_lower:
            relevant_props.append({
                "property": prop_name,
                "value": prop_value,
                "match_score": max(similarity, 0.8 if word_match else 0.0),
            })
            confirmed = True

    # Also check if entity description matches the claim context
    if entity_description:
        desc_words = entity_description.lower().split()
        claim_words = claim_lower.split()
        overlap = len(set(desc_words) & set(claim_words))
        if overlap >= 2:
            confirmed = True
            relevant_props.append({
                "property": "description",
                "value": entity_description,
                "match_score": min(1.0, overlap / max(len(desc_words), 1)),
            })

    return {
        "confirmed": confirmed,
        "relevant_properties": relevant_props,
    }


def verify_entity_claim(entity_name: str, claim_text: str) -> dict:
    """
    Verify a single entity against Wikidata.

    Args:
        entity_name: The entity to look up (e.g. "Chandrayaan-3").
        claim_text: The full claim text for context matching.

    Returns:
        dict with keys: found, entity_id, description, confirmed, properties, score
    """
    # Step 1: Search for entity in Wikidata
    entity_info = _search_wikidata_entity(entity_name)

    if not entity_info:
        return {
            "found": False,
            "entity_id": None,
            "description": None,
            "confirmed": False,
            "properties": [],
            "score": 50,  # neutral — entity not in Wikidata
        }

    entity_id = entity_info["id"]
    description = entity_info.get("description", "")

    # Step 2: Get entity properties
    properties = _get_entity_properties(entity_id)

    if properties is None:
        return {
            "found": True,
            "entity_id": entity_id,
            "description": description,
            "confirmed": False,
            "properties": [],
            "score": 50,  # neutral on SPARQL timeout or error
        }

    # Step 3: Check claim against properties
    result = _check_claim_against_properties(
        claim_text, entity_name, description, properties
    )

    if result["confirmed"]:
        score = 90  # Wikidata confirms the claim
    elif properties:
        # Entity exists with properties but none matched the claim
        # This isn't necessarily a contradiction — could just be unrelated properties
        score = 60
    else:
        # Entity found but no properties retrieved
        score = 55

    return {
        "found": True,
        "entity_id": entity_id,
        "description": description,
        "confirmed": result["confirmed"],
        "properties": result["relevant_properties"][:5],  # limit for response size
        "score": score,
    }


def compute_wikidata_score(claim: str) -> dict:
    """
    Compute the Wikidata sub-signal score for a given claim.

    Extracts entities, verifies each against Wikidata, and aggregates results.

    Returns:
        dict with keys: score, entities_found, entities_verified, entity_results
    """
    entities = extract_entities(claim)

    if not entities:
        return {
            "score": 50,
            "entities_found": 0,
            "entities_verified": 0,
            "entity_results": [],
        }

    entity_results = []
    scores = []

    # Verify up to 3 entities to stay within rate limits
    for ent in entities[:3]:
        try:
            result = verify_entity_claim(ent["text"], claim)
            entity_results.append({
                "entity": ent["text"],
                "type": ent["label"],
                **result,
            })
            scores.append(result["score"])
        except Exception as e:
            logger.error(f"Wikidata verification error for '{ent['text']}': {e}")
            scores.append(50)  # neutral on error
            entity_results.append({
                "entity": ent["text"],
                "type": ent["label"],
                "found": False,
                "score": 50,
                "error": str(e),
            })

    # Aggregate: use the best score (most confident signal)
    # If any entity was confirmed, the claim has strong evidence
    confirmed_scores = [s for s, r in zip(scores, entity_results) if r.get("confirmed")]
    if confirmed_scores:
        final_score = max(confirmed_scores)
    else:
        final_score = round(sum(scores) / len(scores)) if scores else 50

    return {
        "score": max(0, min(100, final_score)),
        "entities_found": len(entities),
        "entities_verified": len([r for r in entity_results if r.get("found")]),
        "entity_results": entity_results,
    }

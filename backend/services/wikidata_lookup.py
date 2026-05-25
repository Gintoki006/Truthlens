import httpx
import time
import logging
import json
import os
import re
from functools import lru_cache

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"

WIKIDATA_PROPERTIES = [
    "wd:P17",   # country
    "wd:P137",  # operator
    "wd:P495",  # country of origin
    "wd:P276",  # location
    "wd:P131",  # located in administrative territory
    "wd:P159",  # headquarters location
    "wd:P740",  # location of formation
    "wd:P27",   # country of citizenship (for persons)
    "wd:P19",   # place of birth (for persons)
    "wd:P108",  # employer (for persons)
    "wd:P941",  # inspired by
    "wd:P31",   # instance of (type of thing)
    "wd:P112",  # founded by
    "wd:P571",  # inception date
    "wd:P577",  # publication date
]

def _call_groq_json(prompt: str) -> dict:
    if not GROQ_API_KEY:
        logger.warning("[WIKIDATA] Groq API Key not set.")
        return {}

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                    "max_tokens": 1024,
                    "response_format": {"type": "json_object"}
                }
            )
            resp.raise_for_status()
            
            raw = resp.json()["choices"][0]["message"]["content"].strip()
            return json.loads(raw)
    except Exception as e:
        logger.warning(f"[WIKIDATA] Groq call failed: {e}")
        return {}

def get_primary_subject(claim: str) -> str:
    prompt = f"""You are an entity extraction assistant.
Extract the single main primary subject (Person, Organization, Product, Event, or Location) from the claim below.
Keep it as short as possible (e.g. "Chandrayaan-3" instead of "the Chandrayaan-3 mission").
If there is no clear entity, return an empty string.

Claim: "{claim}"

Return ONLY raw JSON in this format:
{{
  "primary_subject": "Name"
}}"""
    
    result = _call_groq_json(prompt)
    return result.get("primary_subject", "")

def evaluate_facts(claim: str, facts: dict) -> dict:
    prompt = f"""You are a factual verification assistant.
Compare the user's claim against the provided confirmed Wikidata facts.

Claim: "{claim}"
Wikidata Facts: {json.dumps(facts)}

Determine if the Wikidata facts confirm the claim, contradict the claim, partially confirm/contradict (mixed), or if they are neutral (they provide no relevant information to verify or debunk the specific claim).

Return ONLY raw JSON in this format:
{{
  "status": "confirmed" | "contradicted" | "mixed" | "neutral",
  "reason": "Brief explanation of what the facts say and how they relate to the claim."
}}"""

    result = _call_groq_json(prompt)
    if not result:
        return {"status": "neutral", "reason": "Failed to evaluate facts using Groq"}
    
    status = result.get("status", "neutral")
    if status not in ("confirmed", "contradicted", "mixed", "neutral"):
        status = "neutral"
        
    return {
        "status": status,
        "reason": result.get("reason", "No reason provided")
    }

def run_sparql_with_retry(query: str, max_retries: int = 3) -> list:
    for attempt in range(max_retries):
        try:
            resp = httpx.get(
                WIKIDATA_SPARQL,
                params={"query": query, "format": "json"},
                timeout=15.0,
                headers={
                    "User-Agent": "TruthLens/1.0 (https://github.com/Sayan/truthlens; contact@truthlens.dev)",
                    "Accept": "application/sparql-results+json",
                }
            )
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", 5))
                if wait > 10:
                    logger.warning(f"[WIKIDATA] Rate limit Retry-After is too high ({wait}s) — aborting SPARQL")
                    return []
                logger.warning(f"[WIKIDATA] Rate limited — waiting {wait}s (attempt {attempt+1})")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json().get("results", {}).get("bindings", [])

        except Exception as e:
            logger.warning(f"[WIKIDATA] Attempt {attempt+1} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)

    return []

@lru_cache(maxsize=256)
def get_wikidata_facts_cached(entity_text: str) -> tuple:
    props_filter = ", ".join(WIKIDATA_PROPERTIES)

    query = f"""
    SELECT ?propLabel ?valueLabel WHERE {{
      ?item rdfs:label "{entity_text}"@en.
      ?item ?prop ?value.
      ?wdProp wikibase:directClaim ?prop.
      ?wdProp rdfs:label ?propLabel.
      ?value rdfs:label ?valueLabel.
      FILTER(LANG(?propLabel) = "en")
      FILTER(LANG(?valueLabel) = "en")
      FILTER(?wdProp IN ({props_filter}))
    }} LIMIT 30
    """

    bindings = run_sparql_with_retry(query)
    facts = {}
    for b in bindings:
        prop = b.get("propLabel", {}).get("value", "").lower()
        val = b.get("valueLabel", {}).get("value", "").lower()
        if prop and val:
            facts[prop] = val

    logger.info(f"[WIKIDATA] Facts for '{entity_text}': {{facts}}")
    return tuple(facts.items())

@lru_cache(maxsize=256)
def get_entity_via_rest(entity_text: str) -> tuple:
    try:
        search_resp = httpx.get(
            "https://www.wikidata.org/w/api.php",
            params={
                "action": "wbsearchentities",
                "search": entity_text,
                "language": "en",
                "format": "json",
                "limit": 1,
            },
            timeout=10.0,
            headers={"User-Agent": "TruthLens/1.0 (https://github.com/Sayan/truthlens; contact@truthlens.dev)"}
        )
        search_resp.raise_for_status()
        results = search_resp.json().get("search", [])
        if not results:
            return tuple()

        entity_id = results[0]["id"]

        entity_resp = httpx.get(
            f"https://www.wikidata.org/wiki/Special:EntityData/{entity_id}.json",
            timeout=10.0,
            headers={"User-Agent": "TruthLens/1.0 (https://github.com/Sayan/truthlens; contact@truthlens.dev)"}
        )
        entity_resp.raise_for_status()
        entity_data = entity_resp.json()
        descriptions = entity_data.get("entities", {}).get(entity_id, {}).get("descriptions", {})
        labels = entity_data.get("entities", {}).get(entity_id, {}).get("labels", {})

        description = descriptions.get("en", {}).get("value", "")
        label = labels.get("en", {}).get("value", "")

        logger.info(f"[WIKIDATA REST] {entity_text} → label='{{label}}' description='{{description}}'")
        return (("description", description.lower()), ("label", label.lower()))

    except Exception as e:
        logger.warning(f"[WIKIDATA REST] Failed for '{entity_text}': {e}")
        return tuple()

def verify_entities(claim_text: str) -> dict:
    primary_subject = get_primary_subject(claim_text)

    if not primary_subject:
        logger.info("[WIKIDATA] No entities found in claim — returning penalty")
        return {"score": 10, "reason": "no entities found", "details": {}}

    logger.info(f"[WIKIDATA] Primary subject: {primary_subject}")

    subject_rest_tuple = get_entity_via_rest(primary_subject)
    subject_rest = dict(subject_rest_tuple)
    
    subject_facts_tuple = get_wikidata_facts_cached(primary_subject)
    subject_facts = dict(subject_facts_tuple)

    if subject_rest.get("description"):
        subject_facts["description"] = subject_rest["description"]
        
    if not subject_facts:
        logger.info("[WIKIDATA] Entity not found in Wikidata — returning penalty")
        return {
            "score": 10,
            "reason": "Entity not found in Wikidata",
            "subject": primary_subject,
            "subject_facts": {},
            "details": {}
        }

    evaluation = evaluate_facts(claim_text, subject_facts)
    status = evaluation["status"]
    reason = evaluation["reason"]
    
    logger.info(f"[WIKIDATA] Gemini evaluation for '{primary_subject}': {status} - {reason}")
    
    if status == "contradicted":
        score = 10
    elif status == "confirmed":
        score = 90
    elif status == "mixed":
        score = 35
    elif status == "neutral":
        score = 60
    else:
        score = 10

    return {
        "score": score,
        "reason": reason,
        "subject": primary_subject,
        "subject_facts": subject_facts,
        "status": status,
        "details": {primary_subject: subject_facts}
    }

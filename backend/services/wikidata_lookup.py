import httpx
import time
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)

_nlp = None

def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            logger.error("spaCy model 'en_core_web_sm' not found.")
            _nlp = None
    return _nlp

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


def extract_claim_entities(text: str) -> list[dict]:
    nlp_model = _get_nlp()
    if not nlp_model:
        return []

    doc = nlp_model(text)
    entities = []
    seen = set()

    for ent in doc.ents:
        normalized = ent.text.lower().strip()
        if normalized in seen:
            continue
        seen.add(normalized)

        if ent.label_ in ("ORG", "GPE", "NORP", "LOC", "PERSON", "PRODUCT", "EVENT", "FAC"):
            entities.append({
                "text": ent.text,
                "normalized": normalized,
                "label": ent.label_
            })

    logger.info(f"[WIKIDATA] Extracted entities from claim: {entities}")
    return entities


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

    logger.info(f"[WIKIDATA] Facts for '{entity_text}': {facts}")
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

        logger.info(f"[WIKIDATA REST] {entity_text} → label='{label}' description='{description}'")
        return (("description", description.lower()), ("label", label.lower()))

    except Exception as e:
        logger.warning(f"[WIKIDATA REST] Failed for '{entity_text}': {e}")
        return tuple()


def check_entity_against_facts(claim_entity: dict, subject_facts: dict) -> str:
    claim_norm = claim_entity["normalized"]
    wikidata_values = " ".join(subject_facts.values())

    if not subject_facts:
        return "neutral"

    if claim_norm in wikidata_values:
        return "confirmed"

    nlp_model = _get_nlp()
    if not nlp_model:
        return "neutral"
        
    wikidata_doc = nlp_model(wikidata_values)
    wikidata_named_entities = [
        ent.text.lower() for ent in wikidata_doc.ents
        if ent.label_ in ("GPE", "ORG", "NORP", "LOC", "PERSON", "PRODUCT")
    ]

    if wikidata_named_entities and claim_norm not in wikidata_named_entities:
        if claim_entity["label"] in ("GPE", "NORP", "ORG", "LOC", "PERSON"):
            logger.info(
                f"[WIKIDATA] CONTRADICTION: claim='{claim_norm}' "
                f"but Wikidata has {wikidata_named_entities}"
            )
            return "contradicted"

    return "neutral"


def verify_entities(claim_text: str) -> dict:
    claim_entities = extract_claim_entities(claim_text)

    if not claim_entities:
        logger.info("[WIKIDATA] No entities found in claim — returning neutral")
        return {"score": 50, "reason": "no entities found", "details": {}}

    all_confirmations = []
    all_contradictions = []
    entity_facts_map = {}

    subject_priority = ["ORG", "PRODUCT", "EVENT", "PERSON", "GPE", "LOC"]
    subject_entity = None
    for label in subject_priority:
        subject_entity = next((e for e in claim_entities if e["label"] == label), None)
        if subject_entity:
            break
    if not subject_entity:
        subject_entity = claim_entities[0]

    logger.info(f"[WIKIDATA] Primary subject: {subject_entity}")

    subject_rest_tuple = get_entity_via_rest(subject_entity["text"])
    subject_rest = dict(subject_rest_tuple)
    
    subject_facts_tuple = get_wikidata_facts_cached(subject_entity["text"])
    subject_facts = dict(subject_facts_tuple)

    # Combine REST description into subject_facts so check_entity_against_facts can check it
    if subject_rest.get("description"):
        subject_facts["description"] = subject_rest["description"]
        
    entity_facts_map[subject_entity["text"]] = subject_facts

    other_entities = [e for e in claim_entities if e["text"] != subject_entity["text"]]

    for ent in other_entities:
        result = check_entity_against_facts(ent, subject_facts)
        logger.info(f"[WIKIDATA] '{ent['text']}' ({ent['label']}) → {result}")

        if result == "confirmed":
            all_confirmations.append(ent["text"])
        elif result == "contradicted":
            all_contradictions.append(ent["text"])

    if all_contradictions and not all_confirmations:
        score = 10
        reason = f"Wikidata contradicts: {all_contradictions}"
    elif all_confirmations and not all_contradictions:
        score = 90
        reason = f"Wikidata confirms: {all_confirmations}"
    elif all_confirmations and all_contradictions:
        score = 35
        reason = f"Mixed: confirmed {all_confirmations}, contradicted {all_contradictions}"
    elif not other_entities:
        if subject_facts:
            score = 60
            reason = f"Entity '{subject_entity['text']}' found in Wikidata, no predicates to verify"
        else:
            score = 50
            reason = "Entity not found in Wikidata"
    else:
        score = 50
        reason = "No overlap found — neutral"

    return {
        "score": score,
        "reason": reason,
        "subject": subject_entity["text"],
        "subject_facts": subject_facts,
        "confirmations": all_confirmations,
        "contradictions": all_contradictions,
        "details": entity_facts_map,
        "entity_results": [
            {"entity": e, "confirmed": True} for e in all_confirmations
        ] + [
            {"entity": e, "confirmed": False} for e in all_contradictions
        ]
    }

# backend/services/claim_analyzer.py

import httpx
import json
import re
import os
import logging

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

TOPIC_CATEGORIES = [
    "politics", "health", "science", "technology", "finance",
    "sports", "entertainment", "crime", "environment", "religion", "general"
]

async def analyze_claim(claim: str) -> dict:
    prompt = f"""You are a fact-checking assistant. Analyze this news claim.

Claim: "{claim}"

Instructions:
- topic: classify into exactly one of: politics, health, science, technology, finance, sports, entertainment, crime, environment, religion, general
- keywords: 3-6 important words that describe WHAT and WHERE the claim is about.
  Rules:
  * INCLUDE nationality/country words (Indian, American, Chinese, Russian etc.)
  * INCLUDE location words (moon, south pole, Mars, ocean etc.)
  * INCLUDE action/result words (landing, launch, crash, discover, win etc.)
  * EXCLUDE the primary subject's own name
  * EXCLUDE generic verbs like admit, say, claim, announce, confirm
- primary_subject: shortest possible name of the main entity
  * "Chandrayaan-3" not "Chandrayaan 3 was an Indian mission"
  * "Bill Gates" not "Bill Gates admitted something"
  * "PM Modi" not "Prime Minister Narendra Modi said"

Examples:

Claim: "Chandrayaan-3 successfully landed on Moon's south pole"
Output: {{"topic": "science", "keywords": ["Indian", "lunar", "landing", "moon", "south", "pole"], "primary_subject": "Chandrayaan-3"}}

Claim: "Bill Gates admitted COVID-19 vaccines contain microchips to track citizens"
Output: {{"topic": "health", "keywords": ["vaccine", "microchip", "covid", "tracking", "citizens"], "primary_subject": "Bill Gates"}}

Claim: "Virat Kohli becomes the highest run scorer in IPL history"
Output: {{"topic": "sports", "keywords": ["cricket", "IPL", "run", "scorer", "record"], "primary_subject": "Virat Kohli"}}

Claim: "NASA discovered water ice on Mars surface"
Output: {{"topic": "science", "keywords": ["water", "ice", "Mars", "surface", "discovery"], "primary_subject": "NASA"}}

Now analyze this claim and return ONLY raw JSON, no markdown, no explanation:
"{claim}" """

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
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
            
            # Log the raw response so you can see exactly what Groq returns
            raw = resp.json()["choices"][0]["message"]["content"].strip()
            logger.info(f"[CLAIM ANALYZER] Groq raw response: {raw}")
            
            result = json.loads(raw)

            # Validate topic
            valid_topics = {
                "politics","health","science","technology","finance",
                "sports","entertainment","crime","environment","religion","general"
            }
            if result.get("topic") not in valid_topics:
                result["topic"] = "general"

            # Validate keywords — must be a non-empty list
            if not result.get("keywords") or not isinstance(result["keywords"], list):
                result["keywords"] = []
                logger.warning("[CLAIM ANALYZER] Groq returned empty keywords")

            logger.info(
                f"[CLAIM ANALYZER] topic={result.get('topic')} | "
                f"keywords={result.get('keywords')} | "
                f"subject={result.get('primary_subject')}"
            )
            return result

    except json.JSONDecodeError as e:
        logger.warning(f"[CLAIM ANALYZER] JSON parse failed: {e} | raw was: {raw}")
        return {"topic": "general", "keywords": [], "primary_subject": claim[:60]}
    except Exception as e:
        logger.error(f"[CLAIM ANALYZER] Groq call failed: {e}")
        return {"topic": "general", "keywords": [], "primary_subject": claim[:60]}

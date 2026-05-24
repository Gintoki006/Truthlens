# backend/services/claim_analyzer.py

import httpx
import json
import re
import os
import logging

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

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
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.post(
                GEMINI_URL,
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0,
                        "maxOutputTokens": 1024,
                        "responseMimeType": "application/json"  # forces JSON mode
                    }
                }
            )
            resp.raise_for_status()
            
            # Log the raw response so you can see exactly what Gemini returns
            raw = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            logger.info(f"[CLAIM ANALYZER] Gemini raw response: {raw}")
            
            # Extract JSON block using regex in case Gemini includes conversational text
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                raw = match.group(0)
            else:
                raw = raw.replace("```json", "").replace("```", "").strip()
                
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
                logger.warning("[CLAIM ANALYZER] Gemini returned empty keywords")

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
        logger.warning(f"[CLAIM ANALYZER] Gemini call failed: {e}")
        return {"topic": "general", "keywords": [], "primary_subject": claim[:60]}

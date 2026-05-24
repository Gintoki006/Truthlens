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
- keywords: 3-5 important words about WHAT the claim is about (not WHO). Exclude the main subject name. Exclude verbs like admit/say/claim.
- primary_subject: shortest possible name of the main entity (e.g. "Chandrayaan-3" not "Chandrayaan 3 was a indian mission to moon")

Return ONLY raw JSON. No markdown. No explanation. Example output:
{{"topic": "science", "keywords": ["lunar", "landing", "mission", "moon"], "primary_subject": "Chandrayaan-3"}}

Now analyze: "{claim}" """

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

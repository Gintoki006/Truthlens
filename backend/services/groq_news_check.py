import httpx
import json
import os
import logging

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

async def groq_news_check(claim: str) -> dict:
    """
    Groq evaluates the claim's credibility based on:
    - Plausibility (does this make logical sense?)
    - Writing style (sensationalist vs factual)
    - Internal consistency (does it contradict known facts?)
    - Misinformation patterns (common conspiracy tropes)
    
    Returns score 0-100 and reasoning.
    """
    prompt = f"""You are an expert journalist and fact-checker evaluating a news claim.

Claim: "{claim}"

Evaluate this claim on the following criteria and return a credibility score:

1. PLAUSIBILITY — Does this claim make logical sense? Is it physically/scientifically possible?
2. SENSATIONALISM — Is the language neutral and factual, or emotional and clickbait?
3. KNOWN FACTS — Does this contradict well-established facts you know?
4. MISINFORMATION PATTERNS — Does this match common conspiracy theory or hoax patterns?
   (microchips in vaccines, faked moon landing, 5G causing disease, etc.)

Scoring guide:
- 85-100: Highly credible — factual tone, plausible, matches known reality
- 65-84:  Mostly credible — minor issues with tone or minor unverifiable claims  
- 45-64:  Uncertain — could be true but unverifiable or somewhat sensational
- 25-44:  Suspicious — implausible, sensational, or matches known hoax patterns
- 0-24:   Almost certainly false — contradicts known facts or is a known conspiracy

Return ONLY raw JSON:
{{
  "score": <0-100>,
  "plausibility": "high" or "medium" or "low",
  "sensationalism": "low" or "medium" or "high",
  "misinformation_pattern": true or false,
  "reasoning": "<one sentence explaining the score>"
}}

Examples:

Claim: "Bill Gates admitted COVID-19 vaccines contain microchips to track citizens"
Output: {{"score": 5, "plausibility": "low", "sensationalism": "high", "misinformation_pattern": true, "reasoning": "This is a well-known debunked conspiracy theory with no basis in reality."}}

Claim: "Chandrayaan-3 successfully landed on the Moon's south pole"
Output: {{"score": 92, "plausibility": "high", "sensationalism": "low", "misinformation_pattern": false, "reasoning": "Factual, well-documented event consistent with known ISRO mission history."}}

Claim: "A new cancer cure was discovered but suppressed by pharma companies"
Output: {{"score": 18, "plausibility": "low", "sensationalism": "high", "misinformation_pattern": true, "reasoning": "Matches classic pharma suppression conspiracy pattern with no verifiable basis."}}"""

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",  # use 70b for better reasoning
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                    "max_tokens": 150,
                    "response_format": {"type": "json_object"}
                }
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"].strip()
            result = json.loads(raw)

            score = max(0, min(100, int(result.get("score", 50))))
            logger.info(
                f"[GROQ NEWS CHECK] score={score} | "
                f"plausibility={result.get('plausibility')} | "
                f"sensationalism={result.get('sensationalism')} | "
                f"pattern={result.get('misinformation_pattern')} | "
                f"reason={result.get('reasoning')}"
            )
            return {
                "score": score,
                "plausibility": result.get("plausibility", "medium"),
                "sensationalism": result.get("sensationalism", "medium"),
                "misinformation_pattern": result.get("misinformation_pattern", False),
                "reasoning": result.get("reasoning", "")
            }

    except Exception as e:
        logger.warning(f"[GROQ NEWS CHECK] failed — {e}")
        return {"score": 50, "plausibility": "medium", "sensationalism": "medium",
                "misinformation_pattern": False, "reasoning": ""}

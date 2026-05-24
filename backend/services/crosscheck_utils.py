import os
import json
import logging
from urllib.parse import urlparse
import httpx

logger = logging.getLogger(__name__)

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

async def is_relevant_by_snippet(
    claim: str,
    title: str,
    snippet: str
) -> dict:
    """
    Returns:
      - relevant: bool — is this article about the same topic?
      - stance: "supports" | "debunks" | "neutral"
    """
    if not snippet:
        return {"relevant": True, "stance": "neutral"}

    prompt = f"""You are helping a fact-checking system evaluate search results.

Claim being verified: "{claim}"

Article title: "{title}"
Article snippet: "{snippet}"

Answer two questions:
1. Is this article actually about the same topic as the claim? (not just mentioning the same person)
2. What is the article's stance toward the claim?

Return ONLY raw JSON:
{{
  "relevant": true or false,
  "stance": "supports" or "debunks" or "neutral"
}}

Rules for stance:
- "supports": article confirms the claim is true
- "debunks": article says the claim is false, a hoax, misinformation, conspiracy, or myth
- "neutral": article reports on the topic without confirming or denying the claim

Examples:

Claim: "Bill Gates admitted vaccines contain microchips"
Title: "Fact check: Bill Gates is not using COVID-19 vaccines to implant microchips"
Snippet: "This claim is false. Gates has repeatedly denied..."
Output: {{"relevant": true, "stance": "debunks"}}

Claim: "Bill Gates admitted vaccines contain microchips"  
Title: "Bill Gates admits affairs, says Epstein association was huge mistake"
Snippet: "Bill Gates addressed his relationship with Jeffrey Epstein..."
Output: {{"relevant": false, "stance": "neutral"}}

Claim: "Chandrayaan-3 successfully landed on Moon's south pole"
Title: "India makes history with Chandrayaan-3 Moon landing"
Snippet: "ISRO successfully landed Chandrayaan-3 near the lunar south pole..."
Output: {{"relevant": true, "stance": "supports"}}

Claim: "Chandrayaan-3 successfully landed on Moon's south pole"
Title: "Chandrayaan-3 budget and funding explained"
Snippet: "ISRO spent approximately 600 crore rupees on the mission..."
Output: {{"relevant": true, "stance": "neutral"}}"""

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                    "max_tokens": 30,
                    "response_format": {"type": "json_object"}
                }
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"].strip()
            result = json.loads(raw)
            return {
                "relevant": result.get("relevant", True),
                "stance": result.get("stance", "neutral")
            }

    except Exception as e:
        logger.warning(f"[CROSSCHECK] Groq snippet check failed — {e}")
        return {"relevant": True, "stance": "neutral"}

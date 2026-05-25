import httpx
import json
import os
import logging

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

async def groq_fact_check(claim: str) -> dict:
    """
    Groq verifies specific factual claims against its knowledge base.
    Distinct from groq_news_check — this focuses on factual accuracy
    not writing style or plausibility patterns.
    
    Returns score 0-100, verdict, and specific fact corrections if wrong.
    """
    prompt = f"""You are a precise fact-checker with extensive knowledge. 
Verify the specific factual claims in this statement.

Claim: "{claim}"

Instructions:
- Check specific facts: dates, names, numbers, locations, scientific facts
- If the claim contains multiple facts, evaluate each one
- Be precise — "Neil Armstrong landed on the Moon" is TRUE, "Neil Armstrong landed on Mars" is FALSE
- Only state something is false if you are highly confident
- If you are uncertain, say "unverifiable" not false

Return ONLY raw JSON:
{{
  "verdict": "true" or "false" or "partially_true" or "unverifiable",
  "score": <0-100>,
  "confidence": "high" or "medium" or "low",
  "correction": "<specific correction if false, else null>",
  "key_facts": ["<fact 1 checked>", "<fact 2 checked>"]
}}

Scoring guide:
- 85-100: Verified true — specific facts confirmed with high confidence
- 65-84:  Mostly true — main facts correct, minor details uncertain
- 45-64:  Unverifiable — cannot confirm or deny with confidence
- 25-44:  Partially false — some facts wrong
- 0-24:   False — specific facts directly contradict known reality

Examples:

Claim: "Neil Armstrong was the first human to walk on the Moon in 1969"
Output: {{"verdict": "true", "score": 98, "confidence": "high", "correction": null, "key_facts": ["Neil Armstrong first human on Moon - TRUE", "Year 1969 - TRUE"]}}

Claim: "The Earth is 6000 years old"
Output: {{"verdict": "false", "score": 2, "confidence": "high", "correction": "Scientific consensus puts Earth's age at approximately 4.5 billion years", "key_facts": ["Earth age 6000 years - FALSE, actual age ~4.5 billion years"]}}

Claim: "Chandrayaan-3 landed on Moon's south pole in 2023"
Output: {{"verdict": "true", "score": 95, "confidence": "high", "correction": null, "key_facts": ["Chandrayaan-3 lunar south pole landing - TRUE", "Year 2023 - TRUE"]}}

Claim: "A new study shows coffee cures cancer"
Output: {{"verdict": "unverifiable", "score": 50, "confidence": "low", "correction": null, "key_facts": ["Coffee curing cancer - no scientific consensus"]}}"""

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",  # 70b for factual accuracy
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                    "max_tokens": 200,
                    "response_format": {"type": "json_object"}
                }
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"].strip()
            result = json.loads(raw)

            score = max(0, min(100, int(result.get("score", 50))))
            logger.info(
                f"[GROQ FACT CHECK] verdict={result.get('verdict')} | "
                f"score={score} | confidence={result.get('confidence')} | "
                f"correction={result.get('correction')}"
            )
            return {
                "score": score,
                "verdict": result.get("verdict", "unverifiable"),
                "confidence": result.get("confidence", "low"),
                "correction": result.get("correction"),
                "key_facts": result.get("key_facts", [])
            }

    except Exception as e:
        logger.warning(f"[GROQ FACT CHECK] failed — {e}")
        return {"score": 50, "verdict": "unverifiable", "confidence": "low",
                "correction": None, "key_facts": []}

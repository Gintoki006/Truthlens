import httpx
import json
import os
import logging

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
SERPER_URL = "https://google.serper.dev/search"

async def groq_fact_check(claim: str) -> dict:
    """
    Groq verifies specific factual claims against its knowledge base.
    Distinct from groq_news_check — this focuses on factual accuracy
    not writing style or plausibility patterns.
    
    Returns score 0-100, verdict, and specific fact corrections if wrong.
    """
    SERPER_API_KEY = os.getenv("SERPER_API_KEY")
    search_context = ""
    print(f"\\n[!!! GROQ FACT CHECK SERPER !!!] SERPER_API_KEY Found: {bool(SERPER_API_KEY)}")
    if SERPER_API_KEY:
        try:
            import re
            # Extract first line and strip all punctuation/quotes to ensure Google finds broad matches
            first_line = claim.split('\n')[0].strip()
            clean_query = re.sub(r'[^\w\s]', '', first_line).strip()[:80]
            
            async with httpx.AsyncClient(timeout=5.0) as client:
                serper_resp = await client.post(
                    SERPER_URL,
                    headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
                    json={"q": clean_query, "num": 5}
                )
                serper_resp.raise_for_status()
                
                snippets = []
                for r in serper_resp.json().get("organic", [])[:5]:
                    if r.get("snippet"):
                        snippets.append(r["snippet"])
                
                if snippets:
                    search_context = "\n".join(f"- {s}" for s in snippets)
                    print(f"[!!! GROQ FACT CHECK SERPER !!!] Fetched {len(snippets)} snippets for query: '{clean_query}'")
                    for i, s in enumerate(snippets):
                        print(f"  Context {i+1}: {s[:100]}...")
                else:
                    print(f"[!!! GROQ FACT CHECK SERPER !!!] 0 snippets found for query: '{clean_query}'")
                    
        except Exception as e:
            print(f"[!!! GROQ FACT CHECK SERPER !!!] Serper context fetch failed: {e}")

    prompt = f"""You are a precise fact-checker with extensive knowledge. 
Verify the specific factual claims in this statement.

Claim: "{claim}"

{f"LIVE WEB CONTEXT:\\n{search_context}\\n\\nUse the live web context above to verify the claim (especially for recent news)." if search_context else ""}

Instructions:
- STEP 1: Carefully compare the LIVE WEB CONTEXT against the CLAIM.
- STEP 2: Determine if the snippets describe the same core news event or explicitly support the claim.
- STEP 3: If the snippets corroborate the core event/claim, score it highly (90-100) even if minor details from the claim are missing in the snippets. Do NOT penalize if the main event is verified.
- CRITICAL: If the Claim describes a "viral message", "social media post", or "rumor", DO NOT verify the mere existence of the message. You MUST verify the UNDERLYING factual claim being spread. If the underlying claim is false (e.g., "5G towers cause illness"), score it 0-24 even if the message itself truly went viral.
- Check specific facts: dates, names, numbers, locations, scientific facts.
- Be precise — "Neil Armstrong landed on the Moon" is TRUE, "Neil Armstrong landed on Mars" is FALSE
- If the claim is a general news statement (e.g., "RBI maintains rates") and the context supports this occurring recently, score it 85-100. Do NOT mark it unverifiable just because it lacks a specific date.
- Only state something is false if the context or your knowledge directly contradicts it.
- If you are completely uncertain or the context is entirely irrelevant, say "unverifiable".

Return ONLY raw JSON:
{{
  "verdict": "true" or "false" or "partially_true" or "unverifiable",
  "score": <0-100>,
  "confidence": "high" or "medium" or "low",
  "correction": "<specific correction if false, else null>",
  "key_facts": ["<fact 1 checked>", "<fact 2 checked>"]
}}

Scoring guide:
- 85-100: Verified true — core facts strongly confirmed by knowledge or LIVE WEB CONTEXT
- 65-84:  Mostly true — main facts correct, but some significant details contradict or are highly questionable
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

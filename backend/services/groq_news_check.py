import httpx
import json
import os
import re
import logging

logger = logging.getLogger(__name__)

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
SERPER_URL = "https://google.serper.dev/news"


async def _fetch_news_context(claim: str) -> tuple[str, list[dict]]:
    """
    Search Serper's news index for articles related to the claim.
    Returns (formatted_context_string, list_of_source_dicts).
    """
    serper_key = os.getenv("SERPER_API_KEY")
    if not serper_key:
        return "", []

    try:
        # Strip to the first 80 chars of a clean query
        first_line = claim.split("\n")[0].strip()
        clean_query = re.sub(r"[^\w\s]", " ", first_line).strip()
        clean_query = re.sub(r"\s+", " ", clean_query)[:90]

        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.post(
                SERPER_URL,
                headers={"X-API-KEY": serper_key, "Content-Type": "application/json"},
                json={"q": clean_query, "num": 8},
            )
            resp.raise_for_status()
            news_items = resp.json().get("news", [])

        sources = []
        context_lines = []
        for item in news_items[:8]:
            title = item.get("title", "").strip()
            snippet = item.get("snippet", "").strip()
            source = item.get("source", "").strip()
            date = item.get("date", "").strip()
            if title:
                sources.append({"title": title, "source": source, "date": date})
                context_lines.append(f"[{source}] {title}. {snippet}")

        context = "\n".join(context_lines)
        logger.info(f"[GROQ NEWS CHECK] Serper found {len(sources)} news articles for query: '{clean_query}'")
        return context, sources

    except Exception as e:
        logger.warning(f"[GROQ NEWS CHECK] Serper fetch failed: {e}")
        return "", []


async def groq_news_check(claim: str) -> dict:
    """
    Evaluates a claim's credibility using:
    1. Live Serper news search for corroborating / contradicting real articles
    2. Groq LLM reasoning over that evidence + internal knowledge

    Returns score 0-100 with reasoning and corroboration sources.
    """
    news_context, sources = await _fetch_news_context(claim)

    if news_context:
        context_block = f"""LIVE NEWS SEARCH RESULTS (retrieved now from Google News):
{news_context}

Using the above real news articles as primary evidence:
- If multiple reputable outlets report a story consistent with the claim → score HIGH (75-100)
- If outlets report something that directly contradicts the claim → score LOW (0-30)
- If no results are relevant or results are ambiguous → rely on your internal knowledge and reasoning
"""
    else:
        context_block = "No live news context available. Rely entirely on your internal knowledge and reasoning."

    prompt = f"""You are a senior investigative journalist and fact-checker. Your job is to evaluate the CREDIBILITY of a news claim using both live news evidence and your internal knowledge.

CLAIM TO EVALUATE:
"{claim}"

{context_block}

EVALUATION CRITERIA:
1. NEWS CORROBORATION — Do the live news results confirm, contradict, or ignore this claim? Be specific.
2. PLAUSIBILITY — Is this claim logically and scientifically possible?
3. SENSATIONALISM — Is the language neutral and factual, or emotional/clickbait/alarmist?
4. MISINFORMATION PATTERNS — Does it match known conspiracy tropes (microchips in vaccines, 5G disease, flat earth, pharma suppression, etc.)?
5. SATIRE / PARODY — Is this clearly satirical (The Onion, Babylon Bee style)?

CRITICAL RULES:
- If the claim is about a "viral message" or "rumor", evaluate the UNDERLYING claim, not the fact that a message went viral.
- If the live news results strongly corroborate the claim from reputable outlets (Reuters, AP, BBC, Times, etc.), score 80-100.
- If live results directly contradict the claim, score 0-35.
- If the claim is a known debunked conspiracy (vaccines cause autism, 5G = COVID, moon landing hoax), score 0-20 regardless of phrasing.
- If the claim is plausible but unverifiable with current evidence, score 45-64.

SCORING GUIDE:
- 85-100: Highly credible — confirmed by reputable live sources or very well-established fact
- 65-84:  Mostly credible — consistent with news context, minor uncertainties
- 45-64:  Uncertain — plausible but no strong corroboration or minor contradictions
- 25-44:  Suspicious — contradicted by some sources, sensational, or matches hoax patterns
- 0-24:   Almost certainly false — directly contradicted by credible sources, known conspiracy, or satire

Return ONLY raw JSON (no markdown, no explanation outside JSON):
{{
  "score": <integer 0-100>,
  "plausibility": "high" | "medium" | "low",
  "sensationalism": "low" | "medium" | "high",
  "misinformation_pattern": true | false,
  "news_corroboration": "confirmed" | "contradicted" | "partial" | "not_found",
  "reasoning": "<2-3 sentences explaining the score with specific reference to evidence>"
}}"""

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                    "max_tokens": 250,
                    "response_format": {"type": "json_object"},
                },
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
                f"corroboration={result.get('news_corroboration')} | "
                f"reason={result.get('reasoning', '')[:80]}"
            )
            return {
                "score": score,
                "plausibility": result.get("plausibility", "medium"),
                "sensationalism": result.get("sensationalism", "medium"),
                "misinformation_pattern": result.get("misinformation_pattern", False),
                "news_corroboration": result.get("news_corroboration", "not_found"),
                "reasoning": result.get("reasoning", ""),
                "corroboration_sources": sources,
            }

    except Exception as e:
        logger.warning(f"[GROQ NEWS CHECK] failed — {e}")
        return {
            "score": 50,
            "plausibility": "medium",
            "sensationalism": "medium",
            "misinformation_pattern": False,
            "news_corroboration": "not_found",
            "reasoning": "",
            "corroboration_sources": [],
        }

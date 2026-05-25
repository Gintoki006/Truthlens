"""
LLM explanation generator.

Generates a 2–4 sentence plain-English explanation of the verdict,
referencing the specific signals that influenced the score — including
Serper cross-verification results and corroborating outlet names.
Uses Google Gemini API depending on config.
"""

import os
import httpx
import json

def _get_groq_key():
    return os.getenv("GROQ_API_KEY")


def generate_explanation(
    article_title: str,
    source_domain: str,
    verdict: str,
    final_score: int,
    content_score: int,
    source_group_score: int,
    facts_score: int | None,
    nlp_details: dict,
    crosscheck_score: int | None = None,
    corroborating_sources: list[dict] | None = None,
    crosscheck_fallback: bool = False,
    factcheck_result: dict | None = None,
) -> str:
    """
    Generate a 2–4 sentence explanation of why the article received its verdict.

    Falls back to a template-based explanation if no LLM API key is configured.
    """
    groq_key = _get_groq_key()

    # Build corroboration context for the prompt
    corroboration_text = _build_corroboration_text(
        crosscheck_score, corroborating_sources, crosscheck_fallback
    )

    # Build fact verification context
    factcheck_text = _build_factcheck_text(factcheck_result)

    # Build Fact Verification Context
    fact_context = f"- Fact Verification: {facts_score}/100" if facts_score is not None else "- Fact Verification: N/A (URL input)"

    # Build Source Context
    source_context = "No source domain — scored on crosscheck only" if not source_domain else f"Domain: {source_domain}"

    prompt = f"""You are a fact-checking assistant. Explain in 2-4 clear, plain-English sentences why this news article received its credibility verdict. Reference specific signals.

Article: "{article_title}"
Final Score: {final_score}/100
Verdict: {verdict}

Signal Breakdown:
- Content Intelligence: {content_score}/100
- Source Credibility: {source_group_score}/100 ({source_context})
- Cross-Verification: {corroboration_text}
{fact_context}

Write a concise explanation. Do not use bullet points. Do not say "I" or mention yourself. Refer to the article in third person. If corroborating sources were found, mention the outlet names. If fact-checkers have verified this claim, mention their verdict. If the story was too recent to verify, mention that."""

    if not groq_key:
        # Template fallback — no LLM key configured
        return _template_explanation(
            article_title, source_domain, verdict, final_score,
            nlp_score, source_score, ml_score, source_info, nlp_details,
            crosscheck_score, corroborating_sources, crosscheck_fallback,
            factcheck_result,
        )

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 512
                }
            )
            resp.raise_for_status()
            raw = resp.json()["choices"][0]["message"]["content"].strip()
            return raw

    except Exception as e:
        print(f"LLM explanation error: {e}")
        return _template_explanation(
            article_title, verdict, final_score,
            content_score, source_group_score, facts_score,
            crosscheck_score, corroborating_sources,
        )


def _build_corroboration_text(
    crosscheck_score: int | None,
    corroborating_sources: list[dict] | None,
    crosscheck_fallback: bool,
) -> str:
    """Build a human-readable corroboration summary for the LLM prompt."""
    if crosscheck_fallback:
        return "Story may be too recent to verify — no corroborating search results found; Serper cross-verification weight redistributed to other signals."

    if crosscheck_score is None:
        return "Cross-verification unavailable (Serper API not configured)."

    sources = corroborating_sources or []
    if not sources:
        return f"{crosscheck_score}/100 — No major outlets found covering this claim."

    names = [s.get("name", s.get("domain", "Unknown")) for s in sources]
    # Truncate names to domain for readability
    display_names = []
    for s in sources:
        domain = s.get("domain", "")
        # Use a clean display name
        name = domain.replace(".com", "").replace(".co.in", "").replace(".in", "").title()
        display_names.append(name)

    outlet_list = ", ".join(display_names[:5])
    return f"{crosscheck_score}/100 — Corroborated by: {outlet_list} ({len(sources)} trusted outlet{'s' if len(sources) != 1 else ''})"


def _build_factcheck_text(factcheck_result: dict | None) -> str:
    """Build a human-readable fact verification summary for the LLM prompt."""
    if not factcheck_result:
        return "Fact verification unavailable."

    score = factcheck_result.get("score", 50)
    parts = [f"{score}/100"]

    # FEVER match
    fever = factcheck_result.get("fever_details", {})
    top_match = fever.get("top_match")
    if top_match and top_match.get("similarity", 0) >= 0.70:
        parts.append(f"FEVER dataset match: \"{top_match['claim']}\" ({top_match['label']}, {top_match['similarity']:.0%} similar)")

    # Google Fact Check verdict
    gfc = factcheck_result.get("gfactcheck_details", {})
    if gfc.get("verdict"):
        parts.append(f"Fact-checker verdict: {gfc['verdict']} (source: {gfc.get('source', 'Unknown')})")

    # Wikidata confirmations
    wiki = factcheck_result.get("wikidata_details", {})
    entities = wiki.get("entity_results", [])
    confirmed = [e for e in entities if e.get("confirmed")]
    if confirmed:
        names = ", ".join(e["entity"] for e in confirmed[:3])
        parts.append(f"Wikidata confirmed: {names}")

    return " \u2014 ".join(parts)


def _template_explanation(
    article_title, verdict, final_score,
    content_score, source_score, facts_score,
    crosscheck_score=None, corroborating_sources=None,
) -> str:
    """Generate a template-based explanation when no LLM is available."""
    parts = []

    # Verdict summary
    if verdict == "real":
        parts.append(f'This article scores {final_score}/100, indicating it is likely authentic.')
    elif verdict == "suspicious":
        parts.append(f'This article scores {final_score}/100, suggesting the claims should be verified independently.')
    else:
        parts.append(f'This article scores {final_score}/100, indicating it is likely unreliable or misleading.')

    # NLP signal
    if nlp_score < 50:
        parts.append(f'The text analysis flagged emotionally charged or sensationalist language (NLP score: {nlp_score}/100).')
    elif nlp_score > 75:
        parts.append(f'The writing style appears balanced and factual (NLP score: {nlp_score}/100).')

    # Source signal
    if not source_info.get("is_known", False):
        parts.append(f'The source domain ({source_domain}) is not in our credibility database and could not be verified.')
    elif source_score < 40:
        parts.append(f'The source ({source_domain}) has a low credibility rating in our database (score: {source_score}/100).')
    elif source_score > 70:
        parts.append(f'The source ({source_domain}) is rated as generally credible (score: {source_score}/100).')

    # Cross-verification signal
    sources = corroborating_sources or []
    if crosscheck_fallback:
        parts.append('This story may be too recent to verify via search — cross-verification was skipped.')
    elif crosscheck_score is not None and len(sources) > 0:
        outlet_names = [s.get("domain", "").replace(".com", "").title() for s in sources[:3]]
        parts.append(f'{", ".join(outlet_names)} {"all" if len(outlet_names) > 1 else "also"} reported this story, supporting its authenticity.')
    elif crosscheck_score is not None and len(sources) == 0:
        parts.append('No major outlets were found reporting this claim, which lowers its credibility.')

    # ML signal
    if ml_score < 40:
        parts.append(f'Machine learning classifiers flagged the content as likely fabricated.')
    elif ml_score > 70:
        parts.append(f'Machine learning classifiers indicate the content is consistent with genuine reporting.')

    # Fact verification signal
    if factcheck_result:
        fact_score = factcheck_result.get("score", 50)
        gfc = factcheck_result.get("gfactcheck_details", {})
        wiki = factcheck_result.get("wikidata_details", {})
        confirmed_entities = [e for e in wiki.get("entity_results", []) if e.get("confirmed")]

        if gfc.get("verdict"):
            parts.append(f'Fact-checkers rate this claim as "{gfc["verdict"]}" (via {gfc.get("source", "professional fact-checker")}).')
        elif confirmed_entities:
            names = ", ".join(e["entity"] for e in confirmed_entities[:2])
            parts.append(f'Key entities ({names}) were verified against Wikidata\'s knowledge base.')
        elif fact_score > 70:
            parts.append(f'Fact verification supports this claim (score: {fact_score}/100).')
        elif fact_score < 30:
            parts.append(f'Fact verification raises concerns about the accuracy of this claim (score: {fact_score}/100).')

    return " ".join(parts[:5])  # Cap at 5 sentences

"""
LLM explanation generator.

Generates a 2–4 sentence plain-English explanation of the verdict,
referencing the specific signals that influenced the score.
Uses OpenAI (GPT-4o-mini) or Anthropic (Claude) depending on config.
"""

import os

_client = None
_provider = None


def _get_client():
    global _client, _provider

    if _client is not None:
        return _client, _provider

    # Try OpenAI first
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key and openai_key != "your-openai-key":
        from openai import OpenAI
        _client = OpenAI(api_key=openai_key)
        _provider = "openai"
        return _client, _provider

    # Try Anthropic
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if anthropic_key and anthropic_key != "your-anthropic-key":
        from anthropic import Anthropic
        _client = Anthropic(api_key=anthropic_key)
        _provider = "anthropic"
        return _client, _provider

    return None, None


def generate_explanation(
    article_title: str,
    source_domain: str,
    verdict: str,
    final_score: int,
    nlp_score: int,
    source_score: int,
    ml_score: int,
    roberta_score: int | None,
    lr_score: int | None,
    source_info: dict,
    nlp_details: dict,
) -> str:
    """
    Generate a 2–4 sentence explanation of why the article received its verdict.

    Falls back to a template-based explanation if no LLM API key is configured.
    """
    client, provider = _get_client()

    prompt = f"""You are a fact-checking assistant. Explain in 2-4 clear, plain-English sentences why this news article received its credibility verdict. Reference specific signals.

Article: "{article_title}"
Source: {source_domain}
Final Score: {final_score}/100
Verdict: {verdict}

Signal Breakdown:
- NLP Text Analysis: {nlp_score}/100 (sentiment: {nlp_details.get('sentiment_score', 'N/A')}, subjectivity: {nlp_details.get('subjectivity_score', 'N/A')}, clickbait: {nlp_details.get('clickbait_score', 'N/A')})
- Source Credibility: {source_score}/100 (known: {source_info.get('is_known', False)}, category: {source_info.get('category', 'N/A')}, bias: {source_info.get('bias', 'N/A')})
- ML Classification: {ml_score}/100 (RoBERTa: {roberta_score}, Logistic Regression: {lr_score})

Write a concise explanation. Do not use bullet points. Do not say "I" or mention yourself. Refer to the article in third person."""

    if client is None:
        # Template fallback — no LLM key configured
        return _template_explanation(
            article_title, source_domain, verdict, final_score,
            nlp_score, source_score, ml_score, source_info, nlp_details,
        )

    try:
        if provider == "openai":
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.3,
            )
            return response.choices[0].message.content.strip()

        elif provider == "anthropic":
            response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            return response.content[0].text.strip()

    except Exception as e:
        print(f"LLM explanation error: {e}")
        return _template_explanation(
            article_title, source_domain, verdict, final_score,
            nlp_score, source_score, ml_score, source_info, nlp_details,
        )


def _template_explanation(
    article_title, source_domain, verdict, final_score,
    nlp_score, source_score, ml_score, source_info, nlp_details,
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

    # ML signal
    if ml_score < 40:
        parts.append(f'Machine learning classifiers flagged the content as likely fabricated.')
    elif ml_score > 70:
        parts.append(f'Machine learning classifiers indicate the content is consistent with genuine reporting.')

    return " ".join(parts[:4])  # Cap at 4 sentences

"""
Score fusion and sentence-level scoring.

Standard formula (4 signals):
  final_score = (NLP × 0.25) + (Source × 0.30) + (ML × 0.25) + (Crosscheck × 0.20)

Dynamic fallback (Serper returned no results AND article < 6 hours old):
  final_score = (NLP × 0.31) + (Source × 0.38) + (ML × 0.31)

Verdict mapping:
  70–100 → real   (green)
  40–69  → suspicious (amber)
  0–39   → fake   (red)
"""

import nltk


def compute_final_score(
    nlp_score: int,
    source_score: int,
    ml_score: int,
    crosscheck_score: int | None = None,
    article_age_hours: int | None = None,
    serper_results_count: int = 0,
) -> dict:
    """
    Fuse signal scores into a final authenticity score and verdict.

    Uses the standard 4-signal formula when Serper data is available.
    Falls back to a 3-signal formula when Serper returned no results
    and the article is less than 6 hours old.

    Returns:
        dict with keys: score, verdict, crosscheck_fallback
    """
    # Determine whether to apply fallback
    use_fallback = False

    if crosscheck_score is None:
        # Serper unavailable (no API key or error) — always use fallback
        use_fallback = True
    elif serper_results_count == 0 and article_age_hours is not None and article_age_hours < 6:
        # Serper returned 0 corroborating results on a fresh article
        use_fallback = True

    if use_fallback:
        # Redistribute Serper's 20% across the other three signals
        score = round(nlp_score * 0.31 + source_score * 0.38 + ml_score * 0.31)
    else:
        # Standard 4-signal fusion
        score = round(
            nlp_score * 0.25
            + source_score * 0.30
            + ml_score * 0.25
            + (crosscheck_score or 0) * 0.20
        )

    score = max(0, min(100, score))

    if score >= 70:
        verdict = "real"
    elif score >= 40:
        verdict = "suspicious"
    else:
        verdict = "fake"

    return {"score": score, "verdict": verdict, "crosscheck_fallback": use_fallback}


def score_sentences(text: str, nlp_score: int) -> list[dict]:
    """
    Split article into sentences and assign per-sentence risk scores.

    Each sentence gets a simplified risk score based on its individual
    sentiment polarity and subjectivity, calibrated against the overall
    NLP signal.

    Returns:
        list of dicts with keys: text, score, level, reason
    """
    from services.nlp import _score_sentiment, _score_subjectivity

    try:
        sentences = nltk.sent_tokenize(text)
    except Exception:
        nltk.download("punkt", quiet=True)
        nltk.download("punkt_tab", quiet=True)
        sentences = nltk.sent_tokenize(text)

    scored = []
    for sent in sentences:
        sent = sent.strip()
        if len(sent) < 10:
            continue

        sent_sentiment = _score_sentiment(sent)
        sent_subjectivity = _score_subjectivity(sent)
        sent_score = round(sent_sentiment * 0.5 + sent_subjectivity * 0.5)

        # Determine risk level and reason
        if sent_score >= 70:
            level = "verified"
            reason = "Neutral, balanced language"
        elif sent_score >= 40:
            level = "uncertain"
            reasons = []
            if sent_sentiment < 60:
                reasons.append("emotionally charged language")
            if sent_subjectivity < 60:
                reasons.append("subjective claims")
            reason = "Contains " + " and ".join(reasons) if reasons else "Uncertain claim"
        else:
            level = "flagged"
            reasons = []
            if sent_sentiment < 40:
                reasons.append("highly sensational language")
            if sent_subjectivity < 40:
                reasons.append("strong subjective bias")
            reason = "Flagged for " + " and ".join(reasons) if reasons else "Likely misleading content"

        scored.append({
            "text": sent,
            "score": sent_score,
            "level": level,
            "reason": reason,
        })

    return scored

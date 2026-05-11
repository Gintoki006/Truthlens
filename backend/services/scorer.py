"""
Score fusion and sentence-level scoring.

5-signal fusion (v2 — with Fact Verification):

Standard formula (URL input, all signals):
  final = (NLP × 0.20) + (Source × 0.25) + (ML × 0.20) + (Crosscheck × 0.15) + (Fact × 0.20)

Text-only formula (no source domain — boosts fact weight):
  final = (NLP × 0.20) + (Source × 0.10) + (ML × 0.20) + (Crosscheck × 0.15) + (Fact × 0.35)

Serper fallback (no crosscheck results, article < 6 hours old):
  final = (NLP × 0.23) + (Source × 0.29) + (ML × 0.23) + (Fact × 0.25)

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
    fact_score: int | None = None,
    article_age_hours: int | None = None,
    serper_results_count: int = 0,
    input_type: str = "url",
    source_domain: str | None = None,
) -> dict:
    """
    Fuse signal scores into a final authenticity score and verdict.

    Selects the appropriate formula based on input type and signal availability:
      1. Text-only formula: when no source domain is available (e.g. pasted text)
      2. Serper fallback formula: when crosscheck data is unavailable or
         article is too new for corroboration
      3. Standard 5-signal formula: when all signals are available

    Returns:
        dict with keys: score, verdict, crosscheck_fallback, formula_used
    """
    fact = fact_score if fact_score is not None else 50  # neutral default

    # ── Formula selection ───────────────────────────────────────────────
    use_fallback = False

    if crosscheck_score is None:
        use_fallback = True
    elif serper_results_count == 0 and article_age_hours is not None and article_age_hours < 6:
        use_fallback = True

    if input_type == "text" or not source_domain:
        # Text-only formula — boost fact verification, reduce source credibility
        score = round(
            nlp_score * 0.20
            + source_score * 0.10
            + ml_score * 0.20
            + (crosscheck_score or 0) * 0.15
            + fact * 0.35
        )
        formula_used = "text_only"
    elif use_fallback:
        # Serper fallback — drop crosscheck, redistribute to remaining 4 signals
        score = round(
            nlp_score * 0.23
            + source_score * 0.29
            + ml_score * 0.23
            + fact * 0.25
        )
        formula_used = "serper_fallback"
    else:
        # Standard 5-signal fusion
        score = round(
            nlp_score * 0.20
            + source_score * 0.25
            + ml_score * 0.20
            + (crosscheck_score or 0) * 0.15
            + fact * 0.20
        )
        formula_used = "standard"

    score = max(0, min(100, score))

    if score >= 70:
        verdict = "real"
    elif score >= 40:
        verdict = "suspicious"
    else:
        verdict = "fake"

    return {
        "score": score,
        "verdict": verdict,
        "crosscheck_fallback": use_fallback,
        "formula_used": formula_used,
    }


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

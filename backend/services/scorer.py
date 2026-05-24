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
    ml_roberta_score: int,
    ml_lr_score: int,
    crosscheck_score: int | None = None,
    crosscheck_sources: list = None,
    factcheck_result: dict = None,
    article_age_hours: int | None = None,
    serper_results_count: int = 0,
    input_type: str = "url",
    source_domain: str | None = None,
) -> dict:
    """
    Fuse signal scores into a final authenticity score and verdict based on PRD v1.5.

    Selects the appropriate formula based on input type and signal availability:
      1. Standard formula (URL input, all signals)
      2. Text-only formula (no source domain)
      3. Serper fallback formula (article < 6 hours old and 0 crosscheck results)

    Returns:
        dict with keys: score, verdict, override_applied, score_override_reason, groups...
    """
    if factcheck_result is None:
        factcheck_result = {}

    # ── 1. Calculate Group Scores (Default URL mode) ────────────────────
    content_score = round((nlp_score * 0.40) + (ml_score * 0.60))
    source_score_group = round((source_score * 0.50) + ((crosscheck_score or 0) * 0.50))
    facts_score = factcheck_result.get("score", 50)

    # ── 2. Formula Selection & Fusion ───────────────────────────────────
    formula_used = "standard"
    text_only_formula = False

    if (input_type == "text" or not source_domain):
        text_only_formula = True
        if crosscheck_score is None:
            # Text-only without crosscheck
            final_score = round((nlp_score * 0.30) + (ml_score * 0.40) + (facts_score * 0.30))
            formula_used = "text_only_fallback"
        else:
            final_score = round(
                (nlp_score * 0.20)
                + (ml_score * 0.35)
                + (crosscheck_score * 0.25)
                + (facts_score * 0.20)
            )
            formula_used = "text_only"
    elif serper_results_count == 0 and article_age_hours is not None and article_age_hours < 6:
        final_score = round(
            (nlp_score * 0.23)
            + (source_score * 0.29)
            + (ml_score * 0.23)
            + (facts_score * 0.25)
        )
        formula_used = "serper_fallback"
    else:
        final_score = round(
            (nlp_score * 0.20)
            + (source_score * 0.25)
            + (ml_score * 0.20)
            + ((crosscheck_score or 0) * 0.15)
            + (facts_score * 0.20)
        )
        formula_used = "standard"

    use_fallback = "fallback" in formula_used

    # ── 3. Override Rules ───────────────────────────────────────────────
    override_applied = None
    score_override_reason = None

    gfact_details = factcheck_result.get("gfactcheck_details", {})
    gfact_verdict = gfact_details.get("verdict") or ""
    gfact_similarity = gfact_details.get("similarity", 0.0)

    from services.google_factcheck import TRUTH_RATINGS, FALSE_RATINGS

    is_truth = any(k in gfact_verdict.lower() for k in TRUTH_RATINGS.keys())
    is_false = any(k in gfact_verdict.lower() for k in FALSE_RATINGS.keys())

    if is_truth and gfact_similarity >= 0.80:
        if final_score < 75:
            final_score = 75
            override_applied = True
            score_override_reason = "Fact check verified this claim"
    elif is_false and gfact_similarity >= 0.80:
        if final_score > 35:
            final_score = 35
            override_applied = True
            score_override_reason = "Fact check debunked this claim"

    # Wikidata overrides
    wikidata_details = factcheck_result.get("wikidata_details", {})
    wd_score = wikidata_details.get("score", 50)
    
    if wd_score >= 90:
        final_score = min(final_score + 10, 100)
        override_applied = True
        score_override_reason = "Wikidata confirms entity predicates (+10)"
    elif wd_score <= 20:
        final_score = max(final_score - 15, 0)
        override_applied = True
        score_override_reason = "Wikidata contradicts entity predicates (-15)"

    final_score = max(0, min(100, final_score))

    # ── Verdict Mapping ─────────────────────────────────────────────────
    if final_score >= 70:
        verdict = "real"
    elif final_score >= 40:
        verdict = "suspicious"
    else:
        verdict = "fake"

    # Adjust Group Scores for Text-Only Mode
    if text_only_formula:
        content_score = round((nlp_score * (0.20 / 0.55)) + (ml_score * (0.35 / 0.55)))
        source_score_group = crosscheck_score or 0

    return {
        "score": final_score,
        "verdict": verdict,
        "override_applied": override_applied,
        "score_override_reason": score_override_reason,
        "crosscheck_fallback": use_fallback,
        "text_only_formula": text_only_formula,
        "formula_used": formula_used,
        "groups": {
            "content": {
                "score": content_score,
                "weight": 0.55 if text_only_formula else (0.50 if use_fallback else 0.40),
                "sub_signals": {
                    "nlp": nlp_score,
                    "roberta": ml_roberta_score,
                    "lr_model": ml_lr_score,
                    "ml_ensemble": ml_score
                }
            },
            "source": {
                "score": source_score_group,
                "weight": 0.0 if use_fallback else (0.25 if text_only_formula else 0.40),
                "sub_signals": {
                    "crosscheck": crosscheck_score or 0
                } if text_only_formula else {
                    "domain_trust": source_score,
                    "crosscheck": crosscheck_score or 0
                },
                "corroborating_sources": crosscheck_sources or [],
                "fallback_applied": use_fallback,
                "text_only": text_only_formula
            },
            "facts": {
                "score": facts_score,
                "weight": 0.20 if text_only_formula else (0.50 if use_fallback else 0.20),
                "sub_signals": {
                    "factcheck": factcheck_result.get("score_gfactcheck", 50),
                    "wikidata": factcheck_result.get("score_wikidata", 50),
                    "fever": factcheck_result.get("score_fever", 50)
                },
                "factcheck_result": {
                    "rating": gfact_verdict if gfact_verdict else None,
                    "checker": gfact_details.get("source"),
                    "url": gfact_details.get("review_url"),
                    "similarity": gfact_similarity
                },
                "wikidata_status": "confirmed" if wd_score >= 90 else ("contradicted" if wd_score <= 20 else "unverified")
            }
        }
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

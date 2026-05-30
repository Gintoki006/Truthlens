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
import logging

logger = logging.getLogger(__name__)


def compute_final_score(
    nlp_score: int,
    source_score: int,
    ml_score: int,
    ml_roberta_score: int,
    ml_lr_score: int,
    crosscheck_score: int | None = None,
    crosscheck_sources: list = None,
    factcheck_result: dict = None,
    groq_news_result: dict = None,
    groq_fact_result: dict = None,
    article_age_hours: int | None = None,
    serper_results_count: int = 0,
    input_type: str = "url",
    source_domain: str | None = None,
) -> dict:
    if factcheck_result is None: factcheck_result = {}
    if groq_news_result is None: groq_news_result = {}
    if groq_fact_result is None: groq_fact_result = {}

    groq_news_score = groq_news_result.get("score")
    if groq_news_score is None: groq_news_score = 50
    
    groq_fact_score = groq_fact_result.get("score")
    if groq_fact_score is None: groq_fact_score = 50
    
    # ── 1. Calculate Group Scores ───────────────────────────────────────
    # ── Fact Verification Signals ───────────────────────────────────────
    # We retrieve these globally so override rules can still apply them if needed
    gfactcheck_score = factcheck_result.get("score_gfactcheck")
    if gfactcheck_score is None: gfactcheck_score = 50
    
    wikidata_score   = factcheck_result.get("score_wikidata")
    if wikidata_score is None: wikidata_score = 50
    
    fever_score      = factcheck_result.get("score_fever")
    if fever_score is None: fever_score = 50

    # ── URL INPUT — only Content + Source ───────────────────────────────

    if input_type == "url" and source_domain:
        text_only_formula = False

        # Group A — Content Intelligence (all 4 signals)
        content_score = round(
            (nlp_score        * 0.20) +   # VADER + TextBlob + clickbait
            (ml_roberta_score * 0.30) +   # RoBERTa directly
            (ml_lr_score      * 0.15) +   # LR/TF-IDF directly
            (groq_news_score  * 0.35)     # Groq credibility judgment
        )

        # Group B — Source & Corroboration (2 signals)
        source_score_group = round(
            (source_score            * 0.45) +  # Domain trust
            ((crosscheck_score or 0) * 0.55)    # Crosscheck URLs
        )

        # Final fusion — Content + Source only, no facts
        if serper_results_count == 0 and article_age_hours is not None and article_age_hours < 6:
            final_score  = round((content_score * 0.65) + (source_score_group * 0.35))
            formula_used = "url_serper_fallback"
        else:
            final_score  = round((content_score * 0.65) + (source_score_group * 0.35))
            formula_used = "url_standard"

        logger.info(
            f"[SCORER] URL mode | formula={formula_used} | "
            f"content={content_score} (nlp={nlp_score} roberta={ml_roberta_score} "
            f"lr={ml_lr_score} groq={groq_news_score}) | "
            f"source={source_score_group} (domain={source_score} crosscheck={crosscheck_score})"
        )

    # ── TEXT/CLAIM INPUT — Content + Source + Facts ──────────────────────

    else:
        text_only_formula = True

        # Group A — Content (same 4 signals)
        content_score = round(
            (nlp_score        * 0.20) +
            (ml_roberta_score * 0.30) +
            (ml_lr_score      * 0.15) +
            (groq_news_score  * 0.35)
        )

        # Group B — Source (crosscheck only, no domain trust)
        source_score_group = crosscheck_score or 0

        # Group C — Fact Verification (4 signals)
        facts_score = round(
            (groq_fact_score  * 0.55) +
            (wikidata_score   * 0.20) +
            (fever_score      * 0.15) +
            (gfactcheck_score * 0.10)
        )

        if crosscheck_score is None:
            final_score  = round((content_score * 0.60) + (facts_score * 0.40))
            formula_used = "text_only_fallback"
        else:
            final_score  = round((content_score * 0.50) + (source_score_group * 0.30) + (facts_score * 0.20))
            formula_used = "text_only"

        logger.info(
            f"[SCORER] TEXT mode | formula={formula_used} | "
            f"content={content_score} | source={source_score_group} | facts={facts_score} | "
            f"groq_fact={groq_fact_score} | wikidata={wikidata_score} | "
            f"fever={fever_score} | gfactcheck={gfactcheck_score}"
        )

    use_fallback = "fallback" in formula_used

    # ── 3. Override Rules ───────────────────────────────────────────────
    override_applied = None
    score_override_reason = None

    gfact_details = factcheck_result.get("gfactcheck_details", {})
    gfact_verdict = gfact_details.get("verdict") or ""
    gfact_similarity = gfact_details.get("similarity", 0.0)

    # Groq News Check overrides
    gn_score        = groq_news_result.get("score")
    if gn_score is None: gn_score = 50
    gn_misinfo      = groq_news_result.get("misinformation_pattern", False)
    gn_plausibility = groq_news_result.get("plausibility", "medium")
    gn_corroboration = groq_news_result.get("news_corroboration", "not_found")

    if gn_score <= 30 and (gn_plausibility in ["low", "medium"] or gn_corroboration == "contradicted"):
        if final_score > 35:
            final_score = min(final_score, 35)
            override_applied = True
            score_override_reason = "Semantic Analysis: Matches known misinformation/conspiracy pattern or contradicted by news"
            logger.info(f"[SCORER] Groq News override — capped at 35 (score={gn_score})")

    elif not gn_misinfo and (gn_plausibility in ["high", "medium"] or gn_corroboration == "confirmed") and gn_score >= 80:
        if final_score < 75:
            final_score = max(final_score, 75)
            override_applied = True
            score_override_reason = "Semantic Analysis: Highly credible and factual"
            logger.info(f"[SCORER] Groq News override — floored at 75 (score={gn_score})")

    # Groq Fact Check overrides
    groq_verdict    = groq_fact_result.get("verdict", "unverifiable")
    groq_confidence = groq_fact_result.get("confidence", "low")
    groq_score      = groq_fact_result.get("score")
    if groq_score is None: groq_score = 50

    if groq_confidence in ["high", "medium"]:
        if groq_score <= 25:
            # Groq is highly confident this is false
            if final_score > 35:
                final_score = min(final_score, 35)
                override_applied = True
                score_override_reason = "AI Logic Check: claim is false with high confidence"
                logger.info(f"[SCORER] Groq override — capped at 35 (groq_score={groq_score})")

        elif groq_score >= 80:
            # Groq is highly confident this is true
            if final_score < 75:
                final_score = max(final_score, 75)
                override_applied = True
                score_override_reason = "AI Logic Check: claim is verified true with high confidence"
                logger.info(f"[SCORER] Groq override — floored at 75 (groq_score={groq_score})")

    # Wikidata overrides (Only apply to text/claim inputs)
    if text_only_formula:
        if wikidata_score >= 75:
            final_score = min(final_score + 5, 100)
            override_applied = True
            score_override_reason = "Wikidata confirms entity predicates (+5)"

    final_score = max(0, min(100, final_score))

    # ── Verdict Mapping ─────────────────────────────────────────────────
    if final_score >= 70:
        verdict = "real"
    elif final_score >= 40:
        verdict = "suspicious"
    else:
        verdict = "fake"

    # Adjust Group Scores for UI in Text-Only Mode
    if text_only_formula:
        source_score_group = crosscheck_score or 0

    groups = {
        "content": {
            "score": content_score,
            "sub_signals": {
                "nlp":           nlp_score,
                "roberta":       ml_roberta_score,
                "lr_model":      ml_lr_score,
                "groq_analysis": groq_news_score
            }
        },
        "source": {
            "score": source_score_group,
            "sub_signals": {
                "domain_trust": source_score,
                "crosscheck":   crosscheck_score or 0
            } if input_type == "url" and source_domain else {
                "crosscheck":   crosscheck_score or 0
            },
            "corroborating_sources": crosscheck_sources or [],
        }
    }

    # Only add facts group for text/claim input
    if text_only_formula:
        groups["facts"] = {
            "score": facts_score,
            "sub_signals": {
                "groq_logic": groq_fact_score,
                "wikidata":   wikidata_score,
                "fever":      fever_score,
                "factcheck":  gfactcheck_score
            },
            "factcheck_result": {
                "rating": gfact_verdict if gfact_verdict else None,
                "checker": gfact_details.get("source"),
                "url": gfact_details.get("review_url"),
                "similarity": gfact_similarity
            },
            "wikidata_status": "confirmed" if wikidata_score >= 75 else ("contradicted" if wikidata_score <= 25 else "unverified")
        }

    return {
        "score": final_score,
        "verdict": verdict,
        "override_applied": override_applied,
        "score_override_reason": score_override_reason,
        "crosscheck_fallback": use_fallback,
        "text_only_formula": text_only_formula,
        "formula_used": formula_used,
        "groups": groups
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

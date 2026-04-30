"""
Score fusion and sentence-level scoring.

Final score = (NLP × 0.40) + (Source × 0.35) + (ML × 0.25)

Verdict mapping:
  70–100 → real   (green)
  40–69  → suspicious (amber)
  0–39   → fake   (red)
"""

import nltk


def compute_final_score(nlp_score: int, source_score: int, ml_score: int) -> dict:
    """
    Fuse three signal scores into a final authenticity score and verdict.

    Returns:
        dict with keys: score, verdict
    """
    score = round(nlp_score * 0.40 + source_score * 0.35 + ml_score * 0.25)
    score = max(0, min(100, score))

    if score >= 70:
        verdict = "real"
    elif score >= 40:
        verdict = "suspicious"
    else:
        verdict = "fake"

    return {"score": score, "verdict": verdict}


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

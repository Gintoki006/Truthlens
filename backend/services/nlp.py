"""
NLP signal scoring (weight: 40% of final score).

Three sub-signals:
  1. VADER sentiment polarity → detects sensationalist language
  2. TextBlob subjectivity   → detects emotional bias
  3. Clickbait regex          → detects clickbait patterns

All scores are 0–100 where 100 = most trustworthy / least sensational.
"""

import re

import nltk
from textblob import TextBlob
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

_vader = None


def download_nlp_resources():
    """Download required NLTK data (run once on startup)."""
    nltk.download("punkt", quiet=True)
    nltk.download("punkt_tab", quiet=True)
    nltk.download("averaged_perceptron_tagger", quiet=True)


def _get_vader():
    global _vader
    if _vader is None:
        _vader = SentimentIntensityAnalyzer()
    return _vader


# ── Clickbait patterns ──────────────────────────────────────────────────────
CLICKBAIT_PATTERNS = [
    r"\byou won't believe\b",
    r"\bshocking\b",
    r"\bbreaking\b",
    r"\bexclusive\b",
    r"\bjust in\b",
    r"\burgent\b",
    r"\b\d+ reasons?\b",
    r"\bthis is why\b",
    r"\bwhat happens next\b",
    r"\binsane\b",
    r"\bmind[- ]?blowing\b",
    r"\bunbelievable\b",
    r"\bwill blow your mind\b",
    r"\bhere'?s what\b",
    r"\beveryone is talking about\b",
    r"\byou need to see\b",
    r"\b[A-Z]{5,}\b",  # excessive caps (5+ letter words in ALL CAPS)
    r"[!?]{2,}",  # multiple exclamation/question marks
]


def _score_sentiment(text: str) -> float:
    """
    VADER compound sentiment: highly polarised text (positive OR negative extreme)
    suggests sensationalist language.
    Score: 0 (very sensational) → 100 (neutral/balanced).
    """
    vader = _get_vader()
    compound = vader.polarity_scores(text)["compound"]
    # compound ranges from -1 to +1; extreme values → low score
    neutrality = 1.0 - abs(compound)
    return round(neutrality * 100)


def _score_subjectivity(text: str) -> float:
    """
    TextBlob subjectivity: 0.0 (objective) → 1.0 (subjective).
    Score: 0 (very subjective) → 100 (very objective).
    """
    blob = TextBlob(text)
    objectivity = 1.0 - blob.sentiment.subjectivity
    return round(objectivity * 100)


def _score_clickbait(text: str) -> float:
    """
    Count clickbait pattern matches.
    Score: 100 (no matches) → 0 (many matches).
    """
    text_lower = text.lower()
    matches = sum(
        1 for pattern in CLICKBAIT_PATTERNS if re.search(pattern, text_lower)
    )
    # Penalise: each match removes ~12 points, floor at 0
    score = max(0, 100 - matches * 12)
    return score


def compute_nlp_score(text: str) -> dict:
    """
    Compute the combined NLP signal score from three sub-signals.

    Returns:
        dict with keys: score, sentiment_score, subjectivity_score, clickbait_score
    """
    sentiment = _score_sentiment(text)
    subjectivity = _score_subjectivity(text)
    clickbait = _score_clickbait(text)

    # Weighted combination of sub-signals
    combined = round(sentiment * 0.35 + subjectivity * 0.35 + clickbait * 0.30)

    return {
        "score": max(0, min(100, combined)),
        "sentiment_score": sentiment,
        "subjectivity_score": subjectivity,
        "clickbait_score": clickbait,
    }

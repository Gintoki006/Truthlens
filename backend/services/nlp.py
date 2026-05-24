"""
NLP signal scoring (weight: 25% of final score).

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
    
    # Factual statements can have mild sentiment (e.g., "successfully landed").
    # We only penalize if the sentiment is extremely polarized (abs > 0.6).
    abs_comp = abs(compound)
    if abs_comp < 0.6:
        return 100.0
        
    neutrality = 1.0 - ((abs_comp - 0.6) / 0.4)
    return round(max(0.0, neutrality * 100))


def _score_subjectivity(text: str) -> float:
    """
    TextBlob subjectivity: 0.0 (objective) → 1.0 (subjective).
    Score: 0 (very subjective) → 100 (very objective).
    """
    blob = TextBlob(text)
    subj = blob.sentiment.subjectivity
    
    # TextBlob often flags normal adjectives as highly subjective.
    # We only penalize if subjectivity is extremely high (e.g., > 0.85).
    if subj < 0.85:
        return 100.0
        
    objectivity = 1.0 - ((subj - 0.85) / 0.15)
    return round(max(0.0, objectivity * 100))


def _score_clickbait(text: str) -> float:
    """
    Count clickbait pattern matches.
    Score: 100 (no matches) → 0 (many matches).
    """
    text_lower = text.lower()
    matches = sum(
        1 for pattern in CLICKBAIT_PATTERNS if re.search(pattern, text_lower)
    )
    
    if matches == 0:
        return 100.0
    elif matches == 1:
        return 70.0  # 30% clickbait penalty
    else:
        return max(0.0, 100.0 - (matches * 25.0))


def _detect_english(text: str) -> bool:
    """
    Simple English language detection heuristic.
    Checks the ratio of common English function words in the text.
    Returns True if the text is likely English.
    """
    ENGLISH_WORDS = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "shall",
        "should", "may", "might", "can", "could", "of", "in", "to", "for",
        "with", "on", "at", "from", "by", "about", "as", "into", "through",
        "and", "but", "or", "not", "no", "this", "that", "it", "he", "she",
        "they", "we", "you", "i", "my", "your", "his", "her", "its", "our",
        "their", "what", "which", "who", "when", "where", "how", "if", "then",
    }
    words = re.findall(r"[a-z]+", text.lower())
    if len(words) < 10:
        return True  # Too short to detect, assume English
    english_count = sum(1 for w in words if w in ENGLISH_WORDS)
    ratio = english_count / len(words)
    return ratio >= 0.15  # At least 15% function words → likely English


def compute_nlp_score(text: str) -> dict:
    """
    Compute the combined NLP signal score from three sub-signals.
    Also detects language and flags non-English articles.

    Returns:
        dict with keys: score, sentiment_score, subjectivity_score,
                        clickbait_score, is_english, confidence_warning
    """
    sentiment = _score_sentiment(text)
    subjectivity = _score_subjectivity(text)
    clickbait = _score_clickbait(text)
    is_english = _detect_english(text)

    # Weighted combination of sub-signals
    combined = round(sentiment * 0.35 + subjectivity * 0.35 + clickbait * 0.30)

    result = {
        "score": max(0, min(100, combined)),
        "sentiment_score": sentiment,
        "subjectivity_score": subjectivity,
        "clickbait_score": clickbait,
        "is_english": is_english,
        "confidence_warning": None,
    }

    if not is_english:
        result["confidence_warning"] = (
            "This article appears to be in a non-English language. "
            "NLP and ML models are English-only in v1.0 — results may be less accurate."
        )

    return result

"""
Signal 5B — Google Fact Check Tools API (weight: 35% within Signal 5).

Queries Google's index of professional fact-checker verdicts (PolitiFact,
Snopes, AFP, BOOM Live, etc.) to check if a claim has already been verified
by a trusted fact-checking organization.

Free tier: 10,000 queries/day — far more than sufficient for competition.

Scoring:
  Matched + truth rating   → 85–95
  Matched + false rating   → 5–25
  Matched + mixed rating   → 55–65
  No match found           → 50 (neutral)
"""

import os
import logging
from difflib import SequenceMatcher

import httpx

logger = logging.getLogger(__name__)

FACTCHECK_URL = "https://factchecktools.googleapis.com/v1alpha1/claims:search"

# Rating-to-score mapping for various fact-checker styles.
# Keys are lowercase substrings checked against the textualRating field.
# Ordered from most specific to least specific within each category.
TRUTH_RATINGS = {
    "true": 95,
    "mostly true": 85,
    "correct": 95,
    "accurate": 90,
    "verified": 90,
    "confirmed": 90,
    "partly true": 65,
    "half true": 60,
    "mixture": 55,
    "partly correct": 65,
    "partially true": 65,
}

FALSE_RATINGS = {
    "pants on fire": 5,
    "false": 10,
    "mostly false": 20,
    "fake": 10,
    "incorrect": 15,
    "misleading": 25,
    "manipulated": 15,
    "fabricated": 5,
    "hoax": 5,
    "scam": 10,
    "no evidence": 20,
    "unproven": 30,
    "distorts the facts": 20,
}


def _rating_to_score(rating: str) -> int:
    """
    Convert a fact-checker's textual rating to a numeric score (0–100).

    Checks truth ratings first (more specific matches), then false ratings.
    Returns 50 (neutral) if no known pattern matches.
    """
    rating_lower = rating.lower().strip()

    # Check truth ratings (sorted by specificity — longer matches first)
    for keyword in sorted(TRUTH_RATINGS.keys(), key=len, reverse=True):
        if keyword in rating_lower:
            return TRUTH_RATINGS[keyword]

    # Check false ratings
    for keyword in sorted(FALSE_RATINGS.keys(), key=len, reverse=True):
        if keyword in rating_lower:
            return FALSE_RATINGS[keyword]

    # Unknown rating style — return neutral
    return 50


def compute_factcheck_score(claim: str) -> dict:
    """
    Query Google Fact Check Tools API for a given claim.

    Args:
        claim: The claim or headline to check (truncated to 200 chars).

    Returns:
        dict with keys: score, verdict, source, claim_reviewed, raw_response
    """
    api_key = os.getenv("GOOGLE_FACTCHECK_API_KEY")

    if not api_key or api_key.strip() == "":
        logger.warning("Google Fact Check API: No API key configured — returning neutral score")
        return {
            "score": 50,
            "verdict": None,
            "source": None,
            "claim_reviewed": None,
            "available": False,
        }

    query = claim[:200].strip() if claim else ""
    if not query:
        return {
            "score": 50,
            "verdict": None,
            "source": None,
            "claim_reviewed": None,
            "available": True,
        }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                FACTCHECK_URL,
                params={"query": query, "key": api_key, "languageCode": "en"},
            )
            resp.raise_for_status()

        data = resp.json()
        claims = data.get("claims", [])

        if not claims:
            # No fact-checker has reviewed this claim — neutral
            return {
                "score": 50,
                "verdict": None,
                "source": None,
                "claim_reviewed": None,
                "available": True,
            }

        # Find the most relevant claim using similarity matching.
        # The API often returns tangentially related fact-checks (e.g. a debunking
        # of a DIFFERENT claim about the same topic), so we filter by similarity.
        best_match = None
        best_similarity = 0.0
        query_lower = query.lower().strip()

        for c in claims:
            claim_reviewed = c.get("text", "")
            if not claim_reviewed:
                continue

            # Compute similarity between our claim and the reviewed claim
            similarity = SequenceMatcher(
                None, query_lower, claim_reviewed.lower().strip()
            ).ratio()

            if similarity > best_similarity:
                best_similarity = similarity
                best_match = c

        # Reject matches below 72% similarity — they're about a different claim
        if best_match is None or best_similarity < 0.72:
            logger.info(
                f"Google Fact Check: Found {len(claims)} result(s) but none matched "
                f"(best similarity: {best_similarity:.0%}). Returning neutral."
            )
            return {
                "score": 50,
                "verdict": None,
                "source": None,
                "claim_reviewed": claims[0].get("text", "") if claims else None,
                "similarity": round(best_similarity, 2),
                "available": True,
            }

        claim_reviewed = best_match.get("text", "")
        reviews = best_match.get("claimReview", [])
        if not reviews:
            return {
                "score": 50,
                "verdict": None,
                "source": None,
                "claim_reviewed": claim_reviewed,
                "similarity": round(best_similarity, 2),
                "available": True,
            }

        review = reviews[0]
        textual_rating = review.get("textualRating", "")
        publisher = review.get("publisher", {})
        publisher_name = publisher.get("name", "Unknown")
        review_url = review.get("url", "")

        score = _rating_to_score(textual_rating)

        return {
            "score": score,
            "verdict": textual_rating,
            "source": publisher_name,
            "claim_reviewed": claim_reviewed,
            "review_url": review_url,
            "similarity": round(best_similarity, 2),
            "available": True,
        }

    except httpx.HTTPStatusError as e:
        logger.error(f"Google Fact Check API HTTP error: {e.response.status_code} — {e}")
        return {
            "score": 50,
            "verdict": None,
            "source": None,
            "claim_reviewed": None,
            "available": False,
            "error": f"HTTP {e.response.status_code}",
        }
    except Exception as e:
        logger.error(f"Google Fact Check API error: {e}")
        return {
            "score": 50,
            "verdict": None,
            "source": None,
            "claim_reviewed": None,
            "available": False,
            "error": str(e),
        }

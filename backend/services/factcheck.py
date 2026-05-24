"""
Signal 5 — Fact Verification Orchestrator (weight: 20% of final score).

Runs three sub-signals in parallel and fuses them:
  5A — FEVER dataset semantic search   (40% within Signal 5)
  5B — Google Fact Check Tools API      (35% within Signal 5)
  5C — Wikidata entity verification     (25% within Signal 5)

Composite formula:
  fact_score = (fever × 0.40) + (gfactcheck × 0.35) + (wikidata × 0.25)

Handles partial failures gracefully — if one sub-signal errors,
redistributes its weight across the remaining sub-signals.
"""

import logging
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=3)


def compute_fact_score(claim: str) -> dict:
    """
    Run all three fact-verification sub-signals and fuse into a composite score.

    Args:
        claim: The claim or article text to verify.

    Returns:
        dict with keys: score, score_fever, score_gfactcheck, score_wikidata,
                        fever_details, gfactcheck_details, wikidata_details
    """
    from services.fever_index import compute_fever_score
    from services.google_factcheck import compute_factcheck_score
    from services.wikidata_lookup import compute_wikidata_score

    # Define sub-signal weights
    weights = {"fever": 0.40, "gfactcheck": 0.35, "wikidata": 0.25}

    # Run all three sub-signals (synchronously — this function is called
    # inside run_in_executor from the async analyze route)
    fever_result = _safe_call("FEVER", compute_fever_score, claim)
    gfactcheck_result = _safe_call("Google Fact Check", compute_factcheck_score, claim)
    wikidata_result = _safe_call("Wikidata", compute_wikidata_score, claim)

    # Collect scores and handle partial failures
    scores = {}
    failed = []

    if fever_result is not None:
        scores["fever"] = fever_result["score"]
    else:
        failed.append("fever")

    if gfactcheck_result is not None:
        scores["gfactcheck"] = gfactcheck_result["score"]
    else:
        failed.append("gfactcheck")

    if wikidata_result is not None:
        scores["wikidata"] = wikidata_result["score"]
    else:
        failed.append("wikidata")

    # Fuse scores with redistributed weights if any sub-signal failed
    if len(failed) == 3:
        # All sub-signals failed — return neutral
        composite_score = 50
    elif failed:
        # Redistribute failed weights proportionally
        active_weights = {k: v for k, v in weights.items() if k not in failed}
        total_active_weight = sum(active_weights.values())
        normalized = {k: v / total_active_weight for k, v in active_weights.items()}

        composite_score = round(sum(scores[k] * normalized[k] for k in scores))
        logger.warning(
            f"Fact Check: {len(failed)} sub-signal(s) failed ({', '.join(failed)}). "
            f"Using {len(scores)} remaining with redistributed weights."
        )
    else:
        # All sub-signals succeeded — standard fusion
        composite_score = round(
            scores["fever"] * weights["fever"]
            + scores["gfactcheck"] * weights["gfactcheck"]
            + scores["wikidata"] * weights["wikidata"]
        )

    composite_score = max(0, min(100, composite_score))

    return {
        "score": composite_score,
        "score_fever": scores.get("fever", 50),
        "score_gfactcheck": scores.get("gfactcheck", 50),
        "score_wikidata": scores.get("wikidata", 50),
        "fever_details": fever_result or {},
        "gfactcheck_details": gfactcheck_result or {},
        "wikidata_details": wikidata_result or {},
        "sub_signals_failed": failed,
    }


def _safe_call(name: str, func, *args):
    """Call a sub-signal function with error handling."""
    try:
        return func(*args)
    except Exception as e:
        logger.error(f"Fact Check sub-signal '{name}' failed: {e}")
        return None

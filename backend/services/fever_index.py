"""
Signal 5A — FEVER dataset semantic search via Supabase pgvector.

Instead of loading 311k embeddings into RAM locally, we:
  1. Encode only the single query using sentence-transformers (~80MB RAM).
  2. Call the `match_fever_claims` RPC function in Supabase which performs
     a fast cosine similarity search via the HNSW index.

Scoring:
  cosine ≥ 0.85 + SUPPORTS  → 90–95
  cosine ≥ 0.85 + REFUTES   → 5–15
  no match / NOT ENOUGH INFO → 50 (neutral)
"""

import os
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)

# ── Sentence-transformer model (query encoder only — ~80MB RAM) ────────────
_encoder_model = None


def _get_encoder():
    """Lazy-load the sentence-transformers encoder (only the query encoder)."""
    global _encoder_model
    if _encoder_model is None:
        logger.info("[FEVER] Loading sentence-transformers encoder (all-MiniLM-L6-v2)…")
        from sentence_transformers import SentenceTransformer
        _encoder_model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("[FEVER] Encoder loaded (384-dim, ~80MB RAM). No local index required.")
    return _encoder_model


# ── Supabase client ────────────────────────────────────────────────────────
_supabase_client = None


def _get_supabase():
    """Lazy-load the Supabase client."""
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise RuntimeError(
                "[FEVER] SUPABASE_URL or SUPABASE_SERVICE_KEY not set in environment."
            )
        _supabase_client = create_client(url, key)
        logger.info("[FEVER] Supabase client initialised for pgvector queries.")
    return _supabase_client


# ── Public API ─────────────────────────────────────────────────────────────

def load_fever_index():
    """
    No-op — kept for backwards compatibility with startup call in main.py.
    The index lives in Supabase; nothing needs to be loaded locally.
    """
    logger.info(
        "[FEVER] Supabase pgvector mode — no local index to load. "
        "Queries will be served via match_fever_claims() RPC."
    )


def search_fever(query: str, top_k: int = 5) -> list[dict]:
    """
    Find the top-k most similar claims in the Supabase FEVER index.

    Args:
        query: The input claim/text to search for.
        top_k: Number of results to return.

    Returns:
        list of dicts with keys: claim, label, similarity
    """
    if not query.strip():
        return []

    try:
        # Step 1: Encode the query locally (fast — single short text)
        encoder = _get_encoder()
        query_embedding = encoder.encode(
            [query],
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        embedding_list = query_embedding[0].tolist()  # list[float] for JSON

        # Step 2: Query Supabase via RPC
        supabase = _get_supabase()
        response = supabase.rpc(
            "match_fever_claims",
            {
                "query_embedding": embedding_list,
                "match_threshold":  0.50,
                "match_count":      top_k,
            },
        ).execute()

        if not response.data:
            logger.debug(f"[FEVER] No matches found for query: '{query[:80]}'")
            return []

        results = [
            {
                "claim":      row["claim"],
                "label":      row["label"],
                "similarity": float(row["similarity"]),
            }
            for row in response.data
        ]

        logger.debug(
            f"[FEVER] {len(results)} match(es) returned from Supabase "
            f"| top similarity={results[0]['similarity']:.4f} | label={results[0]['label']}"
        )
        return results

    except Exception as e:
        logger.error(f"[FEVER] search_fever() error: {e}")
        return []


def compute_fever_score(claim: str) -> dict:
    """
    Compute the FEVER sub-signal score for a given claim.

    Returns:
        dict with keys: score, top_match, matches
    """
    try:
        matches = search_fever(claim, top_k=3)
    except Exception as e:
        logger.error(f"[FEVER] compute_fever_score() error: {e}")
        return {"score": 50, "top_match": None, "matches": [], "error": str(e)}

    if not matches:
        logger.info(f"[FEVER] No matches — returning neutral score=50")
        return {"score": 50, "top_match": None, "matches": []}

    top = matches[0]
    sim   = top["similarity"]
    label = top["label"]

    logger.info(
        f"[FEVER] query='{claim[:80]}' | "
        f"top_match='{top['claim'][:60]}' | "
        f"label={label} | similarity={sim:.4f}"
    )

    # ── Scoring logic (unchanged from original) ────────────────────────────
    if sim >= 0.85:
        if label == "SUPPORTS":
            score = min(95, round(90 + (sim - 0.85) * 33))
        elif label == "REFUTES":
            score = max(5, round(15 - (sim - 0.85) * 67))
        else:
            # NOT ENOUGH INFO at high similarity
            if sim >= 0.95:
                score = 65
            elif sim >= 0.90:
                score = 60
            else:
                score = 55

    elif sim >= 0.70:
        if label == "SUPPORTS":
            score = round(60 + (sim - 0.70) * 200)   # 60–90
        elif label == "REFUTES":
            score = round(40 - (sim - 0.70) * 167)   # 40–15
        else:
            score = 50

    else:
        score = 10

    logger.info(f"[FEVER] final score={score} | sim={sim:.4f} | label={label}")

    return {
        "score": max(0, min(100, score)),
        "top_match": {
            "claim":      top["claim"],
            "label":      top["label"],
            "similarity": round(sim, 4),
        },
        "matches": [
            {
                "claim":      m["claim"],
                "label":      m["label"],
                "similarity": round(m["similarity"], 4),
            }
            for m in matches
        ],
    }

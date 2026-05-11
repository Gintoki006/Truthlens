"""
Signal 5A — FEVER dataset semantic search (weight: 40% within Signal 5).

Loads the FEVER (Fact Extraction and VERification) dataset at server startup,
builds a semantic search index using sentence-transformers embeddings, and
provides a lookup function to find the most similar pre-labeled claims.

Scoring:
  cosine ≥ 0.85 + SUPPORTS  → 90–95
  cosine ≥ 0.85 + REFUTES   → 5–15
  no match / NOT ENOUGH INFO → 50 (neutral)
"""

import os
import pickle
import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

# Paths for caching pre-computed embeddings to disk
_CACHE_DIR = Path(__file__).parent.parent / "data" / "fever_cache"
_EMBEDDINGS_CACHE = _CACHE_DIR / "fever_embeddings.npy"
_CLAIMS_CACHE = _CACHE_DIR / "fever_claims.pkl"
_LABELS_CACHE = _CACHE_DIR / "fever_labels.pkl"

# Module-level state — loaded once at startup
_model = None
_claims = None
_labels = None
_embeddings = None
_loaded = False

# FEVER label mapping (dataset uses numeric labels)
_LABEL_MAP = {0: "SUPPORTS", 1: "REFUTES", 2: "NOT ENOUGH INFO"}


def _load_model():
    """Load the sentence-transformers model (lightweight, ~80MB)."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("FEVER: sentence-transformers model loaded (all-MiniLM-L6-v2)")
    return _model


def load_fever_index():
    """
    Load or build the FEVER semantic search index.

    On first run: downloads FEVER from HuggingFace, computes embeddings,
    and caches everything to disk. On subsequent runs: loads from cache.
    """
    global _claims, _labels, _embeddings, _loaded

    if _loaded:
        return

    model = _load_model()

    # Try loading from cache first
    if _EMBEDDINGS_CACHE.exists() and _CLAIMS_CACHE.exists() and _LABELS_CACHE.exists():
        logger.info("FEVER: Loading index from disk cache...")
        _embeddings = np.load(str(_EMBEDDINGS_CACHE))
        with open(str(_CLAIMS_CACHE), "rb") as f:
            _claims = pickle.load(f)
        with open(str(_LABELS_CACHE), "rb") as f:
            _labels = pickle.load(f)
        _loaded = True
        logger.info(f"FEVER: Loaded {len(_claims)} claims from cache")
        return

    # Build index from HuggingFace dataset
    logger.info("FEVER: Downloading dataset from HuggingFace (first run, this takes a few minutes)...")
    try:
        from datasets import load_dataset

        dataset = load_dataset("fever/fever", "v1.0", split="train", trust_remote_code=True)

        _claims = dataset["claim"]
        # Map numeric labels to string labels
        _labels = [_LABEL_MAP.get(label, "NOT ENOUGH INFO") for label in dataset["label"]]

        logger.info(f"FEVER: Encoding {len(_claims)} claims (this may take several minutes on first run)...")
        _embeddings = model.encode(
            _claims,
            show_progress_bar=True,
            batch_size=256,
            convert_to_numpy=True,
            normalize_embeddings=True,  # Pre-normalize for fast cosine similarity via dot product
        )

        # Cache to disk
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        np.save(str(_EMBEDDINGS_CACHE), _embeddings)
        with open(str(_CLAIMS_CACHE), "wb") as f:
            pickle.dump(_claims, f)
        with open(str(_LABELS_CACHE), "wb") as f:
            pickle.dump(_labels, f)

        _loaded = True
        logger.info(f"FEVER: Index built and cached ({len(_claims)} claims, {_embeddings.shape} embeddings)")

    except Exception as e:
        logger.error(f"FEVER: Failed to load dataset: {e}")
        # Set empty state so the service doesn't crash — will return neutral scores
        _claims = []
        _labels = []
        _embeddings = np.array([])
        _loaded = True


def search_fever(query: str, top_k: int = 5) -> list[dict]:
    """
    Find the top-k most similar claims in the FEVER dataset.

    Args:
        query: The input claim to search for.
        top_k: Number of results to return.

    Returns:
        list of dicts with keys: claim, label, similarity
    """
    if not _loaded:
        load_fever_index()

    if _embeddings is None or len(_embeddings) == 0 or not query.strip():
        return []

    model = _load_model()

    # Encode query (normalized for cosine sim via dot product)
    query_embedding = model.encode(
        [query],
        convert_to_numpy=True,
        normalize_embeddings=True,
    )

    # Compute cosine similarities (dot product since embeddings are normalized)
    similarities = np.dot(_embeddings, query_embedding.T).flatten()

    # Get top-k indices
    top_indices = np.argsort(similarities)[-top_k:][::-1]

    return [
        {
            "claim": _claims[i],
            "label": _labels[i],
            "similarity": float(similarities[i]),
        }
        for i in top_indices
    ]


def compute_fever_score(claim: str) -> dict:
    """
    Compute the FEVER sub-signal score for a given claim.

    Returns:
        dict with keys: score, top_match, matches
    """
    try:
        matches = search_fever(claim, top_k=3)
    except Exception as e:
        logger.error(f"FEVER search error: {e}")
        return {"score": 50, "top_match": None, "matches": [], "error": str(e)}

    if not matches:
        return {"score": 50, "top_match": None, "matches": []}

    top = matches[0]

    if top["similarity"] >= 0.85:
        if top["label"] == "SUPPORTS":
            # High similarity + SUPPORTS → strong positive signal
            # Scale: 0.85 → 90, 1.0 → 95
            score = min(95, round(90 + (top["similarity"] - 0.85) * 33))
        elif top["label"] == "REFUTES":
            # High similarity + REFUTES → strong negative signal
            # Scale: 0.85 → 15, 1.0 → 5
            score = max(5, round(15 - (top["similarity"] - 0.85) * 67))
        else:
            # NOT ENOUGH INFO — neutral
            score = 50
    elif top["similarity"] >= 0.70:
        # Moderate similarity — partial signal
        if top["label"] == "SUPPORTS":
            score = round(60 + (top["similarity"] - 0.70) * 200)  # 60–90
        elif top["label"] == "REFUTES":
            score = round(40 - (top["similarity"] - 0.70) * 167)  # 40–15
        else:
            score = 50
    else:
        # Low similarity — claim not in FEVER, return neutral
        score = 50

    return {
        "score": max(0, min(100, score)),
        "top_match": {
            "claim": top["claim"],
            "label": top["label"],
            "similarity": round(top["similarity"], 4),
        },
        "matches": [
            {
                "claim": m["claim"],
                "label": m["label"],
                "similarity": round(m["similarity"], 4),
            }
            for m in matches
        ],
    }

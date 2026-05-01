"""
ML ensemble signal (weight: 25% of final score).

Two models run in parallel and their outputs are averaged:
  Model A — RoBERTa transformer (60% weight)
  Model B — TF-IDF + Logistic Regression (40% weight)

Scores are 0–100 where 100 = most likely real.
"""

import os
from pathlib import Path

import joblib

_roberta_pipeline = None
_tfidf_vectorizer = None
_lr_model = None
_models_loaded = False

def _get_models_dir():
    # Try local development path
    path = Path(__file__).parent.parent / "models"
    if path.exists():
        return path
    # Try absolute path often used in Docker/Railway
    path = Path("/app/models")
    if path.exists():
        return path
    # Default back to relative
    return Path(__file__).parent.parent / "models"

MODELS_DIR = _get_models_dir()


def load_models():
    """Load both ML models into memory. Called once on app startup."""
    global _roberta_pipeline, _tfidf_vectorizer, _lr_model, _models_loaded

    # ── Model A: RoBERTa ────────────────────────────────────────────────────
    try:
        model_name = os.getenv("HF_MODEL_NAME", "hamzab/roberta-fake-news-classification").strip()
        if model_name.lower() in ["skip", "none", "false", ""]:
            print("  ⚠️ Skipping RoBERTa model load due to HF_MODEL_NAME setting.")
            _roberta_pipeline = None
        else:
            from transformers import pipeline
            _roberta_pipeline = pipeline("text-classification", model=model_name)
            print(f"  ✅ RoBERTa loaded: {model_name}")
    except Exception as e:
        print(f"  ⚠️ RoBERTa failed to load: {e}")
        _roberta_pipeline = None

    # ── Model B: TF-IDF + Logistic Regression ───────────────────────────────
    tfidf_path = MODELS_DIR / "tfidf_vectorizer.pkl"
    lr_path = MODELS_DIR / "lr_model.pkl"

    if tfidf_path.exists() and lr_path.exists():
        try:
            _tfidf_vectorizer = joblib.load(tfidf_path)
            _lr_model = joblib.load(lr_path)
            print("  ✅ TF-IDF + LR model loaded")
        except Exception as e:
            print(f"  ⚠️ TF-IDF/LR failed to load: {e}")
    else:
        print(f"  ⚠️ Model B files not found at {MODELS_DIR}. Will use RoBERTa only.")

    _models_loaded = True


def _predict_roberta(text: str) -> float | None:
    """
    Run RoBERTa inference.
    Returns a score 0–100 where 100 = likely real.
    """
    if _roberta_pipeline is None:
        return None

    try:
        # Truncate to 512 tokens (RoBERTa max)
        truncated = text[:2048]
        result = _roberta_pipeline(truncated, truncation=True, max_length=512)
        label = result[0]["label"]
        confidence = result[0]["score"]

        # Map labels: REAL → high score, FAKE → low score
        if label.upper() in ("REAL", "LABEL_1", "TRUE"):
            return round(confidence * 100)
        else:
            return round((1 - confidence) * 100)
    except Exception as e:
        print(f"RoBERTa prediction error: {e}")
        return None


def _predict_lr(text: str) -> float | None:
    """
    Run TF-IDF + Logistic Regression inference.
    Returns a score 0–100 where 100 = likely real.
    """
    if _tfidf_vectorizer is None or _lr_model is None:
        return None

    try:
        features = _tfidf_vectorizer.transform([text])
        proba = _lr_model.predict_proba(features)[0]
        # Assuming class 1 = REAL, class 0 = FAKE
        real_proba = proba[1] if len(proba) > 1 else proba[0]
        return round(real_proba * 100)
    except Exception as e:
        print(f"LR prediction error: {e}")
        return None


def compute_ml_score(text: str) -> dict:
    """
    Compute the ML ensemble score from both models.

    Ensemble: ml_score = (roberta × 0.60) + (lr × 0.40)
    Falls back to single-model score if one is unavailable.

    Returns:
        dict with keys: score, roberta_score, lr_score
    """
    roberta_score = _predict_roberta(text)
    lr_score = _predict_lr(text)

    # Ensemble or fallback
    if roberta_score is not None and lr_score is not None:
        ensemble = round(roberta_score * 0.60 + lr_score * 0.40)
    elif roberta_score is not None:
        ensemble = roberta_score
    elif lr_score is not None:
        ensemble = lr_score
    else:
        ensemble = 50  # fallback: neutral

    return {
        "score": max(0, min(100, ensemble)),
        "roberta_score": roberta_score,
        "lr_score": lr_score,
    }

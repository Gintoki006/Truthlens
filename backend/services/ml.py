"""
ML ensemble signal (weight: 25% of final score).

Two models run in parallel and their outputs are averaged:
  Model A — RoBERTa transformer (60% weight)
             Primary:  Hugging Face Inference API
             Fallback: local transformers pipeline (lazy-loaded on first API failure)
  Model B — TF-IDF + Logistic Regression (40% weight) — always runs locally

Scores are 0–100 where 100 = most likely real.
"""

import os
import time
import logging
import requests
from pathlib import Path

import joblib

logger = logging.getLogger(__name__)

# ── Local model state ──────────────────────────────────────────────────────
_tfidf_vectorizer   = None
_lr_model           = None
_models_loaded      = False

# Local RoBERTa pipeline — None until lazy-loaded on first API failure
_local_roberta      = None
_local_roberta_tried = False   # ensures we only attempt the import once

# ── Hugging Face Inference API config ─────────────────────────────────────
_HF_API_TOKEN  = None
_HF_MODEL_NAME = None
_HF_API_URL    = None
_HF_HEADERS    = None

# Retry config for HF cold-start (503 model loading)
_HF_MAX_RETRIES = 3
_HF_RETRY_DELAY = 10  # seconds


def _get_models_dir():
    path = Path(__file__).parent.parent / "models"
    if path.exists():
        return path
    path = Path("/app/models")
    if path.exists():
        return path
    return Path(__file__).parent.parent / "models"


MODELS_DIR = _get_models_dir()


# ── Startup ────────────────────────────────────────────────────────────────

def load_models():
    """
    Configure the HF Inference API and load the local LR model.
    The local RoBERTa pipeline is NOT loaded here — it is lazy-loaded
    only if the HF API call fails at inference time.
    """
    global _tfidf_vectorizer, _lr_model, _models_loaded
    global _HF_API_TOKEN, _HF_MODEL_NAME, _HF_API_URL, _HF_HEADERS

    # ── Model A: RoBERTa — HF Inference API (primary) ─────────────────────
    _HF_API_TOKEN  = os.getenv("HF_API_TOKEN", "").strip()
    _HF_MODEL_NAME = os.getenv("HF_MODEL_NAME", "hamzab/roberta-fake-news-classification").strip()

    if _HF_MODEL_NAME.lower() in ("skip", "none", "false", ""):
        print("  [SKIP] RoBERTa — HF_MODEL_NAME is set to skip. No cloud or local RoBERTa will run.")
        _HF_API_URL = None
        _HF_HEADERS = None
    else:
        _HF_API_URL = f"https://api-inference.huggingface.co/models/{_HF_MODEL_NAME}"
        _HF_HEADERS = {"Content-Type": "application/json"}
        if _HF_API_TOKEN:
            _HF_HEADERS["Authorization"] = f"Bearer {_HF_API_TOKEN}"
            print(f"  [OK]   RoBERTa -> Cloud (HF Inference API) | model={_HF_MODEL_NAME} | auth=YES")
        else:
            print(
                f"  [WARN] RoBERTa -> Cloud (HF Inference API) | model={_HF_MODEL_NAME} | auth=NO\n"
                f"         HF_API_TOKEN is not set — anonymous requests are heavily rate-limited.\n"
                f"         Get a free token at https://huggingface.co/settings/tokens and add\n"
                f"         HF_API_TOKEN=<token> to your .env file.\n"
                f"         If the cloud API fails, the local transformers pipeline will take over."
            )
        print(f"  [INFO] RoBERTa cloud endpoint: {_HF_API_URL}")
        print( "  [INFO] Local RoBERTa pipeline will be lazy-loaded only if the cloud API fails.")

    # ── Model B: TF-IDF + Logistic Regression (always local) ──────────────
    tfidf_path = MODELS_DIR / "tfidf_vectorizer.pkl"
    lr_path    = MODELS_DIR / "lr_model.pkl"

    if tfidf_path.exists() and lr_path.exists():
        try:
            _tfidf_vectorizer = joblib.load(tfidf_path)
            _lr_model         = joblib.load(lr_path)
            print("  [OK]   LR Model -> Local (TF-IDF + Logistic Regression) | status=LOADED")
        except Exception as e:
            print(f"  [WARN] LR Model -> Local | status=FAILED | reason={e}")
    else:
        print(f"  [WARN] LR Model -> Local | status=NOT FOUND | path={MODELS_DIR} | will use RoBERTa only")

    _models_loaded = True


# ── Local RoBERTa (lazy fallback) ──────────────────────────────────────────

def _ensure_local_roberta() -> bool:
    """
    Lazy-load the local transformers pipeline the first time it is needed.
    Returns True if the pipeline is available after this call.
    """
    global _local_roberta, _local_roberta_tried

    if _local_roberta is not None:
        # Already loaded and ready — skip reload
        return True

    if _local_roberta_tried:
        # Load was attempted before and failed — don't hammer it again
        logger.debug("[ML][RoBERTa/Local] Skipping re-load — previous attempt already failed.")
        return False

    _local_roberta_tried = True
    model_name = _HF_MODEL_NAME or os.getenv(
        "HF_MODEL_NAME", "hamzab/roberta-fake-news-classification"
    ).strip()

    logger.warning(
        f"[ML][RoBERTa/Local] Cloud API unavailable — initiating local fallback load.\n"
        f"                    Model : {model_name}\n"
        f"                    Source: HuggingFace model cache (~/.cache/huggingface)\n"
        f"                    Note  : First load will download the model if not cached."
    )

    try:
        from transformers import pipeline  # noqa: PLC0415
        logger.info(f"[ML][RoBERTa/Local] Loading transformers pipeline for '{model_name}'…")
        _local_roberta = pipeline("text-classification", model=model_name)
        logger.info(
            f"[ML][RoBERTa/Local] ✓ Local pipeline loaded successfully | model={model_name} | "
            f"status=READY — will be reused for all subsequent requests."
        )
        return True
    except Exception as e:
        logger.error(
            f"[ML][RoBERTa/Local] ✗ Failed to load local pipeline | model={model_name}\n"
            f"                    Error : {e}\n"
            f"                    Action: RoBERTa score will be skipped; ensemble falls back to LR only."
        )
        _local_roberta = None
        return False


def _predict_roberta_local(text: str) -> float | None:
    """Run inference using the locally loaded transformers pipeline."""
    if not _ensure_local_roberta():
        logger.error("[ML][RoBERTa/Local] Pipeline not available — cannot run local inference.")
        return None
    try:
        logger.debug("[ML][RoBERTa/Local] Running local inference…")
        truncated  = text[:2048]
        result     = _local_roberta(truncated, truncation=True, max_length=512)
        label      = result[0]["label"]
        confidence = result[0]["score"]
        if label.upper() in ("REAL", "LABEL_1", "TRUE"):
            score = round(confidence * 100)
        else:
            score = round((1 - confidence) * 100)
        logger.info(f"[ML][RoBERTa/Local] ✓ Inference complete | label={label} | confidence={confidence:.3f} | score={score}")
        return score
    except Exception as e:
        logger.error(f"[ML][RoBERTa/Local] ✗ Inference error: {e}")
        return None


# ── HF Inference API ───────────────────────────────────────────────────────

def _parse_hf_response(data) -> float | None:
    """Parse the HF API JSON response into a 0-100 score."""
    # HF returns: [[{"label": "REAL", "score": 0.97}, ...]] or flat list
    if isinstance(data, list) and len(data) > 0:
        predictions = data[0] if isinstance(data[0], list) else data
    else:
        logger.error(f"[ML] Unexpected HF API response shape: {data}")
        return None

    real_score = fake_score = None
    for item in predictions:
        label = item.get("label", "").upper()
        score = item.get("score", 0.0)
        if label in ("REAL", "LABEL_1", "TRUE"):
            real_score = score
        elif label in ("FAKE", "LABEL_0", "FALSE"):
            fake_score = score

    if real_score is not None:
        return round(real_score * 100)
    if fake_score is not None:
        return round((1 - fake_score) * 100)

    logger.error(f"[ML] Could not parse labels from HF response: {predictions}")
    return None


def _predict_roberta_api(text: str) -> float | None:
    """
    Call the HF Inference API.
    Returns a 0-100 score, or None if the call fails for any reason.
    """
    if _HF_API_URL is None:
        logger.debug("[ML][RoBERTa/Cloud] HF API URL not configured — skipping cloud call.")
        return None

    logger.debug(f"[ML][RoBERTa/Cloud] Sending request to HF Inference API | model={_HF_MODEL_NAME}")
    payload = {"inputs": text[:2048]}

    for attempt in range(1, _HF_MAX_RETRIES + 1):
        try:
            response = requests.post(
                _HF_API_URL,
                headers=_HF_HEADERS,
                json=payload,
                timeout=30,
            )

            # Model is cold-starting on HF servers
            if response.status_code == 503:
                estimated = response.json().get("estimated_time", _HF_RETRY_DELAY)
                wait = min(float(estimated), _HF_RETRY_DELAY)
                logger.warning(
                    f"[ML][RoBERTa/Cloud] Model is loading on HF servers "
                    f"(attempt {attempt}/{_HF_MAX_RETRIES}) — "
                    f"retrying in {wait:.0f}s… (HF estimated: {estimated:.0f}s)"
                )
                time.sleep(wait)
                continue

            if response.status_code == 401:
                logger.error(
                    "[ML][RoBERTa/Cloud] ✗ 401 Unauthorized — HF_API_TOKEN is missing or invalid.\n"
                    "                    Add a valid token to .env: HF_API_TOKEN=hf_...\n"
                    "                    Get one at https://huggingface.co/settings/tokens"
                )
                return None

            if response.status_code == 429:
                logger.warning(
                    "[ML][RoBERTa/Cloud] ✗ 429 Rate Limited — too many unauthenticated requests.\n"
                    "                    Set HF_API_TOKEN in .env to get a higher quota.\n"
                    "                    Triggering local RoBERTa fallback."
                )
                return None

            response.raise_for_status()
            score = _parse_hf_response(response.json())
            if score is not None:
                logger.info(
                    f"[ML][RoBERTa/Cloud] ✓ Cloud inference successful | "
                    f"model={_HF_MODEL_NAME} | score={score}"
                )
            return score

        except requests.exceptions.Timeout:
            logger.warning(
                f"[ML][RoBERTa/Cloud] ✗ Request timed out (attempt {attempt}/{_HF_MAX_RETRIES}) — "
                f"HF API did not respond within 30s."
            )
        except requests.exceptions.ConnectionError as e:
            logger.error(
                f"[ML][RoBERTa/Cloud] ✗ Connection error — cannot reach HF API.\n"
                f"                    Check internet connectivity. Error: {e}"
            )
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"[ML][RoBERTa/Cloud] ✗ Unexpected request error: {e}")
            return None

    logger.error(
        f"[ML][RoBERTa/Cloud] ✗ All {_HF_MAX_RETRIES} attempts failed — "
        f"cloud API is unavailable. Triggering local fallback."
    )
    return None


# ── Public interface ───────────────────────────────────────────────────────

def _predict_roberta(text: str) -> float | None:
    """
    Primary: HF Inference API.
    Fallback: local transformers pipeline (lazy-loaded on first failure).
    """
    # ── Step 1: Try cloud API ──────────────────────────────────────────────
    score = _predict_roberta_api(text)

    if score is not None:
        return score

    # ── Step 2: Cloud failed — try local pipeline ──────────────────────────
    logger.warning(
        "[ML][RoBERTa] Cloud API returned no score — "
        "switching to LOCAL transformers pipeline as fallback."
    )
    score = _predict_roberta_local(text)

    if score is not None:
        logger.info(
            f"[ML][RoBERTa] ✓ Local fallback succeeded | score={score} | "
            f"source=local-transformers"
        )
    else:
        logger.error(
            "[ML][RoBERTa] ✗ BOTH cloud API and local pipeline failed.\n"
            "               RoBERTa score will be excluded from the ensemble.\n"
            "               Ensemble will rely on LR model only (or neutral 50 if LR also fails)."
        )

    return score


def _predict_lr(text: str) -> float | None:
    """
    Run TF-IDF + Logistic Regression inference (always local).
    Returns a score 0–100 where 100 = likely real.
    """
    if _tfidf_vectorizer is None or _lr_model is None:
        return None
    try:
        features   = _tfidf_vectorizer.transform([text])
        proba      = _lr_model.predict_proba(features)[0]
        real_proba = proba[1] if len(proba) > 1 else proba[0]
        return round(real_proba * 100)
    except Exception as e:
        logger.error(f"[ML] LR prediction error: {e}")
        return None


def compute_ml_score(text: str) -> dict:
    """
    Compute the ML ensemble score from both models.

    Ensemble: ml_score = (roberta × 0.75) + (lr × 0.25)
    Falls back gracefully if one model is unavailable.

    Returns:
        dict with keys: score, roberta_score, lr_score
    """
    logger.info("[ML][Ensemble] Starting ML score computation…")

    roberta_score = _predict_roberta(text)
    lr_score      = _predict_lr(text)

    if roberta_score is not None and lr_score is not None:
        ensemble = round(roberta_score * 0.75 + lr_score * 0.25)
        logger.info(
            f"[ML][Ensemble] ✓ Full ensemble | "
            f"roberta={roberta_score} (×0.75) + lr={lr_score} (×0.25) → score={ensemble}"
        )
    elif roberta_score is not None:
        ensemble = roberta_score
        logger.warning(
            f"[ML][Ensemble] LR model unavailable — using RoBERTa score only | score={ensemble}"
        )
    elif lr_score is not None:
        ensemble = lr_score
        logger.warning(
            f"[ML][Ensemble] RoBERTa unavailable (cloud + local both failed) — "
            f"using LR score only | score={ensemble}"
        )
    else:
        ensemble = 50
        logger.error(
            "[ML][Ensemble] ✗ ALL models failed (RoBERTa cloud, RoBERTa local, LR). "
            "Returning neutral score=50."
        )

    final = max(0, min(100, ensemble))
    logger.info(f"[ML][Ensemble] Final ML score={final} | roberta={roberta_score} | lr={lr_score}")

    return {
        "score":         final,
        "roberta_score": roberta_score,
        "lr_score":      lr_score,
    }

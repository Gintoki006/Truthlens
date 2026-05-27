import logging
from langdetect import detect, detect_langs
from langdetect.lang_detect_exception import LangDetectException

logger = logging.getLogger(__name__)

MIN_DETECTION_LENGTH = 20

def detect_language(text: str) -> str:
    """
    Detects the language of the given text and returns its ISO 639-1 code (e.g., 'en', 'bn', 'hi').
    Skips detection for very short strings and defaults to 'en' on failure.
    """
    if not text or len(text.strip()) < MIN_DETECTION_LENGTH:
        logger.debug(f"Text too short for language detection (len={len(text) if text else 0}). Defaulting to 'en'.")
        return "en"

    try:
        # Detect the primary language
        lang = detect(text)
        
        # Also get probabilities for debugging
        langs = detect_langs(text)
        logger.debug(f"Detected language '{lang}' with probabilities: {langs}")
        
        return lang
    except LangDetectException as e:
        logger.warning(f"Language detection failed: {e}. Defaulting to 'en'.")
        return "en"
    except Exception as e:
        logger.error(f"Unexpected error in language detection: {e}. Defaulting to 'en'.")
        return "en"

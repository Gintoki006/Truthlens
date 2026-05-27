import logging
from transformers import pipeline

logger = logging.getLogger(__name__)

# ISO 639-1 to NLLB-200 token mapping
ISO_TO_NLLB = {
    'bn': 'ben_Beng',
    'hi': 'hin_Deva',
    'ta': 'tam_Taml',
    'te': 'tel_Telu',
    'mr': 'mar_Deva',
    'gu': 'guj_Gujr',
    'kn': 'kan_Knda',
    'ml': 'mal_Mlym',
    'pa': 'pan_Guru',
    'ur': 'urd_Arab',
    'ar': 'arb_Arab',
    'zh': 'zho_Hans',
    'ja': 'jpn_Jpan',
    'ko': 'kor_Hang',
    'fr': 'fra_Latn',
    'de': 'deu_Latn',
    'es': 'spa_Latn',
    'pt': 'por_Latn',
    'ru': 'rus_Cyrl',
    'it': 'ita_Latn'
}

# ISO 639-1 to display name mapping
ISO_TO_DISPLAY_NAME = {
    'bn': 'Bengali',
    'hi': 'Hindi',
    'ta': 'Tamil',
    'te': 'Telugu',
    'mr': 'Marathi',
    'gu': 'Gujarati',
    'kn': 'Kannada',
    'ml': 'Malayalam',
    'pa': 'Punjabi',
    'ur': 'Urdu',
    'ar': 'Arabic',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'it': 'Italian'
}

# Load the translation pipeline at module level (singleton cache)
# This will be loaded when the module is imported.
logger.info("Initializing NLLB-200 translation pipeline. This may take a moment...")
try:
    translation_pipeline = pipeline(
        "translation",
        model="facebook/nllb-200-distilled-600M",
        device="cpu"
    )
    logger.info("NLLB-200 translation pipeline initialized successfully.")
except Exception as e:
    logger.error(f"Failed to initialize NLLB-200 translation pipeline: {e}")
    translation_pipeline = None


def translate_to_english(text: str, source_lang: str) -> str:
    """
    Translates the given text to English using NLLB-200.
    Expects source_lang as ISO 639-1 code (e.g. 'bn', 'hi').
    """
    if not translation_pipeline:
        logger.error("Translation pipeline is not initialized. Returning original text.")
        return text

    nllb_token = ISO_TO_NLLB.get(source_lang)
    if not nllb_token:
        logger.warning(f"Unsupported source language ISO code '{source_lang}'. Returning original text.")
        return text

    try:
        # Perform translation
        result = translation_pipeline(
            text,
            src_lang=nllb_token,
            tgt_lang="eng_Latn",
            max_length=1024
        )
        return result[0]['translation_text']
    except Exception as e:
        logger.error(f"Translation failed for text (lang={source_lang}): {e}")
        return text

def get_language_display_name(iso_code: str) -> str:
    """
    Returns the human-readable display name for an ISO 639-1 language code.
    Defaults to the ISO code uppercase if not found.
    """
    return ISO_TO_DISPLAY_NAME.get(iso_code, iso_code.upper())

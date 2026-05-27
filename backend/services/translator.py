import logging
import textwrap
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

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
logger.info("Initializing NLLB-200 translation model. This may take a moment...")
try:
    model_name = "facebook/nllb-200-distilled-600M"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    logger.info("NLLB-200 translation model initialized successfully.")
except Exception as e:
    logger.error(f"Failed to initialize NLLB-200 translation model: {e}")
    tokenizer = None
    model = None


def translate_to_english(text: str, source_lang: str) -> str:
    """
    Translates the given text to English using NLLB-200.
    Expects source_lang as ISO 639-1 code (e.g. 'bn', 'hi').
    """
    if not model or not tokenizer:
        logger.error("Translation model is not initialized. Returning original text.")
        return text

    nllb_token = ISO_TO_NLLB.get(source_lang)
    if not nllb_token:
        logger.warning(f"Unsupported source language ISO code '{source_lang}'. Returning original text.")
        return text

    try:
        tokenizer.src_lang = nllb_token
        forced_bos = tokenizer.convert_tokens_to_ids("eng_Latn")

        # Chunk the text to avoid max length issues.
        # NLLB handles ~1024 tokens. We'll chunk by ~800 characters to be safe.
        chunks = textwrap.wrap(text, width=800, replace_whitespace=False, drop_whitespace=False, break_long_words=False)
        if not chunks:
            chunks = [text]

        translated_chunks = []
        for chunk in chunks:
            inputs = tokenizer(chunk, return_tensors="pt")
            
            # Use max_new_tokens to prevent the generation from stopping too early
            generated = model.generate(
                **inputs, 
                forced_bos_token_id=forced_bos,
                max_new_tokens=512
            )
            translated = tokenizer.batch_decode(generated, skip_special_tokens=True)[0]
            translated_chunks.append(translated)
            
        return ' '.join(translated_chunks)
    except Exception as e:
        logger.error(f"Translation failed for text (lang={source_lang}): {e}")
        return text

def get_language_display_name(iso_code: str) -> str:
    """
    Returns the human-readable display name for an ISO 639-1 language code.
    Defaults to the ISO code uppercase if not found.
    """
    return ISO_TO_DISPLAY_NAME.get(iso_code, iso_code.upper())

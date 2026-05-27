import os
import base64
import json
import logging
import httpx

logger = logging.getLogger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

EXTRACTION_PROMPT = """You are an expert news analyst and computer vision assistant.
Analyze this image (which could be a screenshot of a news article, social media post, or messaging app forward) and extract its contents and implied claims.

Return ONLY raw JSON with the following keys:
{
  "extracted_text": "The full exact text visible in the image",
  "main_claims": ["Claim 1", "Claim 2"],
  "entities": ["Entity 1", "Entity 2"],
  "emotional_tone": "neutral/angry/fearful/etc",
  "manipulation_tactics": ["clickbait", "appeal to emotion", "none", etc],
  "credibility_red_flags": ["poor grammar", "no source", "suspicious URL", "none"]
}
"""

def get_mime_type(filename: str) -> str:
    ext = filename.split('.')[-1].lower()
    if ext in ['jpg', 'jpeg']:
        return "image/jpeg"
    elif ext == 'png':
        return "image/png"
    elif ext == 'webp':
        return "image/webp"
    elif ext == 'gif':
        return "image/gif"
    return "image/jpeg" # Default

async def analyze_image(image_bytes: bytes, filename: str) -> dict:
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_key:
        raise ValueError("OPENROUTER_API_KEY not configured")

    b64_image = base64.b64encode(image_bytes).decode('utf-8')
    mime_type = get_mime_type(filename)

    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "TruthLens"
    }

    payload = {
        "model": "qwen/qwen2.5-vl-32b-instruct",
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_image}"}},
                {"type": "text", "text": EXTRACTION_PROMPT}
            ]
        }],
        "temperature": 0,
        "response_format": {"type": "json_object"}
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(OPENROUTER_URL, headers=headers, json=payload)
            resp.raise_for_status()
            
            raw = resp.json()["choices"][0]["message"]["content"].strip()
            
            # Clean up potential markdown code blocks
            if raw.startswith("```json"):
                raw = raw[7:]
            elif raw.startswith("```"):
                raw = raw[3:]
                
            if raw.endswith("```"):
                raw = raw[:-3]
                
            result = json.loads(raw.strip())
            logger.info(f"[VISION] Successfully analyzed image {filename}")
            return result

    except Exception as e:
        logger.error(f"[VISION] Failed to analyze image: {e}")
        # Try to extract raw from resp if available and json failed to parse
        try:
            if 'raw' in locals() and raw:
                logger.warning(f"Returning partial/raw text: {raw[:100]}...")
                return {
                    "extracted_text": raw,
                    "main_claims": [],
                    "entities": [],
                    "emotional_tone": "unknown",
                    "manipulation_tactics": [],
                    "credibility_red_flags": [f"Failed to parse JSON: {e}"]
                }
        except Exception:
            pass
            
        raise ValueError(f"Vision API failed: {str(e)}")

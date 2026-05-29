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
  "manipulation_tactics": ["clickbait", "appeal to emotion", "none"],
  "credibility_red_flags": ["list any visual red flags like 'poor grammar', 'no source', 'fake UI elements', etc. Return an empty array [] if none."]
}
"""


async def analyze_image(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    context_text: str | None = None,
) -> dict:
    """
    Analyze an image using OpenRouter vision API.

    Args:
        image_bytes:  Raw bytes of the image.
        mime_type:    MIME type of the image (e.g. 'image/jpeg', 'image/png').
        context_text: Optional surrounding text (e.g. OG description from the page
                      the image was extracted from). Appended to the prompt to
                      give the LLM additional context.

    Returns:
        dict with keys: extracted_text, main_claims, entities,
                        emotional_tone, manipulation_tactics, credibility_red_flags
    """
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_key:
        raise ValueError("OPENROUTER_API_KEY not configured")

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    # Build the text prompt, optionally injecting surrounding page context
    prompt_text = EXTRACTION_PROMPT
    if context_text:
        prompt_text += (
            f"\n\nADDITIONAL CONTEXT (from the page this image was found on):\n{context_text[:500]}"
        )

    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "TruthLens",
    }

    payload = {
        "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{b64_image}"},
                    },
                    {"type": "text", "text": prompt_text},
                ],
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(OPENROUTER_URL, headers=headers, json=payload)
            if not resp.is_success:
                logger.error(f"[VISION] OpenRouter 400 error body: {resp.text}")
            resp.raise_for_status()

            resp_json = resp.json()
            if "choices" not in resp_json:
                raise ValueError(f"OpenRouter returned unexpected response: {resp_json}")

            raw = resp_json["choices"][0]["message"]["content"].strip()

            # Strip potential markdown code fences
            if raw.startswith("```json"):
                raw = raw[7:]
            elif raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]

            result = json.loads(raw.strip())
            logger.info("[VISION] Successfully analyzed image")
            return result

    except Exception as e:
        logger.error(f"[VISION] Failed to analyze image: {e}")
        # Try to surface whatever partial text the model returned
        try:
            if "raw" in locals() and raw:
                logger.warning(f"[VISION] Returning partial/raw text: {raw[:100]}...")
                return {
                    "extracted_text": raw,
                    "main_claims": [],
                    "entities": [],
                    "emotional_tone": "unknown",
                    "manipulation_tactics": [],
                    "credibility_red_flags": [f"Failed to parse JSON: {e}"],
                }
        except Exception:
            pass

        raise ValueError(f"Vision API failed: {str(e)}")

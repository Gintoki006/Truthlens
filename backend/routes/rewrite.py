"""
Debiased rewrite route (F-07).

POST /api/rewrite — rewrites an article in a neutral, balanced tone
using the LLM (Gemini). Returns both the original and rewritten text.
"""

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class RewriteRequest(BaseModel):
    article_text: str
    article_title: str | None = None


class RewriteResponse(BaseModel):
    original: str
    rewritten: str


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_article(request: RewriteRequest):
    """Rewrite an article in a factual, balanced, debiased tone."""
    if not request.article_text or len(request.article_text) < 20:
        raise HTTPException(status_code=400, detail="Article text must be at least 20 characters.")

    # Truncate to avoid token limits
    text = request.article_text[:5000]

    prompt = f"""You are a professional news editor. Rewrite the following article in a strictly neutral, factual, and balanced tone. 

Rules:
- Remove sensationalist, emotional, or clickbait language
- Replace subjective adjectives with neutral ones
- Remove editorializing and opinion statements
- Keep all factual claims and data points intact
- Maintain the original article structure (paragraphs)
- Do NOT add any new information that wasn't in the original
- Do NOT add disclaimers or meta-commentary about the rewrite
- Output ONLY the rewritten article text, nothing else

{f'Title: {request.article_title}' if request.article_title else ''}

Original article:
{text}

Rewritten article:"""

    # Try LLM
    gemini_key = os.getenv("GEMINI_API_KEY")
    if gemini_key and gemini_key != "your-gemini-key":
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-2.5-flash")
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.2,
                )
            )
            rewritten = response.text.strip()
            return RewriteResponse(original=text, rewritten=rewritten)
        except Exception as e:
            print(f"Rewrite LLM error: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate rewrite. Please try again.")
    else:
        raise HTTPException(status_code=503, detail="LLM API key not configured. Debiased rewrite is unavailable.")

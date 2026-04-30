"""
POST /api/analyze — Main analysis endpoint.

Accepts: { url?, text?, user_id? }
Runs all three signals in parallel, fuses scores, generates explanation,
stores result in Supabase, returns full result JSON.
"""

import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()
executor = ThreadPoolExecutor(max_workers=4)


class AnalyzeRequest(BaseModel):
    url: str | None = None
    text: str | None = None
    user_id: str | None = None


class AnalyzeResponse(BaseModel):
    id: str | None = None
    input_type: str
    article_title: str | None = None
    article_body: str | None = None
    source_domain: str | None = None
    score_final: int
    score_nlp: int
    score_source: int
    score_ml: int
    score_roberta: int | None = None
    score_lr: int | None = None
    verdict: str
    explanation: str
    sentences: list[dict] = []
    source_info: dict = {}
    nlp_details: dict = {}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    """Run full multi-signal analysis on an article."""
    if not request.url and not request.text:
        raise HTTPException(status_code=400, detail="Provide either a URL or text to analyze.")

    loop = asyncio.get_event_loop()

    # ── Step 1: Get article content ─────────────────────────────────────
    if request.url:
        from services.scraper import scrape_article

        scraped = await loop.run_in_executor(executor, scrape_article, request.url)
        if not scraped["success"]:
            raise HTTPException(status_code=422, detail=scraped["error"])

        article_title = scraped["title"]
        article_body = scraped["body"]
        source_domain = scraped["source_domain"]
        authors = scraped["authors"]
        input_type = "url"

        if not article_body or len(article_body) < 20:
            raise HTTPException(
                status_code=422,
                detail="Could not extract enough text from this URL. Try pasting the article text directly.",
            )
    else:
        if len(request.text) < 20:
            raise HTTPException(status_code=400, detail="Text must be at least 20 characters.")

        article_title = request.text[:100] + ("..." if len(request.text) > 100 else "")
        article_body = request.text
        source_domain = None
        authors = []
        input_type = "text"

    # ── Step 2: Run all three signals in parallel ───────────────────────
    from services.nlp import compute_nlp_score
    from services.source import compute_source_score
    from services.ml import compute_ml_score

    nlp_future = loop.run_in_executor(executor, compute_nlp_score, article_body)
    source_future = loop.run_in_executor(executor, compute_source_score, source_domain, authors)
    ml_future = loop.run_in_executor(executor, compute_ml_score, article_body)

    nlp_result, source_result, ml_result = await asyncio.gather(
        nlp_future, source_future, ml_future
    )

    # ── Step 3: Fuse scores ─────────────────────────────────────────────
    from services.scorer import compute_final_score, score_sentences

    final = compute_final_score(nlp_result["score"], source_result["score"], ml_result["score"])
    sentences = await loop.run_in_executor(
        executor, score_sentences, article_body, nlp_result["score"]
    )

    # ── Step 4: Generate explanation ────────────────────────────────────
    from services.explainer import generate_explanation

    explanation = await loop.run_in_executor(
        executor,
        generate_explanation,
        article_title,
        source_domain or "N/A",
        final["verdict"],
        final["score"],
        nlp_result["score"],
        source_result["score"],
        ml_result["score"],
        ml_result["roberta_score"],
        ml_result["lr_score"],
        source_result,
        nlp_result,
    )

    # ── Step 5: Store in Supabase ───────────────────────────────────────
    analysis_id = None
    try:
        from supabase import create_client

        supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

        row = {
            "input_type": input_type,
            "raw_input": request.url or request.text,
            "article_title": article_title,
            "article_body": article_body[:10000],  # Truncate for storage
            "source_domain": source_domain,
            "score_final": final["score"],
            "score_nlp": nlp_result["score"],
            "score_source": source_result["score"],
            "score_ml": ml_result["score"],
            "score_roberta": ml_result["roberta_score"],
            "score_lr": ml_result["lr_score"],
            "verdict": final["verdict"],
            "explanation": explanation,
            "sentences": sentences,
        }

        if request.user_id:
            row["user_id"] = request.user_id

        result = supabase.table("analysis").insert(row).execute()
        if result.data:
            analysis_id = result.data[0].get("id")
    except Exception as e:
        print(f"Supabase storage error: {e}")
        # Don't fail the request — just skip storage

    # ── Step 6: Return response ─────────────────────────────────────────
    return AnalyzeResponse(
        id=analysis_id,
        input_type=input_type,
        article_title=article_title,
        article_body=article_body[:5000],
        source_domain=source_domain,
        score_final=final["score"],
        score_nlp=nlp_result["score"],
        score_source=source_result["score"],
        score_ml=ml_result["score"],
        score_roberta=ml_result["roberta_score"],
        score_lr=ml_result["lr_score"],
        verdict=final["verdict"],
        explanation=explanation,
        sentences=sentences,
        source_info=source_result,
        nlp_details=nlp_result,
    )

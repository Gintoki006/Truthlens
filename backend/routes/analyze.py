"""
POST /api/analyze — Main analysis endpoint.

Accepts: { url?, text?, user_id? }
Runs all five signals in parallel, fuses scores, generates explanation,
stores result in Supabase, returns full result JSON.
"""

import os
import asyncio
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter()
executor = ThreadPoolExecutor(max_workers=6)


class AnalyzeRequest(BaseModel):
    url: str | None = None
    text: str | None = None
    user_id: str | None = None


class AnalyzeResponse(BaseModel):
    id: str | None = None
    input_type: str
    original_language: str | None = None
    original_text: str | None = None
    was_translated: bool = False
    article_title: str | None = None
    article_body: str | None = None
    source_domain: str | None = None
    score_final: int
    score_nlp: int
    score_source: int
    score_ml: int
    score_roberta: int | None = None
    score_lr: int | None = None
    score_crosscheck: int | None = None
    score_factcheck: int | None = None
    score_fever: int | None = None
    score_gfactcheck: int | None = None
    score_wikidata: int | None = None
    score_groq_news: int | None = None
    score_groq_fact: int | None = None
    groq_news_details: dict = {}
    groq_fact_details: dict = {}
    crosscheck_sources: list[dict] = []
    crosscheck_fallback: bool = False
    factcheck_details: dict = {}
    formula_used: str | None = None
    article_age_hours: int | None = None
    verdict: str
    explanation: str
    confidence_warning: str | None = None
    sentences: list[dict] = []
    override_applied: bool | None = None
    score_override_reason: str | None = None
    groups: dict = {}
    image_url: str | None = None
    ocr_text: str | None = None
    visual_flags: dict = {}


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: Request):
    content_type = request.headers.get('content-type', '')
    req_url = req_text = req_user_id = image_bytes = image_filename = None
    if 'application/json' in content_type:
        data = await request.json()
        req_url, req_text, req_user_id = data.get('url'), data.get('text'), data.get('user_id')
    elif 'multipart/form-data' in content_type or 'application/x-www-form-urlencoded' in content_type:
        form = await request.form()
        req_url, req_text, req_user_id = form.get('url'), form.get('text'), form.get('user_id')
        image = form.get('image')
        if image and hasattr(image, 'filename') and image.filename:
            image_bytes, image_filename = await image.read(), image.filename
    return await process_analysis(req_url, req_text, req_user_id, image_bytes, image_filename)

async def process_analysis(req_url: str | None, req_text: str | None, req_user_id: str | None, image_bytes: bytes | None = None, image_filename: str | None = None) -> AnalyzeResponse:
    if not req_url and not req_text and not image_bytes:
        raise HTTPException(status_code=400, detail="Provide either a URL, text, or image to analyze.")

    loop = asyncio.get_event_loop()

    # ── Step 1: Get article content ─────────────────────────────────────
    publish_date = None
    image_url = None
    ocr_text = None
    visual_flags = {}

    if image_bytes:
        from services.vision import analyze_image
        from services.storage import upload_image_to_storage
        
        input_type = "image"
        # Run vision and storage concurrently
        image_url_task = asyncio.create_task(upload_image_to_storage(image_bytes, image_filename))
        vision_task = asyncio.create_task(analyze_image(image_bytes, image_filename))
        
        image_url, vision_result = await asyncio.gather(image_url_task, vision_task)
        
        ocr_text = vision_result.get("extracted_text", "")
        visual_flags = vision_result
        
        claims = vision_result.get("main_claims", [])
        article_body = " ".join(claims) if claims else ocr_text
        
        if claims:
            article_title = claims[0][:100] + ("..." if len(claims[0]) > 100 else "")
        elif ocr_text:
            article_title = ocr_text[:100] + ("..." if len(ocr_text) > 100 else "")
        else:
            article_title = "Screenshot Analysis"
        source_domain = None
        authors = []
        
        if not article_body or len(article_body) < 10:
            raise HTTPException(status_code=422, detail="Could not extract sufficient text or claims from the image.")
            
    elif req_url:
        from services.scraper import scrape_article

        scraped = await loop.run_in_executor(executor, scrape_article, req_url)
        if not scraped["success"]:
            raise HTTPException(status_code=422, detail=scraped["error"])

        article_title = scraped["title"]
        article_body = scraped["body"]
        source_domain = scraped["source_domain"]
        authors = scraped["authors"]
        publish_date = scraped.get("publish_date")
        input_type = "url"

        if not article_body or len(article_body) < 20:
            raise HTTPException(
                status_code=422,
                detail="Could not extract enough text from this URL. Try pasting the article text directly.",
            )
    else:
        if len(req_text) < 20:
            raise HTTPException(status_code=400, detail="Text must be at least 20 characters.")

        article_title = req_text[:100] + ("..." if len(req_text) > 100 else "")
        article_body = req_text
        source_domain = None
        authors = []
        input_type = "text"

    # ── Compute article age ─────────────────────────────────────────────
    article_age_hours = None
    if publish_date:
        try:
            if isinstance(publish_date, str):
                publish_date = datetime.fromisoformat(publish_date)
            if publish_date.tzinfo is None:
                publish_date = publish_date.replace(tzinfo=timezone.utc)
            delta = datetime.now(timezone.utc) - publish_date
            article_age_hours = max(0, int(delta.total_seconds() / 3600))
        except Exception:
            article_age_hours = None

    # ── Step 1.5: Language Detection and Translation ────────────────────
    from services.language import detect_language
    from services.translator import translate_to_english

    original_text = article_body
    original_language = None
    was_translated = False

    if article_body:
        lang = detect_language(article_body)
        if lang != "en":
            article_body = translate_to_english(article_body, source_lang=lang)
            
            # If text input, re-derive title from the translated English text
            if input_type == "text":
                article_title = article_body[:100] + ("..." if len(article_body) > 100 else "")
            # If URL input, translate the extracted headline
            elif article_title:
                article_title = translate_to_english(article_title, source_lang=lang)
                
            original_language = lang
            was_translated = True

    # ── Step 2: Run all five signals in parallel ────────────────────────
    from services.nlp import compute_nlp_score
    from services.source import compute_source_score
    from services.ml import compute_ml_score
    from services.crosscheck import crosscheck
    from services.factcheck import compute_fact_score
    from services.groq_news_check import groq_news_check
    from services.groq_fact_check import groq_fact_check

    # Use the article title if available and not a generic placeholder, else fallback to body.
    search_query = article_title if article_title and article_title != "Screenshot Analysis" else article_body[:120]
    
    try:
        nlp_future = loop.run_in_executor(executor, compute_nlp_score, article_body)
        source_future = loop.run_in_executor(executor, compute_source_score, source_domain, authors)
        ml_future = loop.run_in_executor(executor, compute_ml_score, article_body)
        crosscheck_future = asyncio.create_task(crosscheck(search_query, input_type == "text"))
        groq_news_future = asyncio.create_task(groq_news_check(search_query))
        factcheck_future = loop.run_in_executor(executor, compute_fact_score, article_body[:500])
        groq_fact_future = asyncio.create_task(groq_fact_check(search_query))

        nlp_result, source_result, ml_result, crosscheck_result, factcheck_result, groq_news_result, groq_fact_result = await asyncio.gather(
            nlp_future, source_future, ml_future, crosscheck_future, factcheck_future, groq_news_future, groq_fact_future
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Analysis Error: {str(e)}")

    # ── Step 3: Fuse scores ─────────────────────────────────────────────
    from services.scorer import compute_final_score, score_sentences

    final = compute_final_score(
        nlp_score=nlp_result["score"],
        source_score=source_result["score"],
        ml_score=ml_result["score"],
        ml_roberta_score=ml_result["roberta_score"],
        ml_lr_score=ml_result["lr_score"],
        crosscheck_score=crosscheck_result["crosscheck_score"],
        crosscheck_sources=crosscheck_result["corroborating_sources"],
        factcheck_result=factcheck_result,
        groq_news_result=groq_news_result,
        groq_fact_result=groq_fact_result,
        article_age_hours=article_age_hours,
        serper_results_count=crosscheck_result["results_found"],
        input_type=input_type,
        source_domain=source_domain,
    )

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
        final["groups"]["content"]["score"],
        final["groups"]["source"]["score"],
        final["groups"].get("facts", {}).get("score"),
        nlp_result,
        crosscheck_result["crosscheck_score"],
        crosscheck_result["corroborating_sources"],
        final["crosscheck_fallback"],
        factcheck_result,
    )

    # ── Step 5: Store in Supabase ───────────────────────────────────────
    analysis_id = None
    try:
        from supabase import create_client

        supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

        row = {
            "input_type": input_type,
            "raw_input": req_url or req_text or (image_filename if image_bytes else None),
            "original_language": original_language,
            "original_text": original_text[:10000] if original_text else None,
            "was_translated": was_translated,
            "article_title": article_title,
            "article_body": article_body[:10000] if article_body else None,  # Truncate for storage
            "source_domain": source_domain,
            "score_final": final["score"],
            "score_nlp": nlp_result["score"],
            "score_source": source_result["score"],
            "score_ml": ml_result["score"],
            "score_roberta": ml_result["roberta_score"],
            "score_lr": ml_result["lr_score"],
            "score_crosscheck": crosscheck_result["crosscheck_score"],
            "score_factcheck": final.get("groups", {}).get("facts", {}).get("score"),
            "score_fever": factcheck_result.get("score_fever"),
            "score_gfactcheck": factcheck_result.get("score_gfactcheck"),
            "score_wikidata": factcheck_result.get("score_wikidata"),
            "crosscheck_sources": crosscheck_result["corroborating_sources"],
            "crosscheck_fallback": final["crosscheck_fallback"],
            "factcheck_details": {
                "fever": factcheck_result.get("fever_details", {}),
                "gfactcheck": factcheck_result.get("gfactcheck_details", {}),
                "wikidata": factcheck_result.get("wikidata_details", {}),
                "sub_signals_failed": factcheck_result.get("sub_signals_failed", []),
                "score_groq_news": groq_news_result.get("score"),
                "score_groq_fact": groq_fact_result.get("score"),
                "groq_news_details": groq_news_result,
                "groq_fact_details": groq_fact_result,
            },
            "article_age_hours": article_age_hours,
            "verdict": final["verdict"],
            "score_override": final["score"] if final.get("override_applied") else None,
            "score_override_reason": final.get("score_override_reason"),
            "text_only_formula": final.get("text_only_formula", False),
            "explanation": explanation,
            "sentences": sentences,
            "image_url": image_url,
            "ocr_text": ocr_text,
            "visual_flags": visual_flags,
        }

        if req_user_id:
            row["user_id"] = req_user_id

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
        original_language=original_language,
        original_text=original_text[:5000] if original_text else None,
        was_translated=was_translated,
        article_title=article_title,
        article_body=article_body[:5000] if article_body else None,
        source_domain=source_domain,
        score_final=final["score"],
        score_nlp=nlp_result["score"],
        score_source=source_result["score"],
        score_ml=ml_result["score"],
        score_roberta=ml_result["roberta_score"],
        score_lr=ml_result["lr_score"],
        score_crosscheck=crosscheck_result["crosscheck_score"],
        score_factcheck=final.get("groups", {}).get("facts", {}).get("score"),
        score_fever=factcheck_result.get("score_fever"),
        score_gfactcheck=factcheck_result.get("score_gfactcheck"),
        score_wikidata=factcheck_result.get("score_wikidata"),
        score_groq_news=groq_news_result.get("score"),
        score_groq_fact=groq_fact_result.get("score"),
        crosscheck_sources=crosscheck_result["corroborating_sources"],
        crosscheck_fallback=final["crosscheck_fallback"],
        factcheck_details={
            "fever": factcheck_result.get("fever_details", {}),
            "gfactcheck": factcheck_result.get("gfactcheck_details", {}),
            "wikidata": factcheck_result.get("wikidata_details", {}),
            "sub_signals_failed": factcheck_result.get("sub_signals_failed", []),
        },
        groq_news_details=groq_news_result,
        groq_fact_details=groq_fact_result,
        formula_used=final.get("formula_used"),
        article_age_hours=article_age_hours,
        verdict=final["verdict"],
        override_applied=final.get("override_applied"),
        score_override_reason=final.get("score_override_reason"),
        groups=final.get("groups", {}),
        explanation=explanation,
        confidence_warning=nlp_result.get("confidence_warning"),
        sentences=sentences,
        source_info=source_result,
        nlp_details=nlp_result,
        image_url=image_url,
        ocr_text=ocr_text,
        visual_flags=visual_flags,
    )

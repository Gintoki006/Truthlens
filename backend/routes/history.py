"""
GET /api/history — Returns the authenticated user's last 50 analyses.
GET /api/analysis/{id} — Returns a single analysis by ID.
"""

import os

from fastapi import APIRouter, HTTPException, Query
from supabase import create_client

router = APIRouter()


def _get_supabase():
    return create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))


@router.get("/history")
async def get_history(user_id: str = Query(..., description="Authenticated user's UUID")):
    """Return the last 50 analyses for the given user."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required to view history.")

    try:
        supabase = _get_supabase()
        result = (
            supabase.table("analysis")
            .select("id, article_title, verdict, score_final, source_domain, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return {"analyses": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@router.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str):
    """Return a single analysis by ID."""
    try:
        supabase = _get_supabase()
        result = (
            supabase.table("analysis")
            .select("*")
            .eq("id", analysis_id)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Analysis not found.")
        return result.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analysis: {str(e)}")

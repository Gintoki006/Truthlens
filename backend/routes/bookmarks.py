"""
Bookmark routes — save/unsave/list bookmarked analyses.

POST /api/bookmarks       — toggle bookmark on an analysis
GET  /api/bookmarks       — list user's bookmarked analyses
GET  /api/bookmarks/check — check if a specific analysis is bookmarked
"""

import os

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


class BookmarkRequest(BaseModel):
    analysis_id: str
    user_id: str


class BookmarkCheckRequest(BaseModel):
    analysis_id: str
    user_id: str


@router.post("/bookmarks")
async def toggle_bookmark(request: BookmarkRequest):
    """Toggle bookmark on an analysis (add if not exists, remove if exists)."""
    from supabase import create_client

    supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

    # Check if bookmark exists
    existing = (
        supabase.table("bookmarks")
        .select("id")
        .eq("user_id", request.user_id)
        .eq("analysis_id", request.analysis_id)
        .execute()
    )

    if existing.data and len(existing.data) > 0:
        # Remove bookmark
        supabase.table("bookmarks").delete().eq("id", existing.data[0]["id"]).execute()
        return {"bookmarked": False, "message": "Bookmark removed"}
    else:
        # Add bookmark
        supabase.table("bookmarks").insert({
            "user_id": request.user_id,
            "analysis_id": request.analysis_id,
        }).execute()
        return {"bookmarked": True, "message": "Bookmark added"}


@router.get("/bookmarks")
async def list_bookmarks(user_id: str = Query(...)):
    """List all bookmarked analyses for a user."""
    from supabase import create_client

    supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

    result = (
        supabase.table("bookmarks")
        .select("*, analysis(*)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )

    bookmarks = []
    for row in (result.data or []):
        analysis = row.get("analysis", {})
        if analysis:
            bookmarks.append({
                "bookmark_id": row["id"],
                "bookmarked_at": row["created_at"],
                **analysis,
            })

    return {"bookmarks": bookmarks}


@router.get("/bookmarks/check")
async def check_bookmark(
    user_id: str = Query(...),
    analysis_id: str = Query(...),
):
    """Check if a specific analysis is bookmarked by the user."""
    from supabase import create_client

    supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

    result = (
        supabase.table("bookmarks")
        .select("id")
        .eq("user_id", user_id)
        .eq("analysis_id", analysis_id)
        .execute()
    )

    return {"bookmarked": bool(result.data and len(result.data) > 0)}

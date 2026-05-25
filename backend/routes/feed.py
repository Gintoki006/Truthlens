"""
GET /api/feed — Fetch pre-analyzed live news feed.
"""

import os
from fastapi import APIRouter, HTTPException, Query
from supabase import create_client

router = APIRouter()

@router.get("/feed")
async def get_feed(
    category: str = Query(None, description="Filter by category (e.g. politics, tech)"),
    limit: int = Query(20, ge=1, le=50, description="Number of items to return")
):
    """
    Fetch the latest feed items, ordered by publish date or analysis date.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Database connection not configured.")

    try:
        supabase = create_client(supabase_url, supabase_key)
        
        query = supabase.table("feed_item").select("*")
        
        if category and category.lower() != "all":
            query = query.eq("category", category.lower())
            
        # Order by published_at DESC, fallback to analyzed_at if null
        query = query.order("published_at", desc=True, nullsfirst=False)
        query = query.limit(limit)
        
        result = query.execute()
        return {"items": result.data}
    except Exception as e:
        print(f"Error fetching feed: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch live feed.")

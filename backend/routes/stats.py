import os
from fastapi import APIRouter, HTTPException
from supabase import create_client

router = APIRouter()

@router.get("/stats")
async def get_stats():
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Database configuration missing")
        
    try:
        supabase = create_client(supabase_url, supabase_key)
        
        # Get count of analyses (bypass RLS using service key)
        analysis_res = supabase.table("analysis").select("*", count="exact").limit(1).execute()
        analysis_count = analysis_res.count if hasattr(analysis_res, 'count') and analysis_res.count is not None else 0
        
        # Get count of source databases
        source_res = supabase.table("source").select("*", count="exact").limit(1).execute()
        source_count = source_res.count if hasattr(source_res, 'count') and source_res.count is not None else 0
        
        return {
            "articlesAnalyzed": analysis_count,
            "sourceDatabases": source_count
        }
    except Exception as e:
        print(f"Error fetching stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch statistics")

"""
POST /api/vote — Community voting on analysis results.
Accepts: { analysis_id, vote: "up" | "down" }
"""

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client

router = APIRouter()


class VoteRequest(BaseModel):
    analysis_id: str
    vote: str  # "up" or "down"


@router.post("/vote")
async def submit_vote(request: VoteRequest):
    """Submit a community vote on an analysis."""
    if request.vote not in ("up", "down"):
        raise HTTPException(status_code=400, detail="Vote must be 'up' or 'down'.")

    try:
        supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))

        # Fetch current vote counts
        result = (
            supabase.table("analysis")
            .select("votes_up, votes_down")
            .eq("id", request.analysis_id)
            .single()
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Analysis not found.")

        current = result.data
        if request.vote == "up":
            new_count = (current.get("votes_up") or 0) + 1
            update = {"votes_up": new_count}
        else:
            new_count = (current.get("votes_down") or 0) + 1
            update = {"votes_down": new_count}

        supabase.table("analysis").update(update).eq("id", request.analysis_id).execute()

        return {"success": True, "vote": request.vote, "new_count": new_count}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit vote: {str(e)}")

/**
 * API wrapper for FastAPI backend calls.
 * FASTAPI_URL is server-side only — these functions must be called
 * from Server Components or Server Actions.
 */

const API_BASE = process.env.FASTAPI_URL || "http://localhost:8000";

/**
 * Submit an article for analysis.
 * @param {{ url?: string, text?: string, userId?: string }} params
 * @returns {Promise<object>} Full analysis result
 */
export async function analyzeArticle({ url, text, userId }) {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, text, user_id: userId }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Analysis failed" }));
    throw new Error(error.detail || "Analysis failed");
  }

  return res.json();
}

/**
 * Fetch a single analysis result by ID.
 * @param {string} id - Analysis UUID
 * @returns {Promise<object>} Analysis result
 */
export async function getAnalysis(id) {
  const res = await fetch(`${API_BASE}/api/analysis/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Analysis not found");
  }

  return res.json();
}

/**
 * Fetch the current user's analysis history.
 * @param {string} userId - Authenticated user's UUID
 * @returns {Promise<object>} { analyses: [...] }
 */
export async function getHistory(userId) {
  const res = await fetch(
    `${API_BASE}/api/history?user_id=${encodeURIComponent(userId)}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch history");
  }

  return res.json();
}

/**
 * Submit a community vote on an analysis.
 * @param {{ analysisId: string, vote: "up" | "down" }} params
 * @returns {Promise<object>} { success, vote, new_count }
 */
export async function submitVote({ analysisId, vote }) {
  const res = await fetch(`${API_BASE}/api/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis_id: analysisId, vote }),
  });

  if (!res.ok) {
    throw new Error("Failed to submit vote");
  }

  return res.json();
}

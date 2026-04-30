import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

/**
 * Proxy endpoint to forward analyze requests to the FastAPI backend.
 * This keeps the FASTAPI_URL secret (server-side only).
 */
export async function POST(request) {
  try {
    const body = await request.json();

    const res = await fetch(`${FASTAPI_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || "Analysis failed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to connect to analysis service" },
      { status: 502 }
    );
  }
}

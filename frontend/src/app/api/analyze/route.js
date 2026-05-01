import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";

/**
 * Proxy endpoint to forward analyze requests to the FastAPI backend.
 * This uses the NEXT_PUBLIC_FASTAPI_URL environment variable.
 */
export async function POST(request) {
  try {
    const body = await request.json();

    const targetUrl = `${FASTAPI_URL}/api/analyze`;
    console.log("Proxying request to:", targetUrl);

    const res = await fetch(targetUrl, {
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

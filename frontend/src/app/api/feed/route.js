import { NextResponse } from "next/server";

let FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";

// Robust URL check: add protocol if missing
if (FASTAPI_URL && !FASTAPI_URL.startsWith("http")) {
  console.log("⚠️ NEXT_PUBLIC_FASTAPI_URL missing protocol. Prepending https://");
  FASTAPI_URL = `https://${FASTAPI_URL}`;
}

/**
 * Proxy endpoint to forward GET feed requests to the FastAPI backend.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const limit = searchParams.get("limit") || "10";

    // Construct backend URL with query params
    let targetUrl = `${FASTAPI_URL}/api/feed?limit=${limit}`;
    if (category && category !== "ALL" && category !== "all") {
      targetUrl += `&category=${category}`;
    }

    console.log("Proxying request to:", targetUrl);

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || "Failed to fetch feed" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Feed proxy error:", error);
    return NextResponse.json(
      { error: "Failed to connect to backend service" },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";

let FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";
if (FASTAPI_URL && !FASTAPI_URL.startsWith("http")) {
  FASTAPI_URL = `https://${FASTAPI_URL}`;
}

/** Toggle bookmark on an analysis. */
export async function POST(request) {
  try {
    const body = await request.json();
    const res = await fetch(`${FASTAPI_URL}/api/bookmarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.detail || "Bookmark toggle failed" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Bookmark proxy error:", error);
    return NextResponse.json({ error: "Failed to connect to bookmark service" }, { status: 502 });
  }
}

/** List bookmarks for a user, or check if a specific analysis is bookmarked. */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = searchParams.toString();
    const path = searchParams.has("analysis_id") ? "bookmarks/check" : "bookmarks";
    const res = await fetch(`${FASTAPI_URL}/api/${path}?${params}`);
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.detail || "Bookmark fetch failed" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Bookmark proxy error:", error);
    return NextResponse.json({ error: "Failed to connect to bookmark service" }, { status: 502 });
  }
}

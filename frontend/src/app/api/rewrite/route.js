import { NextResponse } from "next/server";

let FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";
if (FASTAPI_URL && !FASTAPI_URL.startsWith("http")) {
  FASTAPI_URL = `https://${FASTAPI_URL}`;
}

/** Proxy POST to /api/rewrite on the FastAPI backend. */
export async function POST(request) {
  try {
    const body = await request.json();
    const res = await fetch(`${FASTAPI_URL}/api/rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.detail || "Rewrite failed" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Rewrite proxy error:", error);
    return NextResponse.json({ error: "Failed to connect to rewrite service" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";

export async function POST(request) {
  try {
    const body = await request.json();
    const res = await fetch(`${FASTAPI_URL}/api/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.detail || "Vote failed" }, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to submit vote" }, { status: 502 });
  }
}

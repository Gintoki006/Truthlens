import { NextResponse } from "next/server";

let FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";

// Robust URL check: add protocol if missing
if (FASTAPI_URL && !FASTAPI_URL.startsWith("http")) {
  console.log("⚠️ NEXT_PUBLIC_FASTAPI_URL missing protocol. Prepending https://");
  FASTAPI_URL = `https://${FASTAPI_URL}`;
}

/**
 * Proxy endpoint to forward analyze requests to the FastAPI backend.
 * This uses the NEXT_PUBLIC_FASTAPI_URL environment variable.
 */
export async function POST(request) {
  try {
    const targetUrl = `${FASTAPI_URL}/api/analyze`;
    console.log("Proxying request to:", targetUrl);
    
    const contentType = request.headers.get("content-type") || "";
    let res;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      res = await fetch(targetUrl, {
        method: "POST",
        body: formData,
      });
    } else {
      const body = await request.json();
      res = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

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

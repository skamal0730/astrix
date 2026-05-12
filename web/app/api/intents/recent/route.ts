import { NextResponse } from "next/server";

function backendBaseUrl() {
  return process.env.BACKEND_API_URL || "http://localhost:3001";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") || "25";
    const response = await fetch(`${backendBaseUrl()}/api/intents/recent?limit=${limit}`, {
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch intents" },
      { status: 500 },
    );
  }
}

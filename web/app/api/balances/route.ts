import { NextResponse } from "next/server";

function backendBaseUrl() {
  return process.env.BACKEND_API_URL || "http://localhost:3001";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    const response = await fetch(`${backendBaseUrl()}/api/balances/${accountId}`, {
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Balance fetch failed" },
      { status: 500 },
    );
  }
}

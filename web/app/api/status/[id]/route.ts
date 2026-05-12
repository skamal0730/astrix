import { NextResponse } from "next/server";

function backendBaseUrl() {
  return process.env.BACKEND_API_URL || "http://localhost:3001";
}

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const response = await fetch(`${backendBaseUrl()}/api/status/${id}`, {
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status fetch failed" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = String(searchParams.get("email") ?? "").trim();

  if (!email) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 },
    );
  }

  try {
    const upstreamUrl = `${getApiBaseUrl()}/api/wishlist/public/by-email?email=${encodeURIComponent(email)}`;
    const response = await fetch(upstreamUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const body = (await response.json()) as unknown;
    return NextResponse.json(body, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach wishlist service" },
      { status: 503 },
    );
  }
}

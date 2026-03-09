import { NextResponse } from "next/server";

import { getAuthToken } from "@/lib/auth-cookie";

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

type CreateWishlistBody = {
  title?: string;
  description?: string | null;
  url?: string | null;
  item_image?: string | null;
  price?: number;
  priority?: number;
  quantity?: number;
  purchased?: boolean;
};

export async function POST(request: Request) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateWishlistBody;

  try {
    body = (await request.json()) as CreateWishlistBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const upstreamUrl = `${getApiBaseUrl()}/api/wishlist`;
    const response = await fetch(upstreamUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as unknown;
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach wishlist service" },
      { status: 503 },
    );
  }
}

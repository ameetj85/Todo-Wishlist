import { NextResponse } from "next/server";

import { getAuthToken } from "@/lib/auth-cookie";

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId: itemIdParam } = await context.params;
  const itemId = Number.parseInt(itemIdParam, 10);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid item_id" }, { status: 400 });
  }

  try {
    const upstreamUrl = `${getApiBaseUrl()}/api/wishlist/${itemId}`;
    const response = await fetch(upstreamUrl, {
      method: "DELETE",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
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

export async function PUT(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemId: itemIdParam } = await context.params;
  const itemId = Number.parseInt(itemIdParam, 10);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid item_id" }, { status: 400 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const upstreamUrl = `${getApiBaseUrl()}/api/wishlist/${itemId}`;
    const response = await fetch(upstreamUrl, {
      method: "PUT",
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

import { NextResponse } from "next/server";

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

type PurchaseBody = {
  email?: string;
  item_id?: number;
  purchased?: boolean;
};

export async function PATCH(request: Request) {
  let body: PurchaseBody;

  try {
    body = (await request.json()) as PurchaseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const itemId = Number(body.item_id);
  const purchased = body.purchased;

  if (
    !email ||
    !Number.isInteger(itemId) ||
    itemId <= 0 ||
    typeof purchased !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Valid email, item_id, and purchased are required" },
      { status: 400 },
    );
  }

  try {
    const upstreamUrl = `${getApiBaseUrl()}/api/wishlist/public/purchased`;
    const response = await fetch(upstreamUrl, {
      method: "PATCH",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, item_id: itemId, purchased }),
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

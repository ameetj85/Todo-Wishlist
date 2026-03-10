"use server";

import { getAuthToken } from "@/lib/auth-cookie";

type AdminWishlistPayload = {
  user_id: string;
  title: string;
  description: string | null;
  url: string | null;
  item_image: string | null;
  price: number;
  quantity: number;
  priority: number;
  purchased: boolean;
  sequence: number;
  created_date: string;
};

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

async function withToken() {
  const token = await getAuthToken();

  if (!token) {
    return { ok: false as const, error: "Unauthorized", token: null };
  }

  return { ok: true as const, token };
}

export async function updateAdminWishlistAction(
  itemId: number,
  payload: Partial<AdminWishlistPayload>,
) {
  const tokenResult = await withToken();
  if (!tokenResult.ok) return { ok: false as const, error: tokenResult.error };

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/admin/wishlists/${itemId}`, {
      method: "PUT",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenResult.token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as
      | { wishlist?: unknown; error?: string }
      | null;

    if (!response.ok) {
      return { ok: false as const, error: body?.error ?? "Unable to update wishlist" };
    }

    return { ok: true as const, wishlist: body?.wishlist };
  } catch {
    return { ok: false as const, error: "Unable to reach admin service" };
  }
}

"use server";

import { getAuthToken } from "@/lib/auth-cookie";

type WishlistPayload = {
  title: string;
  description: string | null;
  url: string | null;
  item_image: string | null;
  price: number;
  quantity: number;
  priority: number;
  purchased: boolean;
  sequence?: number;
};

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

async function getToken() {
  const token = await getAuthToken();

  if (!token) {
    return { ok: false as const, error: "Unauthorized", token: null };
  }

  return { ok: true as const, token };
}

export async function createWishlistItemAction(payload: WishlistPayload) {
  const tokenResult = await getToken();
  if (!tokenResult.ok) return { ok: false as const, error: tokenResult.error };

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/wishlist`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenResult.token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as { item?: unknown; error?: string } | null;

    if (!response.ok) {
      return { ok: false as const, error: body?.error ?? "Unable to save wishlist item" };
    }

    return { ok: true as const, item: body?.item };
  } catch {
    return { ok: false as const, error: "Unable to reach wishlist service" };
  }
}

export async function updateWishlistItemAction(itemId: number, payload: Partial<WishlistPayload> | { sequence: number }) {
  const tokenResult = await getToken();
  if (!tokenResult.ok) return { ok: false as const, error: tokenResult.error };

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/wishlist/${itemId}`, {
      method: "PUT",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenResult.token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as { item?: unknown; error?: string } | null;

    if (!response.ok) {
      return { ok: false as const, error: body?.error ?? "Unable to update wishlist item" };
    }

    return { ok: true as const, item: body?.item };
  } catch {
    return { ok: false as const, error: "Unable to reach wishlist service" };
  }
}

export async function deleteWishlistItemAction(itemId: number) {
  const tokenResult = await getToken();
  if (!tokenResult.ok) return { ok: false as const, error: tokenResult.error };

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/wishlist/${itemId}`, {
      method: "DELETE",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenResult.token}`,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false as const, error: body?.error ?? "Unable to delete wishlist item" };
    }

    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Unable to reach wishlist service" };
  }
}

export async function extractWishlistImageAction(url: string) {
  try {
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    const pageResponse = await fetch(normalizedUrl, {
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!pageResponse.ok) {
      return { ok: true as const, imageBase64: null };
    }

    const html = await pageResponse.text();
    const imageTagMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    const firstImageSource = imageTagMatch?.[1] ?? null;

    if (!firstImageSource) {
      return { ok: true as const, imageBase64: null };
    }

    const resolvedImageUrl = new URL(firstImageSource, pageResponse.url).toString();
    const imageResponse = await fetch(resolvedImageUrl, {
      cache: "no-store",
      headers: {
        Accept: "image/*",
      },
    });

    if (!imageResponse.ok) {
      return { ok: true as const, imageBase64: null };
    }

    const contentType = imageResponse.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return { ok: true as const, imageBase64: null };
    }

    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    return { ok: true as const, imageBase64: imageBuffer.toString("base64") };
  } catch {
    return { ok: true as const, imageBase64: null };
  }
}

export async function togglePublicWishlistPurchasedAction(payload: {
  email: string;
  item_id: number;
  purchased: boolean;
}) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/wishlist/public/purchased`, {
      method: "PATCH",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false as const, error: body?.error ?? "Unable to mark item as purchased" };
    }

    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Unable to reach wishlist service" };
  }
}

export async function lookupPublicWishlistByEmailAction(email: string) {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/wishlist/public/by-email?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const body = (await response.json().catch(() => null)) as
      | { found?: boolean; error?: string }
      | null;

    if (!response.ok) {
      return {
        ok: false as const,
        found: false,
        error: body?.error ?? "Unable to look up wishlist right now.",
      };
    }

    return {
      ok: true as const,
      found: !!body?.found,
      error: undefined,
    };
  } catch {
    return {
      ok: false as const,
      found: false,
      error: "Unable to look up wishlist right now.",
    };
  }
}

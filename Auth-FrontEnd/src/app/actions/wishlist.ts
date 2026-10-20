"use server";

import { getAuthToken } from "@/lib/auth-cookie";
import { compressImageForStorage, extractItemInfoFromPage } from "@/lib/extract-image";

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

export async function extractWishlistItemInfoAction(url: string) {
  const tokenResult = await getToken();
  if (!tokenResult.ok) return { ok: false as const, error: tokenResult.error, title: null, price: null, imageBase64: null };

  try {
    const info = await extractItemInfoFromPage(url);
    return { ok: true as const, ...info };
  } catch {
    return { ok: false as const, error: "Unable to read that page", title: null, price: null, imageBase64: null };
  }
}

export async function compressWishlistImageAction(imageBase64: string) {
  const tokenResult = await getToken();
  if (!tokenResult.ok) return { ok: false as const, error: tokenResult.error, imageBase64: null };

  try {
    const compressed = await compressImageForStorage(Buffer.from(imageBase64, "base64"));
    return { ok: true as const, imageBase64: compressed.toString("base64") };
  } catch {
    return { ok: false as const, error: "Unsupported or corrupt image file", imageBase64: null };
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

export async function createWishlistShareLinkAction() {
  const tokenResult = await getToken();
  if (!tokenResult.ok) return { ok: false as const, error: tokenResult.error };

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/wishlist/share-link`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenResult.token}`,
      },
    });

    const body = (await response.json().catch(() => null)) as { token?: string; error?: string } | null;

    if (!response.ok || !body?.token) {
      return { ok: false as const, error: body?.error ?? "Unable to create share link" };
    }

    return { ok: true as const, token: body.token };
  } catch {
    return { ok: false as const, error: "Unable to reach wishlist service" };
  }
}

export async function toggleSharedWishlistPurchasedAction(payload: {
  token: string;
  item_id: number;
  purchased: boolean;
}) {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/wishlist/public/by-token/purchased`, {
      method: "PATCH",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false as const, error: body?.error ?? "Unable to update purchased status" };
    }

    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Unable to reach wishlist service" };
  }
}

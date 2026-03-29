"use server";

import { getAuthToken } from "@/lib/auth-cookie";
import sharp from "sharp";

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

export async function extractWishlistImageAction(url: string, title?: string) {
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
    
    // Find img tag where alt attribute contains a part of the title
    let firstImageSource: string | null = null;
    
    if (title) {
      const titleLower = title.toLowerCase();
      const altMatches = html.matchAll(/<img[^>]+alt=["']([^"']*)["'][^>]+src=["']([^"']+)["']|<img[^>]+src=["']([^"']+)["'][^>]+alt=["']([^"']*)["']/gi);
      
      for (const match of altMatches) {
        const altText = (match[1] || match[4] || "").toLowerCase();
        const src = match[2] || match[3];
        
        if (altText.includes(titleLower)) {
          firstImageSource = src;
          break;
        }
      }
    }
    
    // Fallback to first image if no title match or no title provided
    if (!firstImageSource) {
      const imageTagMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      firstImageSource = imageTagMatch?.[1] ?? null;
    }

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
    const optimizedBuffer = await optimizeImageBuffer(imageBuffer);
    return { ok: true as const, imageBase64: optimizedBuffer.toString("base64") };
  } catch {
    return { ok: true as const, imageBase64: null };
  }
}

const MAX_IMAGE_BYTES = 700 * 1024;

async function optimizeImageBuffer(inputBuffer: Buffer) {
  let width = 800;
  let quality = 82;
  let attempts = 0;
  let outputBuffer = inputBuffer;

  // Iteratively reduce dimensions/quality until the payload is small enough.
  while (attempts < 6) {
    outputBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (outputBuffer.byteLength <= MAX_IMAGE_BYTES) {
      return outputBuffer;
    }

    width = Math.max(240, Math.floor(width * 0.8));
    quality = Math.max(45, quality - 8);
    attempts += 1;
  }

  return outputBuffer;
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

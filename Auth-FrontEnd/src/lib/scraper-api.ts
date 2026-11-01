import "server-only";

import { createHmac } from "node:crypto";

import type { ExtractedItemInfo } from "@/lib/extract-image";

// Short-lived: each token is minted for a single scrape request.
const SCRAPER_TOKEN_TTL_SECONDS = 5 * 60;
const SCRAPER_REQUEST_TIMEOUT_MS = 60_000;

type ScrapeResponse = {
  title?: string | null;
  price?: number | null;
  /** WebP image, base64-encoded. */
  image?: string | null;
  error?: string;
};

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** HS256 JWT signed with JWT_SECRET, carrying CLIENT_ID as the client_id claim the scraper API requires. */
function createScraperToken() {
  const secret = process.env.JWT_SECRET?.trim();
  const clientId = process.env.CLIENT_ID?.trim();

  if (!secret || !clientId) {
    throw new Error("Missing JWT_SECRET or CLIENT_ID environment variable.");
  }

  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64UrlJson({ alg: "HS256", typ: "JWT" })}.${base64UrlJson({
    client_id: clientId,
    iat: now,
    exp: now + SCRAPER_TOKEN_TTL_SECONDS,
  })}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest("base64url");

  return `${unsigned}.${signature}`;
}

export function isScraperApiConfigured() {
  return !!process.env.URL_SCRAPER_API_URL?.trim();
}

/** Asks the URL scraper API (URL_SCRAPER_API_URL) for the title, price and image of a product page. */
export async function scrapeItemInfo(url: string): Promise<ExtractedItemInfo> {
  const baseUrl = process.env.URL_SCRAPER_API_URL?.trim().replace(/\/$/, "");

  if (!baseUrl) {
    throw new Error("Missing URL_SCRAPER_API_URL environment variable.");
  }

  const response = await fetch(`${baseUrl}/scrape`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${createScraperToken()}`,
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(SCRAPER_REQUEST_TIMEOUT_MS),
  });

  // 502 means the site only returned a bot-check page.
  if (response.status === 502) {
    return { title: null, price: null, imageBase64: null, blocked: true };
  }

  const body = (await response.json().catch(() => null)) as ScrapeResponse | null;

  if (!response.ok || !body) {
    throw new Error(`Scraper API responded ${response.status}: ${body?.error ?? "no body"}`);
  }

  return {
    title: body.title ?? null,
    price: typeof body.price === "number" ? body.price : null,
    imageBase64: body.image ?? null,
    blocked: false,
  };
}

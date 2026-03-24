import "server-only";

import { cookies } from "next/headers";
import { headers } from "next/headers";

export const AUTH_COOKIE_NAME = "auth_token";

function parseExpiresInHours(expiresIn: string | undefined) {
  if (!expiresIn) {
    return 24;
  }

  const numeric = Number.parseFloat(expiresIn.replace("h", ""));

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 24;
  }

  return numeric;
}

function parseBoolean(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return null;
}

async function resolveSecureCookieFlag() {
  const explicit = parseBoolean(process.env.AUTH_COOKIE_SECURE);

  if (explicit !== null) {
    return explicit;
  }

  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto");

  if (forwardedProto) {
    const primaryProto = forwardedProto.split(",")[0]?.trim().toLowerCase();
    if (primaryProto === "https") {
      return true;
    }

    if (primaryProto === "http") {
      return false;
    }
  }

  return process.env.NODE_ENV === "production";
}

export async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function setAuthToken(
  token: string,
  expiresIn: string | undefined,
) {
  const cookieStore = await cookies();
  const maxAgeSeconds = Math.floor(parseExpiresInHours(expiresIn) * 60 * 60);
  const secure = await resolveSecureCookieFlag();
  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    domain: cookieDomain,
    maxAge: maxAgeSeconds,
  });
}

export async function clearAuthToken() {
  const cookieStore = await cookies();
  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;

  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: await resolveSecureCookieFlag(),
    sameSite: "lax",
    path: "/",
    domain: cookieDomain,
    maxAge: 0,
  });
}

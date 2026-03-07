import "server-only";

import { cookies } from "next/headers";

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

  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearAuthToken() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

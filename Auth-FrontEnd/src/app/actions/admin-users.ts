"use server";

import { getAuthToken } from "@/lib/auth-cookie";

type AdminUserPayload = {
  name: string;
  email: string;
  password: string;
  is_verified: boolean;
  is_admin: boolean;
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

export async function createAdminUserAction(payload: AdminUserPayload) {
  const tokenResult = await withToken();
  if (!tokenResult.ok) return { ok: false as const, error: tokenResult.error };

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/admin/users`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenResult.token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as { user?: unknown; error?: string } | null;

    if (!response.ok) {
      return { ok: false as const, error: body?.error ?? "Unable to create user" };
    }

    return { ok: true as const, user: body?.user };
  } catch {
    return { ok: false as const, error: "Unable to reach admin service" };
  }
}

export async function updateAdminUserAction(userId: string, payload: Partial<AdminUserPayload>) {
  const tokenResult = await withToken();
  if (!tokenResult.ok) return { ok: false as const, error: tokenResult.error };

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenResult.token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as { user?: unknown; error?: string } | null;

    if (!response.ok) {
      return { ok: false as const, error: body?.error ?? "Unable to update user" };
    }

    return { ok: true as const, user: body?.user };
  } catch {
    return { ok: false as const, error: "Unable to reach admin service" };
  }
}

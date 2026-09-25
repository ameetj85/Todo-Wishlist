"use server";

import { getAuthToken } from "@/lib/auth-cookie";

export type DataKind = "todos" | "wishlist";
export type ImportMode = "append" | "replace";

const ENDPOINTS: Record<DataKind, { path: string; listKey: "todos" | "items" }> = {
  todos: { path: "/api/todos", listKey: "todos" },
  wishlist: { path: "/api/wishlist", listKey: "items" },
};

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

export async function exportDataAction(kind: DataKind) {
  const token = await getAuthToken();
  if (!token) return { ok: false as const, error: "Unauthorized" };

  const { path, listKey } = ENDPOINTS[kind];

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const body = (await response.json().catch(() => null)) as
      | ({ error?: string } & Record<string, unknown>)
      | null;

    if (!response.ok || !Array.isArray(body?.[listKey])) {
      return { ok: false as const, error: body?.error ?? "Unable to export data" };
    }

    return { ok: true as const, records: body[listKey] as Record<string, unknown>[] };
  } catch {
    return { ok: false as const, error: "Unable to reach the data service" };
  }
}

export async function importDataAction(
  kind: DataKind,
  mode: ImportMode,
  records: Record<string, unknown>[],
) {
  const token = await getAuthToken();
  if (!token) return { ok: false as const, error: "Unauthorized" };

  const { path, listKey } = ENDPOINTS[kind];

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}/import`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mode, [listKey]: records }),
    });

    const body = (await response.json().catch(() => null)) as
      | { imported?: number; removed?: number; error?: string }
      | null;

    if (!response.ok) {
      return { ok: false as const, error: body?.error ?? "Unable to import data" };
    }

    return {
      ok: true as const,
      imported: body?.imported ?? 0,
      removed: body?.removed ?? 0,
    };
  } catch {
    return { ok: false as const, error: "Unable to reach the data service" };
  }
}

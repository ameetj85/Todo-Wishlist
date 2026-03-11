"use server";

import { getAuthToken } from "@/lib/auth-cookie";

type TodoPayload = {
  name: string;
  description: string;
  category: string;
  due_date: string | null;
  completed: boolean;
  remind_me?: boolean;
  reminder_date?: string | null;
  reminder_sent?: boolean;
};

type TodoResult = { ok: true; todo: unknown } | { ok: false; error: string };

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

async function callTodoApi(path: string, method: string, body?: unknown) {
  const token = await getAuthToken();

  if (!token) {
    return { ok: false as const, error: "Unauthorized" };
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; todo?: unknown }
      | null;

    if (!response.ok) {
      return {
        ok: false as const,
        error: payload?.error ?? "Todo request failed",
      };
    }

    return {
      ok: true as const,
      todo: payload?.todo,
    };
  } catch {
    return {
      ok: false as const,
      error: "Unable to reach todo service",
    };
  }
}

export async function createTodoAction(payload: TodoPayload): Promise<TodoResult> {
  return callTodoApi("/api/todos", "POST", payload);
}

export async function updateTodoAction(
  todoId: number,
  payload: TodoPayload,
): Promise<TodoResult> {
  return callTodoApi("/api/todos", "PUT", {
    todo_id: todoId,
    ...payload,
  });
}

export async function deleteTodoAction(
  todoId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await getAuthToken();

  if (!token) {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/todos/${todoId}`, {
      method: "DELETE",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: payload?.error ?? "Unable to delete todo" };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Unable to reach todo service" };
  }
}

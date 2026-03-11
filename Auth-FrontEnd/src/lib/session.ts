import "server-only";

import { getMe, getSessions } from "@/lib/auth-api";
import { getAuthToken } from "@/lib/auth-cookie";

type TodoListResponse = {
  todos?: unknown[];
  error?: string;
};

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

async function getDueTodayOpenTodoCount(token: string): Promise<number> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/todos?due_today_open=1`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return 0;
    }

    const payload = (await response.json().catch(() => null)) as TodoListResponse | null;
    return Array.isArray(payload?.todos) ? payload.todos.length : 0;
  } catch {
    return 0;
  }
}

export async function getSessionData() {
  const token = await getAuthToken();

  if (!token) {
    return { isAuthenticated: false as const, user: null, sessions: [] };
  }

  const me = await getMe(token);

  if (!me.ok) {
    return { isAuthenticated: false as const, user: null, sessions: [] };
  }

  const sessionsResponse = await getSessions(token);
  const dueTodayOpenTodoCount = await getDueTodayOpenTodoCount(token);

  return {
    isAuthenticated: true as const,
    user: me.data.user,
    sessions: sessionsResponse.ok ? sessionsResponse.data.sessions : [],
    dueTodayOpenTodoCount,
  };
}

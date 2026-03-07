import "server-only";

import { getMe, getSessions } from "@/lib/auth-api";
import { getAuthToken } from "@/lib/auth-cookie";

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

  return {
    isAuthenticated: true as const,
    user: me.data.user,
    sessions: sessionsResponse.ok ? sessionsResponse.data.sessions : [],
  };
}

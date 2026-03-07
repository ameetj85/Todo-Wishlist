import "server-only";

type ApiSuccess<TData> = {
  ok: true;
  status: number;
  data: TData;
};

type ApiFailure = {
  ok: false;
  status: number;
  error: string;
};

type ApiResult<TData> = ApiSuccess<TData> | ApiFailure;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  isVerified?: boolean;
};

export type AuthSession = {
  id: string;
  created_at: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  is_current: number;
};

type AuthPayload = {
  message: string;
  token: string;
  expiresIn: string;
  user: AuthUser;
};

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  } else {
    console.log("Using AUTH_API_BASE_URL:", value);
  }

  return value;
}

function buildAuthUrl(path: string) {
  const sanitizedBase = getApiBaseUrl().replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${sanitizedBase}/api/auth${normalizedPath}`;
}

async function parseJson<T>(response: Response): Promise<T | null> {
  const body = await response.text();

  if (!body) {
    return null;
  }

  return JSON.parse(body) as T;
}

async function request<TResponse>(
  path: string,
  init?: RequestInit,
  token?: string,
): Promise<ApiResult<TResponse>> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  console.log("Requesting:", buildAuthUrl(path), init, token);

  try {
    response = await fetch(buildAuthUrl(path), {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      status: 503,
      error: "Unable to reach authentication API",
    };
  }

  let json: (TResponse & { error?: string }) | null = null;

  try {
    json = await parseJson<TResponse & { error?: string }>(response);
  } catch {
    json = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: json?.error ?? "Request failed",
    };
  }

  return {
    ok: true,
    status: response.status,
    data: (json ?? {}) as TResponse,
  };
}

export function signup(payload: {
  name: string;
  email: string;
  password: string;
}) {
  return request<AuthPayload>("/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: { email: string; password: string }) {
  return request<AuthPayload>("/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout(token: string) {
  return request<{ message: string }>("/logout", { method: "POST" }, token);
}

export function forgotPassword(payload: { email: string }) {
  return request<{ message: string }>("/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resetPassword(payload: { token: string; password: string }) {
  return request<{ message: string }>("/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMe(token: string) {
  return request<{ user: AuthUser }>("/me", { method: "GET" }, token);
}

export function getSessions(token: string) {
  return request<{ sessions: AuthSession[] }>(
    "/sessions",
    { method: "GET" },
    token,
  );
}

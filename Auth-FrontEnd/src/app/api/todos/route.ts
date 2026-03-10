import { NextResponse } from "next/server";

import { getAuthToken } from "@/lib/auth-cookie";

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

export async function GET() {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const upstreamUrl = `${getApiBaseUrl()}/api/todos`;
    const response = await fetch(upstreamUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = (await response.json()) as unknown;
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach todo service" },
      { status: 503 },
    );
  }
}

type CreateTodoBody = {
  name?: string;
  description?: string;
  due_date?: string | null;
  category?: string;
  completed?: boolean;
};

export async function POST(request: Request) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateTodoBody;

  try {
    body = (await request.json()) as CreateTodoBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const upstreamUrl = `${getApiBaseUrl()}/api/todos`;
    const response = await fetch(upstreamUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as unknown;
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach todo service" },
      { status: 503 },
    );
  }
}

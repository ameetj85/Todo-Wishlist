import { NextResponse } from "next/server";

import { getAuthToken } from "@/lib/auth-cookie";

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

type UpdateTodoBody = {
  name?: string;
  description?: string;
  due_date?: string | null;
  category?: string;
  completed?: boolean;
};

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ todoId: string }> | { todoId: string } },
) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await Promise.resolve(context.params);
  const todoId = Number.parseInt(resolved.todoId, 10);

  if (!Number.isInteger(todoId) || todoId <= 0) {
    return NextResponse.json({ error: "Invalid todo_id" }, { status: 400 });
  }

  try {
    const upstreamUrl = `${getApiBaseUrl()}/api/todos/${todoId}`;
    const response = await fetch(upstreamUrl, {
      method: "DELETE",
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

export async function PUT(
  request: Request,
  context: { params: Promise<{ todoId: string }> | { todoId: string } },
) {
  const token = await getAuthToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolved = await Promise.resolve(context.params);
  const todoId = Number.parseInt(resolved.todoId, 10);

  if (!Number.isInteger(todoId) || todoId <= 0) {
    return NextResponse.json({ error: "Invalid todo_id" }, { status: 400 });
  }

  let body: UpdateTodoBody;

  try {
    body = (await request.json()) as UpdateTodoBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const upstreamUrl = `${getApiBaseUrl()}/api/todos`;
    const response = await fetch(upstreamUrl, {
      method: "PUT",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        todo_id: todoId,
        ...body,
      }),
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

import { redirect } from "next/navigation";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthToken } from "@/lib/auth-cookie";
import { getSessionData } from "@/lib/session";
import { TodoItemsList } from "@/components/todo-items-list";

type TodoItem = {
  todo_id: number;
  user_id: string;
  name: string;
  description: string;
  due_date: string | null;
  remind_me: boolean;
  reminder_date: string | null;
  reminder_sent: boolean;
  created_date: string;
  category: string;
  completed: boolean;
};

type TodoListResponse = {
  todos: TodoItem[];
  error?: string;
};

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

async function fetchTodos(token: string, dueTodayOpenOnly: boolean): Promise<TodoListResponse> {
  const query = dueTodayOpenOnly ? "?due_today_open=1" : "";

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/todos${query}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = (await response.json()) as TodoListResponse;

    if (!response.ok) {
      return {
        todos: [],
        error: payload.error ?? "Unable to load todos",
      };
    }

    return {
      todos: payload.todos ?? [],
    };
  } catch {
    return {
      todos: [],
      error: "Unable to reach todo service",
    };
  }
}

export const dynamic = "force-dynamic";

export default async function TodoPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await getSessionData();

  if (!session.isAuthenticated) {
    redirect("/login?next=/todo");
  }

  const token = await getAuthToken();

  if (!token) {
    redirect("/login?next=/todo");
  }

  const params = await searchParams;
  const dueTodayOpenOnly = params.filter === "due-today-open";

  const todoList = await fetchTodos(token, dueTodayOpenOnly);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl flex-col gap-5 px-4 py-10 sm:px-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <CardTitle>Todo List</CardTitle>
          <p className="text-sm text-muted-foreground">
            {dueTodayOpenOnly
              ? "Showing only todos due today that are not completed."
              : "Organize your top priorities and keep your day focused."}
          </p>
          {dueTodayOpenOnly ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                Due today
              </span>
              <Link
                href="/todo"
                className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline"
              >
                Show all
              </Link>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="border-t border-border pt-3 text-sm text-muted-foreground">
          {todoList.todos.length} todo{todoList.todos.length === 1 ? "" : "s"}
        </CardContent>
      </Card>

      {todoList.error ? (
        <Card className="border-destructive/30 shadow-sm">
          <CardContent className="py-6 text-sm text-destructive">{todoList.error}</CardContent>
        </Card>
      ) : (
        <TodoItemsList initialTodos={todoList.todos} />
      )}
    </main>
  );
}

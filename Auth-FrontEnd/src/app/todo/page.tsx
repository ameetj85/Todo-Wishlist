import { redirect } from "next/navigation";

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

async function fetchTodos(token: string): Promise<TodoListResponse> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/todos`, {
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

export default async function TodoPage() {
  const session = await getSessionData();

  if (!session.isAuthenticated) {
    redirect("/login?next=/todo");
  }

  const token = await getAuthToken();

  if (!token) {
    redirect("/login?next=/todo");
  }

  const todoList = await fetchTodos(token);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl flex-col gap-5 px-4 py-10 sm:px-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <CardTitle>Todo List</CardTitle>
          <p className="text-sm text-muted-foreground">
            Organize your top priorities and keep your day focused.
          </p>
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

import { redirect } from "next/navigation";

import { AdminConsoleTabs } from "@/components/admin-console-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthToken } from "@/lib/auth-cookie";
import { getSessionData } from "@/lib/session";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string;
};

type AdminTodo = {
  todo_id: number;
  user_id: string;
  user_name: string;
  name: string;
  description: string;
  due_date: string | null;
  created_date: string;
  category: string;
  completed: boolean;
};

type AdminWishlist = {
  item_id: number;
  user_id: string;
  user_name: string;
  title: string;
  price: number;
  quantity: number;
  priority: number;
  purchased: boolean;
  created_date: string;
};

type AdminOverviewResponse = {
  users: AdminUser[];
  todos: AdminTodo[];
  wishlists: AdminWishlist[];
  error?: string;
};

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

async function fetchAdminOverview(token: string): Promise<AdminOverviewResponse> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/admin/overview`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = (await response.json()) as AdminOverviewResponse;

    if (!response.ok) {
      return {
        users: [],
        todos: [],
        wishlists: [],
        error: payload.error ?? "Unable to load admin overview",
      };
    }

    return {
      users: payload.users ?? [],
      todos: payload.todos ?? [],
      wishlists: payload.wishlists ?? [],
    };
  } catch {
    return {
      users: [],
      todos: [],
      wishlists: [],
      error: "Unable to reach admin service",
    };
  }
}

export const dynamic = "force-dynamic";

export default async function AdminConsolePage() {
  const session = await getSessionData();

  if (!session.isAuthenticated || !session.user) {
    redirect("/login?next=/admin-console");
  }

  if (!session.user.isAdmin) {
    redirect("/about");
  }

  const token = await getAuthToken();

  if (!token) {
    redirect("/login?next=/admin-console");
  }

  const overview = await fetchAdminOverview(token);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl flex-col gap-5 px-4 py-10 sm:px-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <CardTitle className="text-2xl font-semibold">Admin Console</CardTitle>
          <CardDescription className="text-muted-foreground">
            Manage users, todos, and wishlists from one place.
          </CardDescription>
        </CardHeader>
        <CardContent className="border-t border-border pt-4">
          {overview.error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {overview.error}
            </div>
          ) : (
            <AdminConsoleTabs
              users={overview.users}
              todos={overview.todos}
              wishlists={overview.wishlists}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

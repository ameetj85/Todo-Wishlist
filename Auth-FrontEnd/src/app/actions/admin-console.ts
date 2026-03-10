"use server";

import { getAuthToken } from "@/lib/auth-cookie";

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string;
};

export type AdminTodo = {
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

export type AdminWishlist = {
  item_id: number;
  user_id: string;
  user_name: string;
  title: string;
  description: string | null;
  url: string | null;
  item_image: string | null;
  price: number;
  quantity: number;
  priority: number;
  purchased: boolean;
  sequence: number;
  created_date: string;
};

export type AdminOverviewResponse = {
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

export async function getAdminOverviewAction(): Promise<AdminOverviewResponse> {
  const token = await getAuthToken();

  if (!token) {
    return {
      users: [],
      todos: [],
      wishlists: [],
      error: "Unauthorized",
    };
  }

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

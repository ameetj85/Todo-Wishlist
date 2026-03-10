import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthToken } from "@/lib/auth-cookie";
import { getSessionData } from "@/lib/session";
import { WishlistItemsList } from "@/components/wishlist-items-list";

type WishlistItem = {
  item_id: number;
  title: string;
  description: string | null;
  url: string | null;
  item_image: string | null;
  price: number;
  quantity: number;
  priority: number;
  purchased: boolean;
  sequence: number;
};

type WishlistResponse = {
  items: WishlistItem[];
  error?: string;
};

function getApiBaseUrl() {
  const value = process.env.AUTH_API_BASE_URL;

  if (!value) {
    throw new Error("Missing AUTH_API_BASE_URL environment variable.");
  }

  return value.replace(/\/$/, "");
}

async function fetchWishlist(token: string): Promise<WishlistResponse> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/wishlist`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const payload = (await response.json()) as WishlistResponse;

    if (!response.ok) {
      return {
        items: [],
        error: payload.error ?? "Unable to load wishlist",
      };
    }

    return {
      items: payload.items ?? [],
    };
  } catch {
    return {
      items: [],
      error: "Unable to reach wishlist service",
    };
  }
}

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const session = await getSessionData();

  if (!session.isAuthenticated) {
    redirect("/login?next=/wishlist");
  }

  const token = await getAuthToken();

  if (!token) {
    redirect("/login?next=/wishlist");
  }

  const wishlist = await fetchWishlist(token);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl flex-col gap-5 px-4 py-10 sm:px-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <CardTitle className="text-2xl font-semibold">Wishlist</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage your own wishlist items with quick edit/delete controls.
          </p>
        </CardHeader>
        <CardContent className="border-t border-border pt-3 text-sm text-muted-foreground">
          {wishlist.items.length} item{wishlist.items.length === 1 ? "" : "s"}
        </CardContent>
      </Card>

      {wishlist.error ? (
        <Card className="border-destructive/30 shadow-sm">
          <CardContent className="py-6 text-sm text-destructive">{wishlist.error}</CardContent>
        </Card>
      ) : (
        <WishlistItemsList initialItems={wishlist.items} />
      )}
    </main>
  );
}

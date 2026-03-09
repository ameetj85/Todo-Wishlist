import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicWishlistItemsList } from "@/components/public-wishlist-items-list";

type WishlistItem = {
  item_id: number;
  title: string;
  description: string | null;
  url: string | null;
  price: number;
  quantity: number;
  priority: number;
  purchased: boolean;
};

type PublicWishlistResponse = {
  found: boolean;
  user: { name: string } | null;
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

async function fetchPublicWishlist(
  email: string,
): Promise<PublicWishlistResponse> {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/wishlist/public/by-email?email=${encodeURIComponent(email)}`,
      { cache: "no-store" },
    );

    const payload = (await response.json()) as PublicWishlistResponse;

    if (!response.ok) {
      return {
        found: false,
        user: null,
        items: [],
        error: payload.error ?? "Unable to load wishlist",
      };
    }

    return payload;
  } catch {
    return {
      found: false,
      user: null,
      items: [],
      error: "Unable to reach wishlist service",
    };
  }
}

export default async function PublicWishlistPage({
  searchParams,
}: {
  searchParams: { email?: string } | Promise<{ email?: string }>;
}) {
  const { email = "" } = await Promise.resolve(searchParams);
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl items-center px-6 py-12">
        <Card className="w-full border-blue-200/70 shadow-sm">
          <CardHeader>
            <CardTitle>Public Wishlist</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Provide an email address to view a wishlist.
          </CardContent>
        </Card>
      </main>
    );
  }

  const result = await fetchPublicWishlist(normalizedEmail);

  if (!result.found) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl items-center px-6 py-12">
        <Card className="w-full border-blue-200/70 shadow-sm">
          <CardHeader>
            <CardTitle>Public Wishlist</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {result.error ?? "No wishlist found for this email address."}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl flex-col gap-5 px-4 py-10 sm:px-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <CardTitle className="text-2xl font-semibold text-slate-900">
            {result.user?.name ?? "User"}&apos;s Wishlist
          </CardTitle>
          <p className="text-sm text-slate-600">Viewing wishlist for: {normalizedEmail}</p>
        </CardHeader>
        <CardContent className="border-t border-slate-100 pt-3 text-sm text-slate-600">
          {result.items.length} item{result.items.length === 1 ? "" : "s"}
        </CardContent>
      </Card>

      {result.items.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-6 text-sm text-slate-600">
            This wishlist has no items yet.
          </CardContent>
        </Card>
      ) : (
        <PublicWishlistItemsList email={normalizedEmail} items={result.items} />
      )}
    </main>
  );
}

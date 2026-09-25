import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PublicWishlistItemsList } from "@/components/public-wishlist-items-list";

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
};

type SharedWishlistResponse = {
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

async function fetchSharedWishlist(
  token: string,
): Promise<SharedWishlistResponse> {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/wishlist/public/by-token?token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );

    const payload = (await response.json()) as SharedWishlistResponse;

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

export default async function SharedWishlistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sharedToken = decodeURIComponent(token);
  const result = await fetchSharedWishlist(sharedToken);

  if (!result.found) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl items-center px-6 py-12">
        <Card className="w-full border-border shadow-sm">
          <CardHeader>
            <CardTitle>Shared Wishlist</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {result.error ?? "This wishlist link is no longer available."}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl flex-col gap-5 px-4 py-10 sm:px-6">
      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <CardTitle className="text-2xl font-semibold text-foreground">
            {result.user?.name ?? "User"}&apos;s Wishlist
          </CardTitle>
          <p className="text-sm text-muted-foreground">Shared wishlist</p>
        </CardHeader>
        <CardContent className="border-t border-border pt-3 text-sm text-muted-foreground">
          {result.items.length} item{result.items.length === 1 ? "" : "s"}
        </CardContent>
      </Card>

      {result.items.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="py-6 text-sm text-muted-foreground">
            This wishlist has no items yet.
          </CardContent>
        </Card>
      ) : (
        <PublicWishlistItemsList owner={{ shareToken: sharedToken }} items={result.items} />
      )}
    </main>
  );
}

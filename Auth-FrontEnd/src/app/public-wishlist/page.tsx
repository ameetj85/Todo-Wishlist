import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WishlistItem = {
  item_id: number;
  title: string;
  description: string | null;
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

function getPriorityLabel(priority: number) {
  if (priority === 0) return "High";
  if (priority === 1) return "Medium";
  return "Low";
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
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl flex-col gap-4 px-6 py-12">
      <Card className="border-blue-200/70 shadow-sm">
        <CardHeader>
          <CardTitle>{result.user?.name ?? "User"}&apos;s Wishlist</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Viewing wishlist for: {normalizedEmail}
        </CardContent>
      </Card>

      {result.items.length === 0 ? (
        <Card className="border-blue-200/70 shadow-sm">
          <CardContent className="py-6 text-sm text-muted-foreground">
            This wishlist has no items yet.
          </CardContent>
        </Card>
      ) : (
        result.items.map((item) => (
          <Card key={item.item_id} className="border-blue-200/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>{item.description ?? "No description provided."}</p>
              <p>Priority: {getPriorityLabel(item.priority)}</p>
              <p>Price: ${item.price.toFixed(2)}</p>
              <p>Quantity: {item.quantity}</p>
              <p>Status: {item.purchased ? "Purchased" : "Not purchased"}</p>
            </CardContent>
          </Card>
        ))
      )}
    </main>
  );
}

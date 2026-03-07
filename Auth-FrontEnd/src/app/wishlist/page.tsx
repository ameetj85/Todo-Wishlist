import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionData } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const session = await getSessionData();

  if (!session.isAuthenticated) {
    redirect("/login?next=/wishlist");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl flex-col items-center justify-center px-6 py-12">
      <Card className="w-full border-blue-200/70 shadow-sm">
        <CardHeader>
          <CardTitle>Wishlist</CardTitle>
          <CardDescription>
            Save your future purchases and ideas in one organized place.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Keep track of products and plans you care about, then revisit them
            anytime.
          </p>
          <p>This page is now ready for your Wishlist management features.</p>
        </CardContent>
      </Card>
    </main>
  );
}

import { redirect } from "next/navigation";

import {
  getAdminOverviewAction,
} from "@/app/actions/admin-console";
import { AdminConsoleTabs } from "@/components/admin-console-tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionData } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminConsolePage() {
  const session = await getSessionData();

  if (!session.isAuthenticated || !session.user) {
    redirect("/login?next=/admin-console");
  }

  if (!session.user.isAdmin) {
    redirect("/about");
  }

  const overview = await getAdminOverviewAction();

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

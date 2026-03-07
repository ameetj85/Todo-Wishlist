import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionData } from "@/lib/session";

export const dynamic = "force-dynamic";

const ctaButtonClassName =
  "inline-flex h-10 w-36 items-center justify-center rounded-lg bg-blue-500 text-sm font-medium text-white transition-all hover:bg-blue-600";

export default async function Home() {
  const session = await getSessionData();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl flex-col items-center justify-center px-6 py-12">
      {session.isAuthenticated ? (
        <div className="w-full space-y-6">
          <Card className="border-blue-200/70 shadow-sm">
            <CardHeader className="items-center text-center">
              <CardTitle>
                <Link href="/todo" className={ctaButtonClassName}>
                  Todo List
                </Link>
              </CardTitle>
              <CardDescription className="max-w-xl pt-3 text-base text-muted-foreground">
                Stay focused and ship more with a clean task flow: capture quick
                ideas, prioritize what matters most, and track your daily
                progress in one place.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground">
              Build momentum every day with a list designed for clarity and
              consistency.
            </CardContent>
          </Card>

          <Card className="border-blue-200/70 shadow-sm">
            <CardHeader className="items-center text-center">
              <CardTitle>
                <Link href="/wishlist" className={ctaButtonClassName}>
                  Wishlist
                </Link>
              </CardTitle>
              <CardDescription className="max-w-xl pt-3 text-base text-muted-foreground">
                Save the products, goals, and ideas you care about most, then
                revisit them when you&apos;re ready to plan, compare, and take
                action.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground">
              Turn future plans into organized, actionable decisions.
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="w-full max-w-2xl border-blue-200/70 shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              Unlock Todo List + Wishlist
            </CardTitle>
            <CardDescription className="pt-2 text-base text-muted-foreground">
              Sign in or create a free account to access both services. Start
              organizing your tasks, saving your top picks, and staying on track
              with less effort and more results.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Members get a faster, cleaner workflow to manage priorities and
              plan future purchases from one simple dashboard.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/login?from=hero" className={ctaButtonClassName}>
                Sign In
              </Link>
              <Link href="/signup?from=hero" className={ctaButtonClassName}>
                Sign Up
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

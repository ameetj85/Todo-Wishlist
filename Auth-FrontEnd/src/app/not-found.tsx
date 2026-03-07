import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl items-center justify-center px-6 py-12">
      <Card className="w-full max-w-xl border-blue-200/70 shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            The page you requested does not exist or may have been moved.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-10 w-36 items-center justify-center rounded-lg bg-blue-500 text-sm font-medium text-white transition-all hover:bg-blue-600"
            >
              Go Home
            </Link>
            <Link
              href="/login"
              className="inline-flex h-10 w-36 items-center justify-center rounded-lg bg-blue-500 text-sm font-medium text-white transition-all hover:bg-blue-600"
            >
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

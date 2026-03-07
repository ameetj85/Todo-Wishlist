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

export default async function TodoPage() {
  const session = await getSessionData();

  if (!session.isAuthenticated) {
    redirect("/login?next=/todo");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-3xl flex-col items-center justify-center px-6 py-12">
      <Card className="w-full border-blue-200/70 shadow-sm">
        <CardHeader>
          <CardTitle>Todo List</CardTitle>
          <CardDescription>
            Organize your top priorities and keep your day focused.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Create tasks, track progress, and maintain momentum with a clear
            daily plan.
          </p>
          <p>This page is now ready for your Todo CRUD features.</p>
        </CardContent>
      </Card>
    </main>
  );
}

import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { getSessionData } from "@/lib/session";

export default async function ChangePasswordPage() {
  const session = await getSessionData();

  if (!session.isAuthenticated) {
    redirect("/login?next=/change-password");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-md items-center px-6 py-12">
      <Card className="w-full border-border shadow-sm">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription className="text-muted-foreground">
            Update your account password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}

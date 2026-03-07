import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string; from?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;
  const fromHero = params.from === "hero";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>
            Request a reset link or submit your reset token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Request reset link</h2>
            <ForgotPasswordForm />
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="text-sm font-medium">Reset with token</h2>
            <ResetPasswordForm token={params.token} />
          </section>

          <p className="text-sm text-muted-foreground">
            Return to{" "}
            <Link
              href={fromHero ? "/login?from=hero" : "/login"}
              className="text-foreground underline underline-offset-4"
            >
              Login
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

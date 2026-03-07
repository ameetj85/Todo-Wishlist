import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; from?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const fromHero = params.from === "hero";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm nextPath={params.next} fromHero={fromHero} />
          <p className="text-sm text-muted-foreground">
            Forgot password?{" "}
            <Link
              href={fromHero ? "/reset-password?from=hero" : "/reset-password"}
              className="text-foreground underline underline-offset-4"
            >
              Reset it here
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

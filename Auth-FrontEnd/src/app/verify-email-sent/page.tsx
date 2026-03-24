import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function VerifyEmailSentPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>Almost there!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground">
            We&apos;ve sent a verification email to your inbox. Please click the
            link in the email to verify your account and gain access.
          </p>

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Check your spam or junk folder if you don&apos;t see
              the email in your inbox.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Once verified, you&apos;ll be able to log in with your email and password.
          </p>

          <div className="flex gap-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

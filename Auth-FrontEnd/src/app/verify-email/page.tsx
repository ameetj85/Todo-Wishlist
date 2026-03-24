"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { verifyEmailAction, type ActionState } from "@/app/actions/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [state, setState] = useState<ActionState>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    if (token && !hasAttempted) {
      setIsVerifying(true);
      setHasAttempted(true);

      const formData = new FormData();
      formData.append("token", token);

      verifyEmailAction({}, formData)
        .then((result) => {
          setState(result);
          if (!result.error) {
            setTimeout(() => {
              router.push("/login");
            }, 2000);
          }
        })
        .catch((error) => {
          setState({ error: "An error occurred during verification. Please try again." });
        })
        .finally(() => {
          setIsVerifying(false);
        });
    }
  }, [token, hasAttempted, router]);

  if (!token) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Invalid Verification Link</CardTitle>
            <CardDescription>
              The verification link is missing or invalid.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please check the link in your email and try again, or request a new
              verification email.
            </p>
            <Button
              onClick={() => router.push("/signup")}
              className="w-full"
            >
              Back to Sign Up
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-md flex-col justify-center gap-4 px-6 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Verifying Your Email</CardTitle>
          <CardDescription>Please wait while we verify your account...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isVerifying ? (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-foreground"></div>
              <p className="text-sm text-muted-foreground">Verifying your email...</p>
            </div>
          ) : (
            <>
              {state.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              ) : null}

              {!state.error && hasAttempted ? (
                <div className="space-y-3">
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-sm font-medium text-emerald-900">
                      ✓ Email verified successfully!
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Redirecting to login page...
                  </p>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

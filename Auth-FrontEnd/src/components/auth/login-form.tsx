"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActionState } from "react";

import { loginAction, type ActionState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = {};

type LoginFormProps = {
  nextPath?: string;
  fromHero?: boolean;
};

export function LoginForm({
  nextPath = "/about",
  fromHero = false,
}: LoginFormProps) {
  const [state, formAction] = useActionState(loginAction, initialState);
  const [isUnverifiedModalOpen, setIsUnverifiedModalOpen] = useState(false);

  useEffect(() => {
    if (state.showUnverifiedModal) {
      setIsUnverifiedModalOpen(true);
    }
  }, [state.showUnverifiedModal]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error && !state.showUnverifiedModal ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton pendingText="Signing in..." className="w-full">
        Login
      </SubmitButton>

      <p className="text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href={fromHero ? "/signup?from=hero" : "/signup"}
          className="text-foreground underline underline-offset-4"
        >
          Sign up
        </Link>
      </p>

      {isUnverifiedModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setIsUnverifiedModalOpen(false)}
        >
          <div
            className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-foreground">
              Account Verification Required
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.error ?? "Your account is not verified yet. Please check your email and complete verification before signing in."}
            </p>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                className="h-8 w-auto px-3"
                onClick={() => setIsUnverifiedModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";

import { resetPasswordAction, type ActionState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = {};

type ResetPasswordFormProps = {
  token?: string;
};

export function ResetPasswordForm({ token = "" }: ResetPasswordFormProps) {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordsMismatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword !== confirmPassword;
  const disableSubmit =
    newPassword.length === 0 ||
    confirmPassword.length === 0 ||
    passwordsMismatch;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPasswordValue = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPasswordValue) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="token">Reset Token</Label>
        <Input id="token" name="token" defaultValue={token} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm New Password</Label>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.success ? (
        <Alert>
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      ) : null}

      {passwordsMismatch ? (
        <Alert variant="destructive">
          <AlertDescription>
            New password and confirm password must match.
          </AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton
        pendingText="Resetting..."
        className="w-full"
        disabled={disableSubmit}
      >
        Reset password
      </SubmitButton>
    </form>
  );
}

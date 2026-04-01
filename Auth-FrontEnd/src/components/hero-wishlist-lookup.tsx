"use client";

import { type FormEvent, useId, useState } from "react";

import { lookupPublicWishlistByEmailAction } from "@/app/actions/wishlist";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ctaButtonClassName =
  "inline-flex h-10 w-36 items-center justify-center rounded-lg bg-blue-500 text-sm font-medium text-white transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed";

export function HeroWishlistLookup() {
  const emailInputId = useId();
  const [emailAddress, setEmailAddress] = useState("");
  const [showValidationError, setShowValidationError] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = emailAddress.trim();

    if (!isEmailValid) {
      setShowValidationError(true);
      return;
    }

    setShowValidationError(false);
    setLookupError(null);
    setIsLookingUp(true);

    try {
      const result = await lookupPublicWishlistByEmailAction(normalizedEmail);

      if (!result.ok) {
        setLookupError(result.error ?? "Unable to look up wishlist right now.");
        return;
      }

      if (!result.found) {
        setLookupError("No wishlist match found for that email address.");
        return;
      }

      window.location.href = `/public-wishlist?email=${encodeURIComponent(normalizedEmail)}`;
    } catch {
      setLookupError("Unable to look up wishlist right now.");
    } finally {
      setIsLookingUp(false);
    }
  }

  return (
    <Card className="border-blue-200/70 shadow-sm">
      <CardHeader className="items-center text-center">
        <CardTitle>
          <span className="text-xl font-semibold">View a Wishlist</span>
        </CardTitle>
        <CardDescription className="max-w-xl pt-3 text-base text-muted-foreground">
          Enter someone&apos;s email address to browse their public wishlist.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <form
          className="flex w-full max-w-sm flex-col gap-2"
          onSubmit={handleSubmit}
        >
          <Label htmlFor={emailInputId} className="sr-only">
            Email address
          </Label>
          <Input
            id={emailInputId}
            type="email"
            required
            value={emailAddress}
            onChange={(event) => {
              setEmailAddress(event.target.value);
              if (showValidationError) setShowValidationError(false);
              if (lookupError) setLookupError(null);
            }}
            placeholder="name@example.com"
            aria-invalid={showValidationError && !isEmailValid}
          />
          {showValidationError && !isEmailValid ? (
            <p className="text-xs text-destructive">
              Please enter a valid email address.
            </p>
          ) : null}
          {lookupError ? (
            <p className="text-xs text-destructive">{lookupError}</p>
          ) : null}
          <button
            type="submit"
            disabled={isLookingUp}
            className={ctaButtonClassName}
          >
            {isLookingUp ? "Checking..." : "View Wishlist"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

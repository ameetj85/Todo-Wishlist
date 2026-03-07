"use client";

import { type FormEvent, useId, useState } from "react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";

import { NAVBAR_LINK_CLASS_NAME, NavbarLink } from "@/components/navbar-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AppNavbarProps = {
  isAuthenticated: boolean;
};

const themeNavLinkClassName =
  "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground";

export function AppNavbar({ isAuthenticated }: AppNavbarProps) {
  const emailInputId = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [showValidationError, setShowValidationError] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUpWishlist, setIsLookingUpWishlist] = useState(false);

  const fromHero = searchParams.get("from") === "hero";
  const isHeroFlowChildRoute =
    (pathname === "/signup" || pathname === "/reset-password") && fromHero;
  const showHeroButton = pathname !== "/" && !isHeroFlowChildRoute;
  const onLoginPage = pathname === "/login";
  const onTodoPage = pathname === "/todo";
  const onWishlistPage = pathname === "/wishlist";
  const onAboutPage = pathname === "/about";
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim());

  function openWishlistModal() {
    setIsWishlistModalOpen(true);
    setShowValidationError(false);
    setLookupError(null);
  }

  function closeWishlistModal() {
    setIsWishlistModalOpen(false);
    setShowValidationError(false);
    setLookupError(null);
    setIsLookingUpWishlist(false);
    setEmailAddress("");
  }

  async function handleWishlistLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = emailAddress.trim();

    if (!isEmailValid) {
      setShowValidationError(true);
      return;
    }

    setShowValidationError(false);
    setLookupError(null);
    setIsLookingUpWishlist(true);

    try {
      const response = await fetch(
        `/api/wishlist/public/by-email?email=${encodeURIComponent(normalizedEmail)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const payload = (await response.json()) as {
        found?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setLookupError(
          payload.error ?? "Unable to look up wishlist right now.",
        );
        return;
      }

      if (!payload.found) {
        setLookupError("No wishlist match found for that email address.");
        return;
      }

      window.location.href = `/public-wishlist?email=${encodeURIComponent(normalizedEmail)}`;
    } catch {
      setLookupError("Unable to look up wishlist right now.");
    } finally {
      setIsLookingUpWishlist(false);
    }
  }

  return (
    <>
      <nav className="border-b">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center px-6 py-4">
          <div className="flex items-center justify-self-start gap-3">
            <Image
              src="/appLogo.png"
              alt="Your Smashing Apps logo"
              width={36}
              height={36}
              className="rounded-md"
              priority
            />
            <span className="text-2xl font-bold">Your Smashing Apps</span>
          </div>

          <div className="flex items-center justify-center gap-2">
            {!isAuthenticated ? (
              <a
                href="#"
                className={cn(NAVBAR_LINK_CLASS_NAME, themeNavLinkClassName)}
                onClick={(event) => {
                  event.preventDefault();
                  openWishlistModal();
                }}
              >
                View Wishlist
              </a>
            ) : null}

            {showHeroButton ? (
              <NavbarLink href="/" className={themeNavLinkClassName}>
                Home
              </NavbarLink>
            ) : null}

            {isAuthenticated ? (
              <>
                {!onTodoPage ? (
                  <NavbarLink href="/todo" className={themeNavLinkClassName}>
                    Todo
                  </NavbarLink>
                ) : null}
                {!onWishlistPage ? (
                  <NavbarLink
                    href="/wishlist"
                    className={themeNavLinkClassName}
                  >
                    Wishlist
                  </NavbarLink>
                ) : null}
                {!onAboutPage ? (
                  <NavbarLink href="/about" className={themeNavLinkClassName}>
                    About
                  </NavbarLink>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-self-end gap-2">
            {isAuthenticated ? (
              <a
                href="/logout"
                className={cn(NAVBAR_LINK_CLASS_NAME, themeNavLinkClassName)}
              >
                Sign Out
              </a>
            ) : !onLoginPage ? (
              <NavbarLink
                href={pathname === "/" ? "/login?from=hero" : "/login"}
                className={themeNavLinkClassName}
              >
                Sign In
              </NavbarLink>
            ) : null}

            <ThemeToggle />
          </div>
        </div>
      </nav>

      {isWishlistModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeWishlistModal}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <form className="space-y-3" onSubmit={handleWishlistLookup}>
              <Label htmlFor={emailInputId} className="text-sm font-semibold">
                Enter an Email Address
              </Label>
              <p className="text-xs text-muted-foreground">
                If a match is found then you will be able to view that
                person&apos;s wishlist.
              </p>
              <Input
                id={emailInputId}
                type="email"
                required
                value={emailAddress}
                onChange={(event) => {
                  setEmailAddress(event.target.value);
                  if (showValidationError) {
                    setShowValidationError(false);
                  }
                  if (lookupError) {
                    setLookupError(null);
                  }
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
              <Button
                type="submit"
                disabled={isLookingUpWishlist}
                className="w-full bg-blue-500 text-white hover:bg-blue-600"
              >
                {isLookingUpWishlist ? "Checking..." : "Continue"}
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

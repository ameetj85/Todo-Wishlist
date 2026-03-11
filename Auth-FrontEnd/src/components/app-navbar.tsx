"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell } from "lucide-react";

import { NAVBAR_LINK_CLASS_NAME, NavbarLink } from "@/components/navbar-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { lookupPublicWishlistByEmailAction } from "@/app/actions/wishlist";

type AppNavbarProps = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  userName?: string | null;
  dueTodayOpenTodoCount?: number;
};

const themeNavLinkClassName =
  "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground";

export function AppNavbar({
  isAuthenticated,
  isAdmin,
  userName,
  dueTodayOpenTodoCount = 0,
}: AppNavbarProps) {
  const emailInputId = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [showValidationError, setShowValidationError] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUpWishlist, setIsLookingUpWishlist] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const fromHero = searchParams.get("from") === "hero";
  const isHeroFlowChildRoute =
    (pathname === "/signup" || pathname === "/reset-password") && fromHero;
  const showHeroButton = pathname !== "/" && !isHeroFlowChildRoute;
  const onLoginPage = pathname === "/login";
  const onTodoPage = pathname === "/todo";
  const onWishlistPage = pathname === "/wishlist";
  const onAboutPage = pathname === "/about";
  const onChangePasswordPage = pathname === "/change-password";
  const onAdminConsolePage = pathname === "/admin-console";
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim());
  const isDueTodayOpenFilterActive =
    pathname === "/todo" && searchParams.get("filter") === "due-today-open";
  const showDueTodayBell =
    isAuthenticated && (dueTodayOpenTodoCount > 0 || isDueTodayOpenFilterActive);
  const bellCountLabel = dueTodayOpenTodoCount > 99 ? "99+" : `${dueTodayOpenTodoCount}`;

  useEffect(() => {
    function onWindowClick(event: MouseEvent) {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    }

    window.addEventListener("click", onWindowClick);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("click", onWindowClick);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

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
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">Your Smashing Apps</span>
              {isAuthenticated && userName ? (
                <span className="text-sm font-medium text-muted-foreground">({userName})</span>
              ) : null}
            </div>
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
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-self-end gap-2">
            {showDueTodayBell ? (
              <a
                href="/todo?filter=due-today-open"
                title="you have Todos due today or overdue"
                aria-label={`You have ${dueTodayOpenTodoCount} todos due today or overdue`}
                className={cn(
                  "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:bg-accent",
                  isDueTodayOpenFilterActive &&
                    "border-amber-400 bg-amber-50 text-amber-700 shadow-sm ring-2 ring-amber-200",
                )}
              >
                <Bell className="h-5 w-5" />
                {dueTodayOpenTodoCount > 0 ? (
                  <span className="absolute -top-1 -right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                    {bellCountLabel}
                  </span>
                ) : null}
              </a>
            ) : null}

            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
                aria-label="Open profile menu"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:bg-accent"
              >
                <Image
                  src="/person-avatar.svg"
                  alt="Profile menu"
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              </button>

              {isProfileMenuOpen ? (
                <div className="absolute right-0 z-50 mt-2 min-w-48 rounded-lg border border-border bg-background p-1 shadow-lg">
                  {!onAboutPage ? (
                    <a
                      href="/about"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      About
                    </a>
                  ) : null}

                  {isAuthenticated && !onChangePasswordPage ? (
                    <a
                      href="/change-password"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Change Password
                    </a>
                  ) : null}

                  {isAuthenticated && isAdmin && !onAdminConsolePage ? (
                    <a
                      href="/admin-console"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Admin Console
                    </a>
                  ) : null}

                  {isAuthenticated ? (
                    <a
                      href="/logout"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Sign Out
                    </a>
                  ) : !onLoginPage ? (
                    <a
                      href={pathname === "/" ? "/login?from=hero" : "/login"}
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Sign In
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

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

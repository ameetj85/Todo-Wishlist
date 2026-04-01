"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, Menu, X } from "lucide-react";

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
  const DESKTOP_NAV_MIN_WIDTH = 768;

  const emailInputId = useId();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [showValidationError, setShowValidationError] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUpWishlist, setIsLookingUpWishlist] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isDesktopNav, setIsDesktopNav] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileNavRef = useRef<HTMLDivElement | null>(null);

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
    function updateViewportMode() {
      const innerWidth = window.innerWidth;
      const outerWidth = window.outerWidth;
      const screenWidth = window.screen.width;
      const visualViewportWidth = window.visualViewport?.width ?? 0;
      const widths = [innerWidth, outerWidth, screenWidth, visualViewportWidth];
      const effectiveWidth = Math.max(...widths);

      setIsDesktopNav(effectiveWidth >= DESKTOP_NAV_MIN_WIDTH);
    }

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);

    return () => {
      window.removeEventListener("resize", updateViewportMode);
    };
  }, []);

  useEffect(() => {
    if (isDesktopNav) {
      setIsMobileNavOpen(false);
    }
  }, [isDesktopNav]);

  useEffect(() => {
    function onWindowClick(event: MouseEvent) {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }

      if (mobileNavRef.current && !mobileNavRef.current.contains(target)) {
        setIsMobileNavOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
        setIsMobileNavOpen(false);
      }
    }

    window.addEventListener("click", onWindowClick);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("click", onWindowClick);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname, searchParamsKey]);

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
        <div className="mx-auto flex w-full max-w-6xl flex-nowrap items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center justify-self-start gap-2">
            {!isDesktopNav ? (
              <div className="relative" ref={mobileNavRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isMobileNavOpen}
                aria-label="Open navigation menu"
                onClick={() => setIsMobileNavOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background hover:bg-accent"
              >
                {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              {isMobileNavOpen ? (
                <div className="absolute left-0 top-12 z-50 w-56 rounded-lg border border-border bg-background p-1 shadow-lg">
                  {!isAuthenticated ? (
                    <Link
                      href="#"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={(event) => {
                        event.preventDefault();
                        setIsMobileNavOpen(false);
                        openWishlistModal();
                      }}
                    >
                      View Wishlist
                    </Link>
                  ) : null}

                  {showHeroButton ? (
                    <Link
                      href="/"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsMobileNavOpen(false)}
                    >
                      Home
                    </Link>
                  ) : null}

                  {isAuthenticated && !onTodoPage ? (
                    <Link
                      href="/todo"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsMobileNavOpen(false)}
                    >
                      Todo
                    </Link>
                  ) : null}

                  {isAuthenticated && !onWishlistPage ? (
                    <Link
                      href="/wishlist"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsMobileNavOpen(false)}
                    >
                      Wishlist
                    </Link>
                  ) : null}

                  {!onAboutPage ? (
                    <Link
                      href="/about"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsMobileNavOpen(false)}
                    >
                      About
                    </Link>
                  ) : null}
                </div>
              ) : null}
              </div>
            ) : null}

            <Image
              src="/appLogo.png"
              alt="Your Smashing Apps logo"
              width={36}
              height={36}
              className="rounded-md"
              priority
            />
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="hidden max-w-[14rem] truncate text-lg font-bold sm:inline sm:max-w-none sm:text-2xl">
                Your Smashing Apps
              </span>
              {isAuthenticated && userName ? (
                <span className="hidden truncate text-sm font-medium text-muted-foreground sm:inline">
                  ({userName})
                </span>
              ) : null}
            </div>
          </div>

          <div className={cn(
            "hidden w-full flex-wrap items-center justify-start gap-2",
            isDesktopNav && "flex w-auto justify-center",
          )}>
            {!isAuthenticated ? (
              <Link
                href="#"
                className={cn(NAVBAR_LINK_CLASS_NAME, themeNavLinkClassName)}
                onClick={(event) => {
                  event.preventDefault();
                  openWishlistModal();
                }}
              >
                View Wishlist
              </Link>
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

          <div className="flex shrink-0 items-center justify-end justify-self-end gap-2">
            {showDueTodayBell ? (
              <Link
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
                  <span className="pointer-events-none absolute -top-1 -right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white sm:text-[11px]">
                    {bellCountLabel}
                  </span>
                ) : null}
              </Link>
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
                    <Link
                      href="/about"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      About
                    </Link>
                  ) : null}

                  {isAuthenticated && !onChangePasswordPage ? (
                    <Link
                      href="/change-password"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Change Password
                    </Link>
                  ) : null}

                  {isAuthenticated && isAdmin && !onAdminConsolePage ? (
                    <Link
                      href="/admin-console"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Admin Console
                    </Link>
                  ) : null}

                  {isAuthenticated ? (
                    <Link
                      href="/logout"
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Sign Out
                    </Link>
                  ) : !onLoginPage ? (
                    <Link
                      href={pathname === "/" ? "/login?from=hero" : "/login"}
                      className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                      onClick={() => setIsProfileMenuOpen(false)}
                    >
                      Sign In
                    </Link>
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

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { logoutAction } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type AppNavbarProps = {
  isAuthenticated: boolean;
};

const navButtonClassName =
  "inline-flex h-10 w-36 items-center justify-center rounded-lg bg-blue-500 text-sm font-medium whitespace-nowrap text-white transition-all hover:bg-blue-600";

export function AppNavbar({ isAuthenticated }: AppNavbarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromHero = searchParams.get("from") === "hero";
  const isHeroFlowChildRoute =
    (pathname === "/signup" || pathname === "/reset-password") && fromHero;
  const showHeroButton = pathname !== "/" && !isHeroFlowChildRoute;
  const onLoginPage = pathname === "/login";
  const onTodoPage = pathname === "/todo";
  const onWishlistPage = pathname === "/wishlist";
  const onAboutPage = pathname === "/about";

  return (
    <nav className="border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold">My Todo</span>
        <div className="flex items-center gap-2">
          {showHeroButton ? (
            <Link href="/" className={navButtonClassName}>
              Hero
            </Link>
          ) : null}

          {isAuthenticated ? (
            <>
              {!onTodoPage ? (
                <Link href="/todo" className={navButtonClassName}>
                  Todo
                </Link>
              ) : null}
              {!onWishlistPage ? (
                <Link href="/wishlist" className={navButtonClassName}>
                  Wishlist
                </Link>
              ) : null}
              {!onAboutPage ? (
                <Link href="/about" className={navButtonClassName}>
                  About
                </Link>
              ) : null}
              <form action={logoutAction}>
                <Button
                  type="submit"
                  className="bg-blue-500 text-white hover:bg-blue-600"
                >
                  Sign Out
                </Button>
              </form>
            </>
          ) : !onLoginPage ? (
            <Link
              href={pathname === "/" ? "/login?from=hero" : "/login"}
              className={navButtonClassName}
            >
              Sign In
            </Link>
          ) : null}

          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

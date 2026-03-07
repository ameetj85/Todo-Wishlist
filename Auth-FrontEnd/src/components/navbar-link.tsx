import Link, { type LinkProps } from "next/link";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export const NAVBAR_LINK_CLASS_NAME =
  "inline-flex h-10 w-36 items-center justify-center rounded-lg bg-blue-500 text-sm font-medium whitespace-nowrap text-white transition-all hover:bg-blue-600";

type NavbarLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
};

export function NavbarLink({ children, className, ...props }: NavbarLinkProps) {
  return (
    <Link {...props} className={cn(NAVBAR_LINK_CLASS_NAME, className)}>
      {children}
    </Link>
  );
}

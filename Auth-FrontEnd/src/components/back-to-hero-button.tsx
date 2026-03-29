import Link from "next/link";

type BackToHeroButtonProps = {
  className?: string;
};

export function BackToHeroButton({ className }: BackToHeroButtonProps) {
  return (
    <Link
      href="/"
      className={`inline-flex h-10 min-w-24 items-center justify-center rounded-lg bg-blue-500 px-3 text-sm font-medium whitespace-nowrap text-white transition-all hover:bg-blue-600 sm:px-4 ${className ?? ""}`.trim()}
    >
      Hero
    </Link>
  );
}

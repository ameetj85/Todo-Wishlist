import Link from "next/link";

type BackToHeroButtonProps = {
  className?: string;
};

export function BackToHeroButton({ className }: BackToHeroButtonProps) {
  return (
    <Link
      href="/"
      className={`inline-flex h-10 w-36 items-center justify-center rounded-lg bg-blue-500 text-sm font-medium whitespace-nowrap text-white transition-all hover:bg-blue-600 ${className ?? ""}`.trim()}
    >
      Hero
    </Link>
  );
}

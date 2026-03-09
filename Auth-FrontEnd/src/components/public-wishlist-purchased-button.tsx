"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type PublicWishlistPurchasedButtonProps = {
  email: string;
  itemId: number;
  purchased: boolean;
  compact?: boolean;
  amazonStyle?: boolean;
};

export function PublicWishlistPurchasedButton({
  email,
  itemId,
  purchased,
  compact = false,
  amazonStyle = false,
}: PublicWishlistPurchasedButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextPurchasedValue = !purchased;
  const isDisabled = isPending;

  async function togglePurchased() {
    setError(null);

    const response = await fetch("/api/wishlist/public/purchased", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        item_id: itemId,
        purchased: nextPurchasedValue,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Unable to mark item as purchased");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        onClick={togglePurchased}
        disabled={isDisabled}
        variant={purchased ? "secondary" : "default"}
        size={compact ? "icon-sm" : "sm"}
        className={
          compact
            ? "h-7 w-7"
            : amazonStyle
              ? `h-8 w-auto rounded-full px-4 text-xs font-semibold ${
                  purchased
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-amber-300 text-slate-900 hover:bg-amber-400"
                }`
              : undefined
        }
        aria-label={purchased ? "Mark as not purchased" : "Mark as purchased"}
        title={purchased ? "Mark as not purchased" : "Mark as purchased"}
      >
        {purchased ? <Check className={compact ? "size-4" : "mr-1 size-4"} /> : null}
        {compact
          ? null
          : isPending
            ? "Saving..."
            : purchased
              ? "Purchased"
              : "Unpurchased"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

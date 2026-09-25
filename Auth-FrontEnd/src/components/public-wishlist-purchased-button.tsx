"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  togglePublicWishlistPurchasedAction,
  toggleSharedWishlistPurchasedAction,
} from "@/app/actions/wishlist";

// Identifies whose wishlist is being viewed: by email lookup or by share link.
export type PublicWishlistOwner = { email: string } | { shareToken: string };

type PublicWishlistPurchasedButtonProps = {
  owner: PublicWishlistOwner;
  itemId: number;
  purchased: boolean;
  compact?: boolean;
  amazonStyle?: boolean;
};

export function PublicWishlistPurchasedButton({
  owner,
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

    const result =
      "shareToken" in owner
        ? await toggleSharedWishlistPurchasedAction({
            token: owner.shareToken,
            item_id: itemId,
            purchased: nextPurchasedValue,
          })
        : await togglePublicWishlistPurchasedAction({
            email: owner.email,
            item_id: itemId,
            purchased: nextPurchasedValue,
          });

    if (!result.ok) {
      setError(result.error ?? "Unable to mark item as purchased");
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
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-yellow-400 text-black hover:bg-yellow-500"
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

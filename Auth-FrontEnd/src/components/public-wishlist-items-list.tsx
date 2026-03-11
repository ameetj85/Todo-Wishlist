"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Package } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { PublicWishlistPurchasedButton } from "@/components/public-wishlist-purchased-button";

type WishlistItem = {
  item_id: number;
  title: string;
  description: string | null;
  url: string | null;
  item_image: string | null;
  price: number;
  quantity: number;
  priority: number;
  purchased: boolean;
};

type WishlistFilter = "all" | "purchased" | "unpurchased";
type PriorityFilter = "any" | "high" | "medium" | "low";

type PublicWishlistItemsListProps = {
  email: string;
  items: WishlistItem[];
};

function getPriorityLabel(priority: number) {
  if (priority === 0) return "High";
  if (priority === 1) return "Medium";
  return "Low";
}

function normalizeItemUrl(url: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function getPriorityChipClasses(priority: number) {
  if (priority === 0) {
    return "bg-red-100 text-red-700 border-red-200";
  }

  if (priority === 1) {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }

  return "bg-blue-100 text-blue-700 border-blue-200";
}

export function PublicWishlistItemsList({ email, items }: PublicWishlistItemsListProps) {
  const [filter, setFilter] = useState<WishlistFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("any");

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesPurchaseFilter =
        filter === "all" ||
        (filter === "purchased" && item.purchased) ||
        (filter === "unpurchased" && !item.purchased);

      const matchesPriorityFilter =
        priorityFilter === "any" ||
        (priorityFilter === "high" && item.priority === 0) ||
        (priorityFilter === "medium" && item.priority === 1) ||
        (priorityFilter === "low" && item.priority === 2);

      return matchesPurchaseFilter && matchesPriorityFilter;
    });
  }, [filter, items, priorityFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="icon-sm"
            className="h-8 w-auto px-3"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All ({items.length})
          </Button>
          <Button
            type="button"
            size="icon-sm"
            className="h-8 w-auto px-3"
            variant={filter === "purchased" ? "default" : "outline"}
            onClick={() => setFilter("purchased")}
          >
            Purchased ({items.filter((item) => item.purchased).length})
          </Button>
          <Button
            type="button"
            size="icon-sm"
            className="h-8 w-auto px-3"
            variant={filter === "unpurchased" ? "default" : "outline"}
            onClick={() => setFilter("unpurchased")}
          >
            Unpurchased ({items.filter((item) => !item.purchased).length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="priority-filter" className="text-xs font-semibold text-muted-foreground">
            Priority
          </label>
          <select
            id="priority-filter"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="any">Any priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground shadow-sm">
          No items match this filter.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="hidden grid-cols-[96px_minmax(0,1fr)_110px_80px_160px] gap-4 border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid">
            <span>Item</span>
            <span>Details</span>
            <span>Price</span>
            <span>Qty</span>
            <span>Action</span>
          </div>

          {filteredItems.map((item) => (
            <div
              key={item.item_id}
              className={`border-b border-border/60 px-4 py-4 last:border-b-0 ${item.purchased ? "bg-muted/40" : "bg-card"}`}
            >
              <div className="grid gap-3 md:grid-cols-[96px_minmax(0,1fr)_110px_80px_160px] md:items-center md:gap-4">
                {item.item_image ? (
                  <Image
                    src={`data:image/*;base64,${item.item_image}`}
                    alt={item.title}
                    width={80}
                    height={80}
                    unoptimized
                    className="h-20 w-20 rounded-lg border border-border bg-muted/40 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
                    <Package className="size-8" />
                  </div>
                )}

                <div className="min-w-0 space-y-2">
                  <p className="truncate text-[15px] font-medium text-foreground" title={item.title}>
                    {item.title}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getPriorityChipClasses(item.priority)}`}
                    >
                      {getPriorityLabel(item.priority)} Priority
                    </span>

                    {item.purchased ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        Purchased
                      </span>
                    ) : null}
                  </div>

                  {item.url ? (
                    <a
                      href={normalizeItemUrl(item.url) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-primary hover:text-primary/80"
                      title={item.url}
                    >
                      <span className="truncate">View Product</span>
                      <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">No product link</p>
                  )}
                </div>

                <div className="text-lg font-semibold text-foreground">${item.price.toFixed(2)}</div>
                <div className="text-sm font-medium text-muted-foreground">{item.quantity}</div>

                <div className="flex flex-col items-start gap-1">
                  <PublicWishlistPurchasedButton
                    email={email}
                    itemId={item.item_id}
                    purchased={item.purchased}
                    amazonStyle
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

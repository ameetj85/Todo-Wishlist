"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List } from "lucide-react";

import { Button } from "@/components/ui/button";

export type WishlistViewMode = "list" | "grid";

const STORAGE_KEY = "wishlist-view-mode";

function readStoredViewMode(): WishlistViewMode | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "list" || stored === "grid" ? stored : null;
  } catch {
    return null;
  }
}

export function useWishlistViewMode() {
  const [viewMode, setViewModeState] = useState<WishlistViewMode>("list");

  useEffect(() => {
    const stored = readStoredViewMode();
    if (stored) {
      setViewModeState(stored);
    }
  }, []);

  function setViewMode(mode: WishlistViewMode) {
    setViewModeState(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore storage failures; the choice still applies for this visit.
    }
  }

  return [viewMode, setViewMode] as const;
}

type WishlistViewToggleProps = {
  value: WishlistViewMode;
  onChange: (mode: WishlistViewMode) => void;
};

export function WishlistViewToggle({ value, onChange }: WishlistViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Wishlist layout"
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 shadow-sm"
    >
      <Button
        type="button"
        size="icon-sm"
        className="h-7 w-7 p-0"
        variant={value === "list" ? "default" : "ghost"}
        aria-pressed={value === "list"}
        title="List view"
        aria-label="List view"
        onClick={() => onChange("list")}
      >
        <List className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        className="h-7 w-7 p-0"
        variant={value === "grid" ? "default" : "ghost"}
        aria-pressed={value === "grid"}
        title="Grid view"
        aria-label="Grid view"
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="size-4" />
      </Button>
    </div>
  );
}

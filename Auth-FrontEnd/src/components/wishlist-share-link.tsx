"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import Link from "next/link";

import { createWishlistShareLinkAction } from "@/app/actions/wishlist";

const ctaButtonClassName =
  "inline-flex h-10 w-36 items-center justify-center rounded-lg bg-blue-500 text-sm font-medium text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

type WishlistShareLinkProps = {
  userId: string;
};

type Status = { kind: "success" | "error"; message: string } | null;

function getStorageKey(userId: string) {
  return `wishlist-share-link:${userId}`;
}

function readSavedLink(userId: string) {
  try {
    return window.localStorage.getItem(getStorageKey(userId));
  } catch {
    return null;
  }
}

function saveLink(userId: string, link: string) {
  try {
    window.localStorage.setItem(getStorageKey(userId), link);
  } catch {
    // Storage can be unavailable (private mode); the link is still shown for this visit.
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts where the Clipboard API is unavailable.
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textArea);
    return copied;
  }
}

export function WishlistShareLink({ userId }: WishlistShareLinkProps) {
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setShareLink(readSavedLink(userId));
  }, [userId]);

  async function copyLink(link: string, successMessage = "Link copied to clipboard.") {
    const copied = await copyToClipboard(link);
    setStatus(
      copied
        ? { kind: "success", message: successMessage }
        : { kind: "error", message: "Link created, but it couldn't be copied. Copy it from below." },
    );
  }

  async function handleCreateLink() {
    setStatus(null);
    setIsCreating(true);

    try {
      const result = await createWishlistShareLinkAction();

      if (!result.ok) {
        setStatus({ kind: "error", message: result.error });
        return;
      }

      const link = `${window.location.origin}/shared-wishlist/${encodeURIComponent(result.token)}`;
      const isRecreated = shareLink !== null;
      saveLink(userId, link);
      setShareLink(link);
      await copyLink(
        link,
        isRecreated
          ? "New link created and copied to clipboard. It replaces the saved link."
          : "Link copied to clipboard. Anyone with it can view your wishlist.",
      );
    } catch {
      setStatus({ kind: "error", message: "Unable to create share link right now." });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex w-full max-w-md justify-evenly">
        <Link href="/wishlist" className={ctaButtonClassName}>
          Wishlist
        </Link>
        <button
          type="button"
          onClick={handleCreateLink}
          disabled={isCreating}
          className={ctaButtonClassName}
        >
          {isCreating ? "Creating..." : "Create Link"}
        </button>
      </div>

      {status ? (
        <p
          role="status"
          className={`text-sm font-normal ${status.kind === "success" ? "text-emerald-600" : "text-destructive"}`}
        >
          {status.message}
        </p>
      ) : null}

      {shareLink ? (
        <div className="flex w-full max-w-md items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left">
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            Share link
          </span>
          <a
            href={shareLink}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-sm font-normal text-primary hover:underline"
            title={shareLink}
          >
            {shareLink}
          </a>
          <button
            type="button"
            onClick={() => copyLink(shareLink)}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Copy share link"
            title="Copy share link"
          >
            <Copy className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

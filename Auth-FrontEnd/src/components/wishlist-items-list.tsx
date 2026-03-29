"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { ExternalLink, Package, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createWishlistItemAction,
  deleteWishlistItemAction,
  extractWishlistImageAction,
  updateWishlistItemAction,
} from "@/app/actions/wishlist";

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
  sequence: number;
};

type NewItemForm = {
  title: string;
  description: string;
  url: string;
  price: string;
  quantity: string;
  priority: "0" | "1" | "2";
};

type WishlistItemsListProps = {
  initialItems: WishlistItem[];
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
  if (priority === 0) return "bg-red-100 text-red-700 border-red-200";
  if (priority === 1) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-blue-100 text-blue-700 border-blue-200";
}

export function WishlistItemsList({ initialItems }: WishlistItemsListProps) {
  const manualImageInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [isResequencing, setIsResequencing] = useState(false);
  const [brokenImageItemIds, setBrokenImageItemIds] = useState<number[]>([]);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<WishlistItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemImageBase64, setItemImageBase64] = useState<string | null>(null);
  const [isExtractingImage, setIsExtractingImage] = useState(false);
  const [urlImageUnavailable, setUrlImageUnavailable] = useState(false);
  const [form, setForm] = useState<NewItemForm>({
    title: "",
    description: "",
    url: "",
    price: "0",
    quantity: "1",
    priority: "1",
  });
  const [isPending, startTransition] = useTransition();

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sequence - b.sequence || b.item_id - a.item_id),
    [items],
  );

  async function persistNewSequence(
    nextItems: WishlistItem[],
    previousItems: WishlistItem[],
  ) {
    const previousById = new Map(
      previousItems.map((item) => [item.item_id, item.sequence]),
    );

    const changedItems = nextItems.filter(
      (item) => previousById.get(item.item_id) !== item.sequence,
    );

    if (changedItems.length === 0) {
      return;
    }

    const responses = await Promise.all(
      changedItems.map((item) =>
        updateWishlistItemAction(item.item_id, { sequence: item.sequence }),
      ),
    );

    const failed = responses.some((response) => !response.ok);

    if (failed) {
      throw new Error("Unable to update wishlist sequence");
    }
  }

  async function moveItem(draggedId: number, targetId: number) {
    if (draggedId === targetId || isResequencing) {
      return;
    }

    const previousItems = items;
    const ordered = [...sortedItems];
    const fromIndex = ordered.findIndex((item) => item.item_id === draggedId);
    const toIndex = ordered.findIndex((item) => item.item_id === targetId);

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);

    const resequenced = ordered.map((item, index) => ({
      ...item,
      sequence: index + 1,
    }));

    setError(null);
    setIsResequencing(true);
    setItems(resequenced);

    try {
      await persistNewSequence(resequenced, previousItems);
    } catch {
      setItems(previousItems);
      setError("Unable to reorder wishlist items. Please try again.");
    } finally {
      setIsResequencing(false);
    }
  }

  function resetForm() {
    setForm({
      title: "",
      description: "",
      url: "",
      price: "0",
      quantity: "1",
      priority: "1",
    });
    setItemImageBase64(null);
    setIsExtractingImage(false);
    setUrlImageUnavailable(false);
    setEditingItemId(null);
    setEditingItem(null);
  }

  async function extractImageFromUrl() {
    const url = form.url.trim();
    const title = form.title.trim();

    if (!url) {
      setError("Enter a URL first before extracting an image");
      return;
    }

    setError(null);
    setIsExtractingImage(true);

    const payload = await extractWishlistImageAction(url, title);

    if (payload.imageBase64) {
      setItemImageBase64(payload.imageBase64);
      setUrlImageUnavailable(false);
    } else {
      setUrlImageUnavailable(true);
    }

    setIsExtractingImage(false);
  }

  async function onImageFileSelected(file: File | null) {
    if (!file) {
      return;
    }

    const base64 = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = String(reader.result ?? "");
        const parts = result.split(",");
        resolve(parts.length > 1 ? parts[1] : null);
      };

      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

    if (!base64) {
      setError("Unable to read uploaded image");
      return;
    }

    setItemImageBase64(base64);
    setUrlImageUnavailable(false);
    setError(null);
  }

  async function saveItem() {
    setError(null);

    const title = form.title.trim();
    const price = Number(form.price);
    const quantity = Number(form.quantity);
    const priority = Number(form.priority);

    if (!title) {
      setError("Title is required");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setError("Price must be a number greater than or equal to 0");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError("Quantity must be an integer greater than or equal to 1");
      return;
    }

    if (![0, 1, 2].includes(priority)) {
      setError("Priority must be High, Medium, or Low");
      return;
    }

    setIsSaving(true);

    const isEditing = editingItemId !== null;
    const requestBody = {
      title,
      description: form.description.trim() || null,
      url: form.url.trim() || null,
      item_image: itemImageBase64 ?? editingItem?.item_image ?? null,
      price,
      quantity,
      priority,
      purchased: isEditing ? (editingItem?.purchased ?? false) : false,
      sequence: isEditing ? editingItem?.sequence : undefined,
    };

    const result = isEditing
      ? await updateWishlistItemAction(editingItemId, requestBody)
      : await createWishlistItemAction(requestBody);

    if (!result.ok) {
      setError(result.error ?? "Unable to save wishlist item");
      setIsSaving(false);
      return;
    }

    const payload = { item: result.item as WishlistItem };

    startTransition(() => {
      setItems((prev) => {
        if (!isEditing) {
          return [...prev, payload.item];
        }

        return prev.map((item) =>
          item.item_id === payload.item.item_id ? payload.item : item,
        );
      });
    });

    setIsSaving(false);
    setIsAddDialogOpen(false);
    resetForm();
  }

  async function deleteItem(itemId: number) {
    setError(null);
    setIsDeleting(true);

    const result = await deleteWishlistItemAction(itemId);

    if (!result.ok) {
      setError(result.error ?? "Unable to delete wishlist item");
      setIsDeleting(false);
      return;
    }

    setDeleteConfirmItem(null);
    startTransition(() => {
      setItems((prev) => prev.filter((item) => item.item_id !== itemId));
    });

    setIsDeleting(false);
  }

  function confirmAndDeleteItem() {
    if (!deleteConfirmItem) {
      return;
    }

    void deleteItem(deleteConfirmItem.item_id);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          size="icon-sm"
          className="h-8 w-auto px-3"
          onClick={() => {
            setError(null);
            resetForm();
            setIsAddDialogOpen(true);
          }}
        >
          Add List Item
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {sortedItems.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground shadow-sm">
          This wishlist has no items yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            Drag and drop items to reorder the wishlist.
          </div>
          <div className="hidden grid-cols-[96px_minmax(0,1fr)_110px_80px_190px] gap-4 border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid">
            <span>Item</span>
            <span>Details</span>
            <span>Price</span>
            <span>Qty</span>
            <span>Action</span>
          </div>

          <div className="divide-y-2 divide-border/90">
            {sortedItems.map((item) => (
              <div
                key={item.item_id}
                draggable={!isResequencing}
                onDragStart={() => {
                  setDraggingItemId(item.item_id);
                }}
                onDragEnd={() => {
                  setDraggingItemId(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();

                  if (draggingItemId !== null) {
                    void moveItem(draggingItemId, item.item_id);
                  }

                  setDraggingItemId(null);
                }}
                className={`cursor-move px-4 py-4 ${item.purchased ? "bg-muted/40" : "bg-card"} ${draggingItemId === item.item_id ? "opacity-60" : "opacity-100"}`}
              >
                <div className="grid gap-3 md:grid-cols-[96px_minmax(0,1fr)_110px_80px_190px] md:items-center md:gap-4">
                {item.item_image && !brokenImageItemIds.includes(item.item_id) ? (
                  <Image
                    src={`data:image/*;base64,${item.item_image}`}
                    alt={item.title}
                    width={80}
                    height={80}
                    unoptimized
                    onError={() => {
                      setBrokenImageItemIds((prev) =>
                        prev.includes(item.item_id) ? prev : [...prev, item.item_id],
                      );
                    }}
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

                    {/* {item.purchased ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        Purchased
                      </span>
                    ) : null} */}
                  </div>

                  {item.url ? (
                    <Link
                      href={normalizeItemUrl(item.url) ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-primary hover:text-primary/80"
                      title={item.url}
                    >
                      <span className="truncate">View Product</span>
                      <ExternalLink className="size-3.5 shrink-0" />
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">No product link</p>
                  )}
                </div>

                  <div className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-2 py-1.5 md:contents md:rounded-none md:border-0 md:bg-transparent md:p-0">
                    <div className="text-sm font-semibold text-foreground md:text-lg">
                      ${item.price.toFixed(2)}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground md:text-sm">
                      Qty {item.quantity}
                    </div>

                    <div className="ml-auto flex items-center gap-1.5 md:ml-0 md:gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="h-8 w-8 p-0"
                        disabled={isResequencing}
                        title="Edit item"
                        aria-label="Edit item"
                        onClick={() => {
                          setError(null);
                          setEditingItemId(item.item_id);
                          setEditingItem(item);
                          setForm({
                            title: item.title,
                            description: item.description ?? "",
                            url: item.url ?? "",
                            price: String(item.price),
                            quantity: String(item.quantity),
                            priority: String(item.priority) as "0" | "1" | "2",
                          });
                          setItemImageBase64(item.item_image);
                          setIsAddDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        className="h-8 w-8 p-0"
                        disabled={isPending || isResequencing}
                        title="Delete item"
                        aria-label="Delete item"
                        onClick={() => setDeleteConfirmItem(item)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAddDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">
              {editingItemId === null ? "Add List Item" : "Edit List Item"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {editingItemId === null
                ? "Enter the details for your new wishlist item."
                : "Update the details for this wishlist item."}
            </p>

            <div className="mt-4 grid gap-3">
              <div className="space-y-1">
                <Label htmlFor="wishlist-title">Title</Label>
                <Input
                  id="wishlist-title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Wireless mouse"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="wishlist-description">Description</Label>
                <textarea
                  id="wishlist-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                  placeholder="Optional description"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="wishlist-url">Product URL</Label>
                <Input
                  id="wishlist-url"
                  value={form.url}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, url: event.target.value }))
                  }
                  placeholder="https://example.com/product"
                />
                {isExtractingImage ? (
                  <p className="text-xs text-muted-foreground">Extracting image from URL...</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label>Image Preview</Label>
                <div className="flex items-center gap-3">
                  {itemImageBase64 ? (
                    <Image
                      src={`data:image/*;base64,${itemImageBase64}`}
                      alt="List item preview"
                      width={120}
                      height={120}
                      unoptimized
                      className="h-24 w-24 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
                      <Package className="size-8" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="h-8 w-auto px-3"
                      disabled={isExtractingImage}
                      onClick={() => {
                        void extractImageFromUrl();
                      }}
                    >
                      {isExtractingImage
                        ? "Extracting..."
                        : "Extract Image from URL"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="h-8 w-auto px-3"
                      onClick={() => manualImageInputRef.current?.click()}
                    >
                      Choose Image
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {urlImageUnavailable
                        ? "No image found at URL. Choose one from disk."
                        : "You can replace the image by selecting a file."}
                    </p>
                  </div>
                </div>

                <input
                  ref={manualImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void onImageFileSelected(file);
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="wishlist-price">Price</Label>
                  <Input
                    id="wishlist-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, price: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="wishlist-quantity">Quantity</Label>
                  <Input
                    id="wishlist-quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantity}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, quantity: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="wishlist-priority">Priority</Label>
                  <select
                    id="wishlist-priority"
                    value={form.priority}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        priority: event.target.value as "0" | "1" | "2",
                      }))
                    }
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="0">High</option>
                    <option value="1">Medium</option>
                    <option value="2">Low</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-8 w-auto px-3"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="icon-sm"
                className="h-8 w-auto px-3"
                disabled={isSaving}
                onClick={saveItem}
              >
                {isSaving
                  ? "Saving..."
                  : editingItemId === null
                    ? "Save"
                    : "Update"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Delete Item</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {deleteConfirmItem.purchased
                ? "Someone may have already bought this for you. Are you sure you want to delete this item anyway?"
                : "Are you sure you want to delete this item?"}
            </p>
            <p className="mt-2 truncate text-sm font-medium text-foreground" title={deleteConfirmItem.title}>
              {deleteConfirmItem.title}
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-8 w-auto px-3"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmItem(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                className="h-8 w-auto px-3"
                disabled={isDeleting}
                onClick={confirmAndDeleteItem}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAdminUserAction, updateAdminUserAction } from "@/app/actions/admin-users";
import { updateAdminWishlistAction } from "@/app/actions/admin-wishlists";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  is_verified: boolean;
  is_admin: boolean;
  created_at: string;
};

type AdminTodo = {
  todo_id: number;
  user_id: string;
  user_name: string;
  name: string;
  description: string;
  due_date: string | null;
  created_date: string;
  category: string;
  completed: boolean;
};

type AdminWishlist = {
  item_id: number;
  user_id: string;
  user_name: string;
  title: string;
  description: string | null;
  url: string | null;
  item_image: string | null;
  price: number;
  quantity: number;
  priority: number;
  purchased: boolean;
  sequence: number;
  created_date: string;
};

type AdminConsoleTabsProps = {
  users: AdminUser[];
  todos: AdminTodo[];
  wishlists: AdminWishlist[];
};

type AdminTab = "users" | "todos" | "wishlists";

const TABS: Array<{ id: AdminTab; label: string }> = [
  { id: "users", label: "Users" },
  { id: "todos", label: "Todos" },
  { id: "wishlists", label: "Wishlists" },
];

export function AdminConsoleTabs({ users, todos, wishlists }: AdminConsoleTabsProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [usersState, setUsersState] = useState(users);
  const [todosState, setTodosState] = useState(todos);
  const [wishlistsState, setWishlistsState] = useState(wishlists);
  const [userModalMode, setUserModalMode] = useState<"add" | "edit" | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    is_verified: false,
    is_admin: false,
  });
  const [todoUserFilter, setTodoUserFilter] = useState("");
  const [wishlistUserFilter, setWishlistUserFilter] = useState("");
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false);
  const [activeWishlistItemId, setActiveWishlistItemId] = useState<number | null>(null);
  const [isSavingWishlist, setIsSavingWishlist] = useState(false);
  const [isConvertingWishlistImage, setIsConvertingWishlistImage] = useState(false);
  const [wishlistModalError, setWishlistModalError] = useState<string | null>(null);
  const [wishlistForm, setWishlistForm] = useState({
    user_id: "",
    title: "",
    description: "",
    url: "",
    item_image: "",
    price: "0",
    quantity: "1",
    priority: "1",
    purchased: false,
    sequence: "0",
    created_date: "",
  });

  const normalizedTodoUserFilter = todoUserFilter.trim().toLowerCase();
  const filteredTodos = todosState.filter((todo) =>
    todo.user_name.toLowerCase().includes(normalizedTodoUserFilter),
  );

  const normalizedWishlistUserFilter = wishlistUserFilter.trim().toLowerCase();
  const filteredWishlists = wishlistsState.filter((item) =>
    item.user_name.toLowerCase().includes(normalizedWishlistUserFilter),
  );

  function closeUserModal() {
    setUserModalMode(null);
    setActiveUserId(null);
    setUserModalError(null);
    setIsSavingUser(false);
  }

  function closeWishlistModal() {
    setWishlistModalOpen(false);
    setActiveWishlistItemId(null);
    setWishlistModalError(null);
    setIsSavingWishlist(false);
  }

  function clearWishlistImage() {
    setWishlistForm((prev) => ({ ...prev, item_image: "" }));
  }

  async function handleWishlistImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setWishlistModalError("Please upload an image file");
      event.target.value = "";
      return;
    }

    setWishlistModalError(null);
    setIsConvertingWishlistImage(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Unable to read image file"));
        reader.readAsDataURL(file);
      });

      const commaIndex = dataUrl.indexOf(",");
      const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : "";

      if (!base64) {
        throw new Error("Unable to extract image data");
      }

      setWishlistForm((prev) => ({ ...prev, item_image: base64 }));
    } catch {
      setWishlistModalError("Unable to process selected image");
    } finally {
      setIsConvertingWishlistImage(false);
      event.target.value = "";
    }
  }

  function openEditWishlist(item: AdminWishlist) {
    setWishlistModalError(null);
    setActiveWishlistItemId(item.item_id);
    setWishlistForm({
      user_id: item.user_id,
      title: item.title,
      description: item.description ?? "",
      url: item.url ?? "",
      item_image: item.item_image ?? "",
      price: String(item.price),
      quantity: String(item.quantity),
      priority: String(item.priority),
      purchased: item.purchased,
      sequence: String(item.sequence),
      created_date: item.created_date,
    });
    setWishlistModalOpen(true);
  }

  async function saveWishlist() {
    if (!activeWishlistItemId) {
      setWishlistModalError("Wishlist item is missing");
      return;
    }

    const title = wishlistForm.title.trim();
    const userId = wishlistForm.user_id.trim();
    const createdDate = wishlistForm.created_date.trim();
    const price = Number(wishlistForm.price);
    const quantity = Number.parseInt(wishlistForm.quantity, 10);
    const priority = Number.parseInt(wishlistForm.priority, 10);
    const sequence = Number.parseInt(wishlistForm.sequence, 10);

    if (!userId) {
      setWishlistModalError("User ID is required");
      return;
    }

    if (!title) {
      setWishlistModalError("Title is required");
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      setWishlistModalError("Price must be 0 or greater");
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      setWishlistModalError("Quantity must be an integer greater than or equal to 1");
      return;
    }

    if (![0, 1, 2].includes(priority)) {
      setWishlistModalError("Priority must be 0, 1, or 2");
      return;
    }

    if (!Number.isInteger(sequence) || sequence < 0) {
      setWishlistModalError("Sequence must be an integer greater than or equal to 0");
      return;
    }

    if (!createdDate) {
      setWishlistModalError("Created Date is required");
      return;
    }

    setWishlistModalError(null);
    setIsSavingWishlist(true);

    const result = await updateAdminWishlistAction(activeWishlistItemId, {
      user_id: userId,
      title,
      description: wishlistForm.description.trim() || null,
      url: wishlistForm.url.trim() || null,
      item_image: wishlistForm.item_image.trim() || null,
      price,
      quantity,
      priority,
      purchased: wishlistForm.purchased,
      sequence,
      created_date: createdDate,
    });

    if (!result.ok) {
      setWishlistModalError(result.error ?? "Unable to update wishlist");
      setIsSavingWishlist(false);
      return;
    }

    const payload = { wishlist: result.wishlist as AdminWishlist };

    setWishlistsState((prev) =>
      prev.map((item) => (item.item_id === payload.wishlist.item_id ? payload.wishlist : item)),
    );

    setIsSavingWishlist(false);
    closeWishlistModal();
  }

  function openAddUser() {
    setUserModalError(null);
    setActiveUserId(null);
    setUserForm({
      name: "",
      email: "",
      password: "",
      is_verified: false,
      is_admin: false,
    });
    setUserModalMode("add");
  }

  function openEditUser(user: AdminUser) {
    setUserModalError(null);
    setActiveUserId(user.id);
    setUserForm({
      name: user.name,
      email: user.email,
      password: "",
      is_verified: user.is_verified,
      is_admin: user.is_admin,
    });
    setUserModalMode("edit");
  }

  async function saveUser() {
    const name = userForm.name.trim();
    const email = userForm.email.trim();

    if (!name) {
      setUserModalError("Name is required");
      return;
    }

    if (!email) {
      setUserModalError("Email is required");
      return;
    }

    if (userModalMode === "add" && !userForm.password) {
      setUserModalError("Password is required when adding a user");
      return;
    }

    setUserModalError(null);
    setIsSavingUser(true);

    const isEdit = userModalMode === "edit" && activeUserId;
    const result = isEdit
      ? await updateAdminUserAction(activeUserId, {
          name,
          email,
          password: userForm.password,
          is_verified: userForm.is_verified,
          is_admin: userForm.is_admin,
        })
      : await createAdminUserAction({
          name,
          email,
          password: userForm.password,
          is_verified: userForm.is_verified,
          is_admin: userForm.is_admin,
        });

    if (!result.ok) {
      setUserModalError(result.error ?? `Unable to ${isEdit ? "update" : "create"} user`);
      setIsSavingUser(false);
      return;
    }

    const payload = { user: result.user as AdminUser };

    if (isEdit) {
      const previous = usersState.find((user) => user.id === payload.user.id);
      const previousName = previous?.name ?? "";

      setUsersState((prev) => prev.map((user) => (user.id === payload.user.id ? payload.user : user)));

      if (previousName && previousName !== payload.user.name) {
        setTodosState((prev) =>
          prev.map((todo) =>
            todo.user_id === payload.user.id ? { ...todo, user_name: payload.user.name } : todo,
          ),
        );

        setWishlistsState((prev) =>
          prev.map((item) =>
            item.user_id === payload.user.id ? { ...item, user_name: payload.user.name } : item,
          ),
        );
      }
    } else {
      setUsersState((prev) => [payload.user, ...prev]);
    }

    setIsSavingUser(false);
    closeUserModal();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            size="icon-sm"
            className="h-8 w-auto px-3"
            variant={activeTab === tab.id ? "default" : "outline"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "users" ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Total users: {usersState.length}</p>
            <Button
              type="button"
              size="icon-sm"
              className="h-8 w-auto px-3"
              onClick={openAddUser}
            >
              Add User
            </Button>
          </div>
          {usersState.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Verified</th>
                    <th className="px-3 py-2">Admin</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {usersState.map((user) => (
                    <tr key={user.id} className="border-t border-border/60">
                      <td className="px-3 py-2 text-foreground">{user.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{user.email}</td>
                      <td className="px-3 py-2 text-muted-foreground">{user.is_verified ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{user.is_admin ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{user.created_at}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-auto px-3"
                          onClick={() => openEditUser(user)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "todos" ? (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Showing {filteredTodos.length} of {todosState.length} todos
            </p>
            <Input
              value={todoUserFilter}
              onChange={(event) => setTodoUserFilter(event.target.value)}
              placeholder="Filter by user name"
              className="h-8 w-full sm:w-64"
            />
          </div>
          {filteredTodos.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No todos match this user filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Task</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Due</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">User Name</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTodos.map((todo) => (
                    <tr key={todo.todo_id} className="border-t border-border/60">
                      <td className="px-3 py-2 text-foreground">{todo.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{todo.category}</td>
                      <td className="px-3 py-2 text-muted-foreground">{todo.completed ? "Completed" : "Pending"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{todo.due_date ?? "-"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{todo.created_date}</td>
                      <td className="px-3 py-2 text-muted-foreground">{todo.user_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "wishlists" ? (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Showing {filteredWishlists.length} of {wishlistsState.length} wishlist items
            </p>
            <Input
              value={wishlistUserFilter}
              onChange={(event) => setWishlistUserFilter(event.target.value)}
              placeholder="Filter by user name"
              className="h-8 w-full sm:w-64"
            />
          </div>
          {filteredWishlists.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No wishlist items match this user filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Purchased</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">User Name</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWishlists.map((item) => (
                    <tr key={item.item_id} className="border-t border-border/60">
                      <td className="px-3 py-2 text-foreground">{item.title}</td>
                      <td className="px-3 py-2 text-muted-foreground">${item.price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.quantity}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.priority}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.purchased ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.created_date}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.user_name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-auto px-3"
                          onClick={() => openEditWishlist(item)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {userModalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">
              {userModalMode === "add" ? "Add User" : "Edit User"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {userModalMode === "add"
                ? "Enter information for the new user."
                : "Update user details. Leave password blank to keep the current password."}
            </p>

            <div className="mt-4 grid gap-3">
              <div className="space-y-1">
                <Label htmlFor="admin-user-name">Name</Label>
                <Input
                  id="admin-user-name"
                  value={userForm.name}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="admin-user-email">Email</Label>
                <Input
                  id="admin-user-email"
                  type="email"
                  value={userForm.email}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="admin-user-password">
                  {userModalMode === "add" ? "Password" : "New Password"}
                </Label>
                <Input
                  id="admin-user-password"
                  type="password"
                  value={userForm.password}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder={userModalMode === "add" ? "Required" : "Optional"}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={userForm.is_verified}
                  onChange={(event) =>
                    setUserForm((prev) => ({ ...prev, is_verified: event.target.checked }))
                  }
                />
                Verified user
              </label>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={userForm.is_admin}
                  onChange={(event) =>
                    setUserForm((prev) => ({ ...prev, is_admin: event.target.checked }))
                  }
                />
                Admin user
              </label>

              {userModalError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {userModalError}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-8 w-auto px-3"
                disabled={isSavingUser}
                onClick={closeUserModal}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="icon-sm"
                className="h-8 w-auto px-3"
                disabled={isSavingUser}
                onClick={saveUser}
              >
                {isSavingUser
                  ? userModalMode === "add"
                    ? "Creating..."
                    : "Saving..."
                  : userModalMode === "add"
                    ? "Create"
                    : "Update"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {wishlistModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Edit Wishlist Item</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Update any wishlist property and save your changes.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="admin-wishlist-user-id">User ID</Label>
                <Input
                  id="admin-wishlist-user-id"
                  value={wishlistForm.user_id}
                  onChange={(event) =>
                    setWishlistForm((prev) => ({ ...prev, user_id: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="admin-wishlist-title">Title</Label>
                <Input
                  id="admin-wishlist-title"
                  value={wishlistForm.title}
                  onChange={(event) =>
                    setWishlistForm((prev) => ({ ...prev, title: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="admin-wishlist-description">Description</Label>
                <textarea
                  id="admin-wishlist-description"
                  value={wishlistForm.description}
                  onChange={(event) =>
                    setWishlistForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="admin-wishlist-url">URL</Label>
                <Input
                  id="admin-wishlist-url"
                  value={wishlistForm.url}
                  onChange={(event) =>
                    setWishlistForm((prev) => ({ ...prev, url: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="admin-wishlist-image">Image (base64)</Label>
                <textarea
                  id="admin-wishlist-image"
                  value={wishlistForm.item_image}
                  onChange={(event) =>
                    setWishlistForm((prev) => ({ ...prev, item_image: event.target.value }))
                  }
                  rows={4}
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleWishlistImageUpload}
                    disabled={isConvertingWishlistImage}
                    className="h-8 w-full sm:w-64"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="h-8 w-auto px-3"
                    onClick={clearWishlistImage}
                    disabled={isConvertingWishlistImage || !wishlistForm.item_image}
                  >
                    Clear Image
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {isConvertingWishlistImage ? "Converting image..." : "Upload or paste base64"}
                  </span>
                </div>
                {wishlistForm.item_image ? (
                  <Image
                    src={`data:image/png;base64,${wishlistForm.item_image}`}
                    alt="Wishlist preview"
                    width={96}
                    height={96}
                    unoptimized
                    className="mt-2 h-24 w-24 rounded border border-border object-cover"
                  />
                ) : null}
              </div>

              <div className="space-y-1">
                <Label htmlFor="admin-wishlist-price">Price</Label>
                <Input
                  id="admin-wishlist-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={wishlistForm.price}
                  onChange={(event) =>
                    setWishlistForm((prev) => ({ ...prev, price: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="admin-wishlist-quantity">Quantity</Label>
                <Input
                  id="admin-wishlist-quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={wishlistForm.quantity}
                  onChange={(event) =>
                    setWishlistForm((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="admin-wishlist-priority">Priority (0-2)</Label>
                <Input
                  id="admin-wishlist-priority"
                  type="number"
                  min="0"
                  max="2"
                  step="1"
                  value={wishlistForm.priority}
                  onChange={(event) =>
                    setWishlistForm((prev) => ({ ...prev, priority: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="admin-wishlist-sequence">Sequence</Label>
                <Input
                  id="admin-wishlist-sequence"
                  type="number"
                  min="0"
                  step="1"
                  value={wishlistForm.sequence}
                  onChange={(event) =>
                    setWishlistForm((prev) => ({ ...prev, sequence: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="admin-wishlist-created">Created Date</Label>
                <Input
                  id="admin-wishlist-created"
                  value={wishlistForm.created_date}
                  onChange={(event) =>
                    setWishlistForm((prev) => ({ ...prev, created_date: event.target.value }))
                  }
                  placeholder="YYYY-MM-DD"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
                <input
                  type="checkbox"
                  checked={wishlistForm.purchased}
                  onChange={(event) =>
                    setWishlistForm((prev) => ({ ...prev, purchased: event.target.checked }))
                  }
                />
                Purchased
              </label>

              {wishlistModalError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
                  {wishlistModalError}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-8 w-auto px-3"
                disabled={isSavingWishlist}
                onClick={closeWishlistModal}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="icon-sm"
                className="h-8 w-auto px-3"
                disabled={isSavingWishlist}
                onClick={saveWishlist}
              >
                {isSavingWishlist ? "Saving..." : "Update"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

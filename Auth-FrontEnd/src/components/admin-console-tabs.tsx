"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  price: number;
  quantity: number;
  priority: number;
  purchased: boolean;
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
    const endpoint = isEdit ? `/api/admin/users/${activeUserId}` : "/api/admin/users";
    const method = isEdit ? "PUT" : "POST";

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password: userForm.password,
        is_verified: userForm.is_verified,
        is_admin: userForm.is_admin,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setUserModalError(payload?.error ?? `Unable to ${isEdit ? "update" : "create"} user`);
      setIsSavingUser(false);
      return;
    }

    const payload = (await response.json()) as { user: AdminUser };

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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {userModalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
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
    </div>
  );
}

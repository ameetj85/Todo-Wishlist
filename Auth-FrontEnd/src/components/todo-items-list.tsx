"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTodoAction,
  deleteTodoAction,
  updateTodoAction,
} from "@/app/actions/todos";

type TodoItem = {
  todo_id: number;
  user_id: string;
  name: string;
  description: string;
  due_date: string | null;
  remind_me: boolean;
  reminder_date: string | null;
  reminder_sent: boolean;
  created_date: string;
  category: string;
  completed: boolean;
};

type TodoItemsListProps = {
  initialTodos: TodoItem[];
};

type TodoForm = {
  name: string;
  description: string;
  category: string;
  due_date: string;
  remind_me: boolean;
  reminder_date: string;
  reminder_sent: boolean;
  completed: boolean;
};

type TodoSortField = "date" | "category" | "status";
type SortDirection = "asc" | "desc";

function toDateInputValue(value: string | null) {
  return value ?? "";
}

function toDateTimeInputValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoDateTimeOrNull(value: string) {
  if (!value.trim()) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

export function TodoItemsList({ initialTodos }: TodoItemsListProps) {
  const [todos, setTodos] = useState(initialTodos);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [todoDialogMode, setTodoDialogMode] = useState<"add" | "edit" | null>(null);
  const [activeTodoId, setActiveTodoId] = useState<number | null>(null);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [todoForm, setTodoForm] = useState<TodoForm>({
    name: "",
    description: "",
    category: "",
    due_date: "",
    remind_me: false,
    reminder_date: "",
    reminder_sent: false,
    completed: false,
  });
  const [isSubmittingTodo, setIsSubmittingTodo] = useState(false);

  const [deleteTodo, setDeleteTodo] = useState<TodoItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortField, setSortField] = useState<TodoSortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedTodos = useMemo(() => {
    const list = [...todos];

    list.sort((a, b) => {
      let comparison = 0;

      if (sortField === "category") {
        comparison = a.category.localeCompare(b.category);
      } else if (sortField === "status") {
        comparison = Number(a.completed) - Number(b.completed);
      } else {
        const aDate = a.due_date ?? a.created_date;
        const bDate = b.due_date ?? b.created_date;
        comparison = aDate.localeCompare(bDate);
      }

      if (comparison === 0) {
        comparison = a.todo_id - b.todo_id;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return list;
  }, [sortDirection, sortField, todos]);

  const existingCategories = useMemo(() => {
    return Array.from(
      new Set(
        todos
          .map((todo) => todo.category.trim())
          .filter((category) => category.length > 0),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [todos]);

  function resetTodoForm() {
    setTodoForm({
      name: "",
      description: "",
      category: "",
      due_date: "",
      remind_me: false,
      reminder_date: "",
      reminder_sent: false,
      completed: false,
    });
  }

  function openAdd() {
    setError(null);
    setDialogError(null);
    setActiveTodoId(null);
    setIsCustomCategory(false);
    resetTodoForm();
    setTodoDialogMode("add");
  }

  function openEdit(todo: TodoItem) {
    setError(null);
    setDialogError(null);
    setActiveTodoId(todo.todo_id);
    setTodoForm({
      name: todo.name,
      description: todo.description,
      category: todo.category,
      due_date: toDateInputValue(todo.due_date),
      remind_me: todo.remind_me,
      reminder_date: toDateTimeInputValue(todo.reminder_date),
      reminder_sent: todo.reminder_sent,
      completed: todo.completed,
    });
    setIsCustomCategory(!existingCategories.includes(todo.category));
    setTodoDialogMode("edit");
  }

  function closeTodoDialog() {
    setTodoDialogMode(null);
    setActiveTodoId(null);
    setDialogError(null);
  }

  async function submitTodo() {
    const name = todoForm.name.trim();
    const description = todoForm.description.trim();
    const category = todoForm.category.trim();
    const dueDate = todoForm.due_date.trim();
    const reminderDate = todoForm.reminder_date.trim();

    if (!name) {
      setDialogError("Name is required");
      return;
    }

    if (!description) {
      setDialogError("Description is required");
      return;
    }

    if (!category) {
      setDialogError("Category is required");
      return;
    }

    if (todoForm.remind_me && !reminderDate) {
      setDialogError("Reminder date and time is required when Remind Me is enabled");
      return;
    }

    const reminderDateIso = todoForm.remind_me
      ? toIsoDateTimeOrNull(reminderDate)
      : null;

    if (todoForm.remind_me && !reminderDateIso) {
      setDialogError("Reminder date and time must be valid");
      return;
    }

    setDialogError(null);
    setIsSubmittingTodo(true);

    const isEdit = todoDialogMode === "edit" && activeTodoId !== null;
    const endpoint = isEdit ? `/api/todos/${activeTodoId}` : "/api/todos";
    const method = isEdit ? "PUT" : "POST";

    const actionResult = isEdit
      ? await updateTodoAction(activeTodoId, {
          name,
          description,
          category,
          due_date: dueDate ? dueDate : null,
          remind_me: todoForm.remind_me,
          reminder_date: reminderDateIso,
          reminder_sent: todoForm.remind_me ? todoForm.reminder_sent : false,
          completed: todoForm.completed,
        })
      : await createTodoAction({
          name,
          description,
          category,
          due_date: dueDate ? dueDate : null,
          remind_me: todoForm.remind_me,
          reminder_date: reminderDateIso,
          reminder_sent: false,
          completed: todoForm.completed,
        });

    if (!actionResult.ok) {
      setDialogError(actionResult.error ?? `Unable to ${isEdit ? "update" : "create"} todo`);
      setIsSubmittingTodo(false);
      return;
    }

    const payload = { todo: actionResult.todo as TodoItem };

    startTransition(() => {
      if (isEdit) {
        setTodos((prev) =>
          prev.map((todo) =>
            todo.todo_id === payload.todo.todo_id ? payload.todo : todo,
          ),
        );
        return;
      }

      setTodos((prev) => [...prev, payload.todo]);
    });

    setIsSubmittingTodo(false);
    closeTodoDialog();
    resetTodoForm();
  }

  async function confirmDelete() {
    if (!deleteTodo) {
      return;
    }

    setError(null);
    setIsDeleting(true);

    const result = await deleteTodoAction(deleteTodo.todo_id);

    if (!result.ok) {
      setError(result.error ?? "Unable to delete todo");
      setIsDeleting(false);
      return;
    }

    const deletedTodoId = deleteTodo.todo_id;

    startTransition(() => {
      setTodos((prev) => prev.filter((todo) => todo.todo_id !== deletedTodoId));
    });

    setDeleteTodo(null);
    setIsDeleting(false);
  }

  useEffect(() => {
    if (!deleteTodo) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeleting) {
        setDeleteTodo(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [deleteTodo, isDeleting]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="todo-sort-field" className="text-xs text-muted-foreground">
            Sort By
          </Label>
          <select
            id="todo-sort-field"
            value={sortField}
            onChange={(event) => setSortField(event.target.value as TodoSortField)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="date">Date</option>
            <option value="category">Category</option>
            <option value="status">Status</option>
          </select>

          <select
            aria-label="Sort direction"
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as SortDirection)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>

        <Button
          type="button"
          size="icon-sm"
          className="h-8 w-auto px-3"
          onClick={openAdd}
        >
          Add Todo
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {sortedTodos.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground shadow-sm">
          You have no todo items yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="hidden grid-cols-[minmax(0,1fr)_140px_120px_180px] gap-4 border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:grid">
            <span>Task</span>
            <span>Category</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {sortedTodos.map((todo) => (
            <div
              key={todo.todo_id}
              className="border-b border-border/60 bg-card px-4 py-4 last:border-b-0"
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_120px_180px] md:items-start md:gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-[15px] font-medium text-foreground" title={todo.name}>
                    {todo.name}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground" title={todo.description}>
                    {todo.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Due: {todo.due_date ?? "No due date"}
                  </p>
                </div>

                <div className="text-sm font-medium text-muted-foreground">{todo.category}</div>

                <div>
                  {todo.completed ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      Completed
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      Pending
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="h-8 w-auto px-3"
                    disabled={isPending}
                    onClick={() => openEdit(todo)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    className="h-8 w-auto px-3"
                    disabled={isPending}
                    onClick={() => {
                      setError(null);
                      setDeleteTodo(todo);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {todoDialogMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">
              {todoDialogMode === "add" ? "Add Todo" : "Edit Todo"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {todoDialogMode === "add"
                ? "Enter details for your new todo."
                : "Update your todo details."}
            </p>

            <div className="mt-4 grid gap-3">
              <div className="space-y-1">
                <Label htmlFor="todo-name">Name</Label>
                <Input
                  id="todo-name"
                  value={todoForm.name}
                  onChange={(event) =>
                    setTodoForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="todo-description">Description</Label>
                <textarea
                  id="todo-description"
                  value={todoForm.description}
                  onChange={(event) =>
                    setTodoForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                  className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="todo-category">Category</Label>
                  {!isCustomCategory ? (
                    <select
                      id="todo-category"
                      value={todoForm.category || ""}
                      onChange={(event) => {
                        const value = event.target.value;

                        if (value === "__new__") {
                          setIsCustomCategory(true);
                          setTodoForm((prev) => ({ ...prev, category: "" }));
                          return;
                        }

                        setTodoForm((prev) => ({ ...prev, category: value }));
                      }}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <option value="">Select category</option>
                      {existingCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                      <option value="__new__">+ Create new category</option>
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        id="todo-category"
                        value={todoForm.category}
                        onChange={(event) =>
                          setTodoForm((prev) => ({ ...prev, category: event.target.value }))
                        }
                        placeholder="Enter new category"
                      />
                      {existingCategories.length > 0 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-auto px-3"
                          onClick={() => {
                            setIsCustomCategory(false);
                            setTodoForm((prev) => ({ ...prev, category: "" }));
                          }}
                        >
                          Choose Existing Category
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="todo-due-date">Due Date</Label>
                  <Input
                    id="todo-due-date"
                    type="date"
                    value={todoForm.due_date}
                    onChange={(event) =>
                      setTodoForm((prev) => ({ ...prev, due_date: event.target.value }))
                    }
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={todoForm.remind_me}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setTodoForm((prev) => ({
                      ...prev,
                      remind_me: enabled,
                      reminder_date: enabled ? prev.reminder_date : "",
                      reminder_sent: enabled ? prev.reminder_sent : false,
                    }));
                  }}
                />
                Remind me
              </label>

              <div className="space-y-1">
                <Label htmlFor="todo-reminder-date">
                  Reminder Date &amp; Time
                  {todoForm.remind_me ? (
                    <span className="ml-1 text-destructive" aria-hidden="true">*</span>
                  ) : null}
                </Label>
                <Input
                  id="todo-reminder-date"
                  type="datetime-local"
                  value={todoForm.reminder_date}
                  disabled={!todoForm.remind_me}
                  required={todoForm.remind_me}
                  onChange={(event) =>
                    setTodoForm((prev) => ({ ...prev, reminder_date: event.target.value }))
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={todoForm.completed}
                  onChange={(event) =>
                    setTodoForm((prev) => ({ ...prev, completed: event.target.checked }))
                  }
                />
                Mark as completed
              </label>
            </div>

            {dialogError ? (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {dialogError}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-8 w-auto px-3"
                disabled={isSubmittingTodo}
                onClick={closeTodoDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="icon-sm"
                className="h-8 w-auto px-3"
                disabled={isSubmittingTodo}
                onClick={submitTodo}
              >
                {isSubmittingTodo
                  ? todoDialogMode === "add"
                    ? "Creating..."
                    : "Saving..."
                  : todoDialogMode === "add"
                    ? "Create"
                    : "Update"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTodo ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isDeleting) {
              setDeleteTodo(null);
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Delete Todo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This action cannot be undone. Confirm that you want to delete this todo item.
            </p>
            <p className="mt-2 truncate text-sm font-medium text-foreground" title={deleteTodo.name}>
              {deleteTodo.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Press Esc to cancel.</p>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="h-8 w-auto px-3"
                disabled={isDeleting}
                onClick={() => setDeleteTodo(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                className="h-8 w-auto px-3"
                disabled={isDeleting}
                onClick={confirmDelete}
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

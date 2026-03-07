"use strict";

const express = require("express");
const { getDb } = require("../db/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

function toTodoResponse(row) {
  return {
    todo_id: row.todo_id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    due_date: row.due_date,
    created_date: row.created_date,
    category: row.category,
    completed: !!row.completed,
  };
}

function parseTodoId(value) {
  const todoId = Number.parseInt(value, 10);
  return Number.isInteger(todoId) && todoId > 0 ? todoId : null;
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

router.post("/", (req, res) => {
  const { name, description, due_date, category, completed } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    return res.status(400).json({ error: "description is required" });
  }
  if (!category || typeof category !== "string" || !category.trim()) {
    return res.status(400).json({ error: "category is required" });
  }
  if (
    due_date !== undefined &&
    due_date !== null &&
    (typeof due_date !== "string" || !isValidDate(due_date))
  ) {
    return res
      .status(400)
      .json({ error: "due_date must be in YYYY-MM-DD format" });
  }
  if (completed !== undefined && typeof completed !== "boolean") {
    return res.status(400).json({ error: "completed must be a boolean" });
  }

  const db = getDb();
  const result = db
    .prepare(
      `
    INSERT INTO Todo (user_id, name, description, due_date, category, completed)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      req.user.id,
      name.trim(),
      description.trim(),
      due_date ?? null,
      category.trim(),
      completed ? 1 : 0,
    );

  const todo = db
    .prepare("SELECT * FROM Todo WHERE todo_id = ? AND user_id = ?")
    .get(result.lastInsertRowid, req.user.id);

  return res.status(201).json({ todo: toTodoResponse(todo) });
});

router.get("/", (req, res) => {
  const todos = getDb()
    .prepare(
      `
    SELECT *
    FROM Todo
    WHERE user_id = ?
    ORDER BY created_date DESC, todo_id DESC
  `,
    )
    .all(req.user.id);

  return res.json({ todos: todos.map(toTodoResponse) });
});

router.get("/:todoId", (req, res) => {
  const todoId = parseTodoId(req.params.todoId);
  if (!todoId) return res.status(400).json({ error: "Invalid todo_id" });

  const todo = getDb()
    .prepare("SELECT * FROM Todo WHERE todo_id = ? AND user_id = ?")
    .get(todoId, req.user.id);

  if (!todo) return res.status(404).json({ error: "Todo not found" });
  return res.json({ todo: toTodoResponse(todo) });
});

router.put("/", (req, res) => {
  const todoId = parseTodoId(req.body.todo_id);
  if (!todoId) return res.status(400).json({ error: "Invalid todo_id" });

  const { name, description, due_date, category, completed } = req.body;
  const updates = [];
  const values = [];

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim())
      return res.status(400).json({ error: "name must be a non-empty string" });
    updates.push("name = ?");
    values.push(name.trim());
  }
  if (description !== undefined) {
    if (typeof description !== "string" || !description.trim())
      return res
        .status(400)
        .json({ error: "description must be a non-empty string" });
    updates.push("description = ?");
    values.push(description.trim());
  }
  if (category !== undefined) {
    if (typeof category !== "string" || !category.trim())
      return res
        .status(400)
        .json({ error: "category must be a non-empty string" });
    updates.push("category = ?");
    values.push(category.trim());
  }
  if (due_date !== undefined) {
    if (
      due_date !== null &&
      (typeof due_date !== "string" || !isValidDate(due_date))
    ) {
      return res
        .status(400)
        .json({ error: "due_date must be null or YYYY-MM-DD format" });
    }
    updates.push("due_date = ?");
    values.push(due_date);
  }
  if (completed !== undefined) {
    if (typeof completed !== "boolean")
      return res.status(400).json({ error: "completed must be a boolean" });
    updates.push("completed = ?");
    values.push(completed ? 1 : 0);
  }

  if (updates.length === 0) {
    return res
      .status(400)
      .json({ error: "At least one updatable field is required" });
  }

  const db = getDb();
  const result = db
    .prepare(
      `
    UPDATE Todo
    SET ${updates.join(", ")}
    WHERE todo_id = ? AND user_id = ?
  `,
    )
    .run(...values, todoId, req.user.id);

  if (result.changes === 0)
    return res.status(404).json({ error: "Todo not found" });

  const todo = db
    .prepare("SELECT * FROM Todo WHERE todo_id = ? AND user_id = ?")
    .get(todoId, req.user.id);

  return res.json({ todo: toTodoResponse(todo) });
});

router.delete("/:todoId", (req, res) => {
  const todoId = parseTodoId(req.params.todoId);
  if (!todoId) return res.status(400).json({ error: "Invalid todo_id" });

  const result = getDb()
    .prepare("DELETE FROM Todo WHERE todo_id = ? AND user_id = ?")
    .run(todoId, req.user.id);

  if (result.changes === 0)
    return res.status(404).json({ error: "Todo not found" });
  return res.json({ message: "Todo deleted successfully" });
});

module.exports = router;

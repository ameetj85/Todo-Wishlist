"use strict";

const express = require("express");
const { prisma } = require("../db/prisma");
const { requireAuth } = require("../middleware/auth");
const { toSqliteDateOnly } = require("../utils/dates");

const router = express.Router();

router.use(requireAuth);

function toTodoResponse(row) {
  return {
    todo_id: row.todoId,
    user_id: row.userId,
    name: row.name,
    description: row.description,
    due_date: row.dueDate,
    created_date: row.createdDate,
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

router.post("/", async (req, res) => {
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

  const todo = await prisma.todo.create({
    data: {
      userId: req.user.id,
      name: name.trim(),
      description: description.trim(),
      dueDate: due_date ?? null,
      category: category.trim(),
      completed: !!completed,
      createdDate: toSqliteDateOnly(Date.now()),
    },
  });

  return res.status(201).json({ todo: toTodoResponse(todo) });
});

router.get("/", async (req, res) => {
  const todos = await prisma.todo.findMany({
    where: { userId: req.user.id },
    orderBy: [{ createdDate: "desc" }, { todoId: "desc" }],
  });

  return res.json({ todos: todos.map(toTodoResponse) });
});

router.get("/:todoId", async (req, res) => {
  const todoId = parseTodoId(req.params.todoId);
  if (!todoId) return res.status(400).json({ error: "Invalid todo_id" });

  const todo = await prisma.todo.findFirst({
    where: { todoId, userId: req.user.id },
  });

  if (!todo) return res.status(404).json({ error: "Todo not found" });
  return res.json({ todo: toTodoResponse(todo) });
});

router.put("/", async (req, res) => {
  const todoId = parseTodoId(req.body.todo_id);
  if (!todoId) return res.status(400).json({ error: "Invalid todo_id" });

  const { name, description, due_date, category, completed } = req.body;
  const data = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim())
      return res.status(400).json({ error: "name must be a non-empty string" });
    data.name = name.trim();
  }
  if (description !== undefined) {
    if (typeof description !== "string" || !description.trim())
      return res
        .status(400)
        .json({ error: "description must be a non-empty string" });
    data.description = description.trim();
  }
  if (category !== undefined) {
    if (typeof category !== "string" || !category.trim())
      return res
        .status(400)
        .json({ error: "category must be a non-empty string" });
    data.category = category.trim();
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
    data.dueDate = due_date;
  }
  if (completed !== undefined) {
    if (typeof completed !== "boolean")
      return res.status(400).json({ error: "completed must be a boolean" });
    data.completed = completed;
  }

  if (Object.keys(data).length === 0) {
    return res
      .status(400)
      .json({ error: "At least one updatable field is required" });
  }

  const result = await prisma.todo.updateMany({
    where: { todoId, userId: req.user.id },
    data,
  });

  if (result.count === 0)
    return res.status(404).json({ error: "Todo not found" });

  const todo = await prisma.todo.findFirst({
    where: { todoId, userId: req.user.id },
  });

  return res.json({ todo: toTodoResponse(todo) });
});

router.delete("/:todoId", async (req, res) => {
  const todoId = parseTodoId(req.params.todoId);
  if (!todoId) return res.status(400).json({ error: "Invalid todo_id" });

  const result = await prisma.todo.deleteMany({
    where: { todoId, userId: req.user.id },
  });

  if (result.count === 0)
    return res.status(404).json({ error: "Todo not found" });
  return res.json({ message: "Todo deleted successfully" });
});

module.exports = router;

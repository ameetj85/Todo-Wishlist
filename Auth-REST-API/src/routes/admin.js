"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { prisma } = require("../db/prisma");
const { requireAuth } = require("../middleware/auth");
const config = require("../config");
const { validatePassword } = require("../validators");

const router = express.Router();

router.use(requireAuth);

router.use((req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
});

router.post("/users", async (req, res) => {
  const { email, name, password, is_verified, is_admin } = req.body;

  const normalizedEmail = String(email ?? "").toLowerCase().trim();
  const trimmedName = String(name ?? "").trim();
  const rawPassword = String(password ?? "");

  if (!normalizedEmail) {
    return res.status(400).json({ error: "email is required" });
  }

  if (!trimmedName) {
    return res.status(400).json({ error: "name is required" });
  }

  if (!rawPassword) {
    return res.status(400).json({ error: "password is required" });
  }

  const passwordError = validatePassword(rawPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    return res.status(409).json({ error: "A user with this email already exists" });
  }

  const hash = await bcrypt.hash(rawPassword, config.bcrypt.saltRounds);

  const user = await prisma.user.create({
    data: {
      id: uuidv4(),
      email: normalizedEmail,
      name: trimmedName,
      password: hash,
      isVerified: !!is_verified,
      isAdmin: !!is_admin,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isVerified: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  return res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      is_verified: !!user.isVerified,
      is_admin: !!user.isAdmin,
      created_at: user.createdAt,
    },
  });
});

router.put("/users/:userId", async (req, res) => {
  const { userId } = req.params;
  const { email, name, password, is_verified, is_admin } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!existingUser) {
    return res.status(404).json({ error: "User not found" });
  }

  const data = {};

  if (email !== undefined) {
    const normalizedEmail = String(email).toLowerCase().trim();

    if (!normalizedEmail) {
      return res.status(400).json({ error: "email must be a non-empty string" });
    }

    if (normalizedEmail !== existingUser.email) {
      const duplicate = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (duplicate) {
        return res.status(409).json({ error: "A user with this email already exists" });
      }
    }

    data.email = normalizedEmail;
  }

  if (name !== undefined) {
    const trimmedName = String(name).trim();

    if (!trimmedName) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }

    data.name = trimmedName;
  }

  if (password !== undefined && String(password).length > 0) {
    const rawPassword = String(password);
    const passwordError = validatePassword(rawPassword);

    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    data.password = await bcrypt.hash(rawPassword, config.bcrypt.saltRounds);
  }

  if (is_verified !== undefined) {
    data.isVerified = !!is_verified;
  }

  if (is_admin !== undefined) {
    data.isAdmin = !!is_admin;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "At least one updatable field is required" });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      isVerified: true,
      isAdmin: true,
      createdAt: true,
    },
  });

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      is_verified: !!user.isVerified,
      is_admin: !!user.isAdmin,
      created_at: user.createdAt,
    },
  });
});

router.get("/overview", async (_req, res) => {
  const [users, todos, wishlists] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        isVerified: true,
        isAdmin: true,
        createdAt: true,
      },
    }),
    prisma.todo.findMany({
      orderBy: [{ createdDate: "desc" }, { todoId: "desc" }],
      select: {
        todoId: true,
        userId: true,
        user: {
          select: {
            name: true,
          },
        },
        name: true,
        description: true,
        dueDate: true,
        createdDate: true,
        category: true,
        completed: true,
      },
    }),
    prisma.wishlistItem.findMany({
      orderBy: [{ createdDate: "desc" }, { itemId: "desc" }],
      select: {
        itemId: true,
        userId: true,
        user: {
          select: {
            name: true,
          },
        },
        title: true,
        price: true,
        quantity: true,
        priority: true,
        purchased: true,
        createdDate: true,
      },
    }),
  ]);

  return res.json({
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      is_verified: !!user.isVerified,
      is_admin: !!user.isAdmin,
      created_at: user.createdAt,
    })),
    todos: todos.map((todo) => ({
      todo_id: todo.todoId,
      user_id: todo.userId,
      user_name: todo.user?.name ?? "Unknown",
      name: todo.name,
      description: todo.description,
      due_date: todo.dueDate,
      created_date: todo.createdDate,
      category: todo.category,
      completed: !!todo.completed,
    })),
    wishlists: wishlists.map((item) => ({
      item_id: item.itemId,
      user_id: item.userId,
      user_name: item.user?.name ?? "Unknown",
      title: item.title,
      price: item.price,
      quantity: item.quantity,
      priority: item.priority,
      purchased: !!item.purchased,
      created_date: item.createdDate,
    })),
  });
});

module.exports = router;

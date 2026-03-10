"use strict";

const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { prisma } = require("../db/prisma");
const { requireAuth } = require("../middleware/auth");
const config = require("../config");
const { validatePassword } = require("../validators");

const router = express.Router();

function parseItemId(value) {
  const itemId = Number.parseInt(value, 10);
  return Number.isInteger(itemId) && itemId > 0 ? itemId : null;
}

function parseInteger(value, fieldName, { min = null } = {}) {
  if (!Number.isInteger(value)) return `${fieldName} must be an integer`;
  if (min !== null && value < min) {
    return `${fieldName} must be greater than or equal to ${min}`;
  }
  return null;
}

function parsePrice(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { error: "price must be a number" };
  }

  if (value < 0) {
    return { error: "price must be greater than or equal to 0" };
  }

  return { value };
}

function parseOptionalImageBlob(itemImage) {
  if (itemImage === null) return { blob: null };

  if (typeof itemImage !== "string") {
    return { error: "item_image must be a base64 string or null" };
  }

  try {
    const blob = Buffer.from(itemImage, "base64");
    return { blob };
  } catch {
    return { error: "item_image must be a valid base64 string" };
  }
}

function toAdminWishlistResponse(item) {
  return {
    item_id: item.itemId,
    user_id: item.userId,
    user_name: item.user?.name ?? "Unknown",
    title: item.title,
    description: item.description,
    url: item.url,
    item_image: item.itemImage ? Buffer.from(item.itemImage).toString("base64") : null,
    price: item.price,
    quantity: item.quantity,
    priority: item.priority,
    purchased: !!item.purchased,
    sequence: item.sequence,
    created_date: item.createdDate,
  };
}

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

router.put("/wishlists/:itemId", async (req, res) => {
  const itemId = parseItemId(req.params.itemId);

  if (!itemId) {
    return res.status(400).json({ error: "Invalid item_id" });
  }

  const {
    user_id,
    title,
    description,
    url,
    item_image,
    price,
    quantity,
    priority,
    purchased,
    sequence,
    created_date,
  } = req.body;

  const data = {};

  if (user_id !== undefined) {
    const userId = String(user_id).trim();

    if (!userId) {
      return res.status(400).json({ error: "user_id must be a non-empty string" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return res.status(400).json({ error: "user_id must reference an existing user" });
    }

    data.userId = userId;
  }

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "title must be a non-empty string" });
    }
    data.title = title.trim();
  }

  if (description !== undefined) {
    if (description !== null && typeof description !== "string") {
      return res.status(400).json({ error: "description must be a string or null" });
    }
    data.description = description;
  }

  if (url !== undefined) {
    if (url !== null && typeof url !== "string") {
      return res.status(400).json({ error: "url must be a string or null" });
    }
    data.url = url;
  }

  if (item_image !== undefined) {
    const image = parseOptionalImageBlob(item_image);
    if (image.error) return res.status(400).json({ error: image.error });
    data.itemImage = image.blob;
  }

  if (price !== undefined) {
    const parsedPrice = parsePrice(price);
    if (parsedPrice.error) {
      return res.status(400).json({ error: parsedPrice.error });
    }
    data.price = parsedPrice.value;
  }

  if (quantity !== undefined) {
    const quantityErr = parseInteger(quantity, "quantity", { min: 1 });
    if (quantityErr) return res.status(400).json({ error: quantityErr });
    data.quantity = quantity;
  }

  if (priority !== undefined) {
    if (![0, 1, 2].includes(priority)) {
      return res.status(400).json({ error: "priority must be one of 0, 1, or 2" });
    }
    data.priority = priority;
  }

  if (purchased !== undefined) {
    if (typeof purchased !== "boolean") {
      return res.status(400).json({ error: "purchased must be a boolean" });
    }
    data.purchased = purchased;
  }

  if (sequence !== undefined) {
    const sequenceErr = parseInteger(sequence, "sequence", { min: 0 });
    if (sequenceErr) return res.status(400).json({ error: sequenceErr });
    data.sequence = sequence;
  }

  if (created_date !== undefined) {
    if (typeof created_date !== "string" || !created_date.trim()) {
      return res.status(400).json({ error: "created_date must be a non-empty string" });
    }
    data.createdDate = created_date.trim();
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "At least one updatable field is required" });
  }

  try {
    const wishlistItem = await prisma.wishlistItem.update({
      where: { itemId },
      data,
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    return res.json({ wishlist: toAdminWishlistResponse(wishlistItem) });
  } catch {
    return res.status(404).json({ error: "Wishlist item not found" });
  }
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
        description: true,
        url: true,
        itemImage: true,
        price: true,
        quantity: true,
        priority: true,
        purchased: true,
        sequence: true,
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
    wishlists: wishlists.map(toAdminWishlistResponse),
  });
});

module.exports = router;

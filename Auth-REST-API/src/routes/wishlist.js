"use strict";

const express = require("express");
const { getDb } = require("../db/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseItemId(value) {
  const itemId = Number.parseInt(value, 10);
  return Number.isInteger(itemId) && itemId > 0 ? itemId : null;
}

function parseInteger(value, fieldName, { min = null } = {}) {
  if (!Number.isInteger(value)) return `${fieldName} must be an integer`;
  if (min !== null && value < min)
    return `${fieldName} must be greater than or equal to ${min}`;
  return null;
}

function parsePrice(value) {
  if (value === undefined) {
    return { value: 0 };
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { error: "price must be a number" };
  }

  if (value < 0) {
    return { error: "price must be greater than or equal to 0" };
  }

  return { value };
}

function parseOptionalImageBlob(itemImage) {
  if (itemImage === undefined || itemImage === null) return { blob: itemImage };
  if (typeof itemImage !== "string") {
    return { error: "item_image must be a base64 string" };
  }
  try {
    const blob = Buffer.from(itemImage, "base64");
    return { blob };
  } catch {
    return { error: "item_image must be a valid base64 string" };
  }
}

function toWishlistResponse(row) {
  return {
    item_id: row.item_id,
    userid: row.userid,
    title: row.title,
    description: row.description,
    url: row.url,
    item_image: row.item_image ? row.item_image.toString("base64") : null,
    price: Number(row.price ?? 0),
    priority: row.priority,
    quantity: row.quantity,
    purchased: !!row.purchased,
    sequence: row.sequence,
    created_date: row.created_date,
  };
}

router.get("/public/by-email", (req, res) => {
  const email = String(req.query.email ?? "")
    .trim()
    .toLowerCase();

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const db = getDb();
  const user = db
    .prepare("SELECT id, name FROM users WHERE lower(email) = ?")
    .get(email);

  if (!user) {
    return res.json({ found: false, user: null, items: [] });
  }

  const items = db
    .prepare(
      `
        SELECT *
        FROM wishlist
        WHERE userid = ?
        ORDER BY sequence ASC, created_date DESC, item_id DESC
      `,
    )
    .all(user.id);

  return res.json({
    found: true,
    user: { name: user.name },
    items: items.map(toWishlistResponse),
  });
});

router.use(requireAuth);

router.post("/", (req, res) => {
  const {
    title,
    description,
    url,
    item_image,
    price,
    priority,
    quantity,
    purchased,
    sequence,
  } = req.body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "title is required" });
  }
  if (
    description !== undefined &&
    description !== null &&
    typeof description !== "string"
  ) {
    return res.status(400).json({ error: "description must be a string" });
  }
  if (url !== undefined && url !== null && typeof url !== "string") {
    return res.status(400).json({ error: "url must be a string" });
  }
  if (priority !== undefined && ![0, 1, 2].includes(priority)) {
    return res
      .status(400)
      .json({ error: "priority must be one of 0, 1, or 2" });
  }
  if (quantity !== undefined) {
    const quantityErr = parseInteger(quantity, "quantity", { min: 1 });
    if (quantityErr) return res.status(400).json({ error: quantityErr });
  }
  if (purchased !== undefined && typeof purchased !== "boolean") {
    return res.status(400).json({ error: "purchased must be a boolean" });
  }
  if (sequence !== undefined) {
    const sequenceErr = parseInteger(sequence, "sequence", { min: 0 });
    if (sequenceErr) return res.status(400).json({ error: sequenceErr });
  }

  const image = parseOptionalImageBlob(item_image);
  if (image.error) return res.status(400).json({ error: image.error });

  const parsedPrice = parsePrice(price);
  if (parsedPrice.error) {
    return res.status(400).json({ error: parsedPrice.error });
  }

  const db = getDb();
  const result = db
    .prepare(
      `
      INSERT INTO wishlist (userid, title, description, url, item_image, price, priority, quantity, purchased, sequence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      req.user.id,
      title.trim(),
      description ?? null,
      url ?? null,
      image.blob ?? null,
      parsedPrice.value,
      priority ?? 1,
      quantity ?? 1,
      purchased ? 1 : 0,
      sequence ?? 0,
    );

  const item = db
    .prepare("SELECT * FROM wishlist WHERE item_id = ? AND userid = ?")
    .get(result.lastInsertRowid, req.user.id);

  return res.status(201).json({ item: toWishlistResponse(item) });
});

router.get("/", (req, res) => {
  const items = getDb()
    .prepare(
      `
        SELECT *
        FROM wishlist
        WHERE userid = ?
        ORDER BY sequence ASC, created_date DESC, item_id DESC
      `,
    )
    .all(req.user.id);

  return res.json({ items: items.map(toWishlistResponse) });
});

router.get("/:itemId", (req, res) => {
  const itemId = parseItemId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "Invalid item_id" });

  const item = getDb()
    .prepare("SELECT * FROM wishlist WHERE item_id = ? AND userid = ?")
    .get(itemId, req.user.id);

  if (!item) return res.status(404).json({ error: "Wishlist item not found" });
  return res.json({ item: toWishlistResponse(item) });
});

router.put("/:itemId", (req, res) => {
  const itemId = parseItemId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "Invalid item_id" });

  const {
    title,
    description,
    url,
    item_image,
    price,
    priority,
    quantity,
    purchased,
    sequence,
  } = req.body;

  const updates = [];
  const values = [];

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return res
        .status(400)
        .json({ error: "title must be a non-empty string" });
    }
    updates.push("title = ?");
    values.push(title.trim());
  }

  if (description !== undefined) {
    if (description !== null && typeof description !== "string") {
      return res
        .status(400)
        .json({ error: "description must be a string or null" });
    }
    updates.push("description = ?");
    values.push(description);
  }

  if (url !== undefined) {
    if (url !== null && typeof url !== "string") {
      return res.status(400).json({ error: "url must be a string or null" });
    }
    updates.push("url = ?");
    values.push(url);
  }

  if (item_image !== undefined) {
    const image = parseOptionalImageBlob(item_image);
    if (image.error) return res.status(400).json({ error: image.error });
    updates.push("item_image = ?");
    values.push(image.blob);
  }

  if (price !== undefined) {
    const parsedPrice = parsePrice(price);
    if (parsedPrice.error) {
      return res.status(400).json({ error: parsedPrice.error });
    }
    updates.push("price = ?");
    values.push(parsedPrice.value);
  }

  if (priority !== undefined) {
    if (![0, 1, 2].includes(priority)) {
      return res
        .status(400)
        .json({ error: "priority must be one of 0, 1, or 2" });
    }
    updates.push("priority = ?");
    values.push(priority);
  }

  if (quantity !== undefined) {
    const quantityErr = parseInteger(quantity, "quantity", { min: 1 });
    if (quantityErr) return res.status(400).json({ error: quantityErr });
    updates.push("quantity = ?");
    values.push(quantity);
  }

  if (purchased !== undefined) {
    if (typeof purchased !== "boolean") {
      return res.status(400).json({ error: "purchased must be a boolean" });
    }
    updates.push("purchased = ?");
    values.push(purchased ? 1 : 0);
  }

  if (sequence !== undefined) {
    const sequenceErr = parseInteger(sequence, "sequence", { min: 0 });
    if (sequenceErr) return res.status(400).json({ error: sequenceErr });
    updates.push("sequence = ?");
    values.push(sequence);
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
      UPDATE wishlist
      SET ${updates.join(", ")}
      WHERE item_id = ? AND userid = ?
    `,
    )
    .run(...values, itemId, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Wishlist item not found" });
  }

  const item = db
    .prepare("SELECT * FROM wishlist WHERE item_id = ? AND userid = ?")
    .get(itemId, req.user.id);

  return res.json({ item: toWishlistResponse(item) });
});

router.delete("/:itemId", (req, res) => {
  const itemId = parseItemId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: "Invalid item_id" });

  const result = getDb()
    .prepare("DELETE FROM wishlist WHERE item_id = ? AND userid = ?")
    .run(itemId, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Wishlist item not found" });
  }

  return res.json({ message: "Wishlist item deleted successfully" });
});

module.exports = router;

'use strict';

const express = require('express');
const { prisma } = require('../db/prisma');
const { requireAuth } = require('../middleware/auth');
const { toSqliteDateOnly } = require('../utils/dates');

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

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { error: 'price must be a number' };
  }

  if (value < 0) {
    return { error: 'price must be greater than or equal to 0' };
  }

  return { value };
}

function parseOptionalImageBlob(itemImage) {
  if (itemImage === undefined || itemImage === null) return { blob: itemImage };
  if (typeof itemImage !== 'string') {
    return { error: 'item_image must be a base64 string' };
  }
  try {
    const blob = Buffer.from(itemImage, 'base64');
    return { blob };
  } catch {
    return { error: 'item_image must be a valid base64 string' };
  }
}

function toWishlistResponse(row) {
  return {
    item_id: row.itemId,
    userid: row.userId,
    title: row.title,
    description: row.description,
    url: row.url,
    item_image: row.itemImage ? Buffer.from(row.itemImage).toString('base64') : null,
    price: Number(row.price ?? 0),
    priority: row.priority,
    quantity: row.quantity,
    purchased: !!row.purchased,
    sequence: row.sequence,
    created_date: row.createdDate,
  };
}

async function resolveSequenceForCreate(userId, requestedSequence) {
  if (requestedSequence !== undefined && requestedSequence !== 0) {
    return requestedSequence;
  }

  const maxResult = await prisma.wishlistItem.aggregate({
    where: { userId },
    _max: { sequence: true },
  });

  return (maxResult._max.sequence ?? 0) + 1;
}

router.get('/public/by-email', async (req, res) => {
  const email = String(req.query.email ?? '')
    .trim()
    .toLowerCase();

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, name: true },
  });

  if (!user) {
    return res.json({ found: false, user: null, items: [] });
  }

  const items = await prisma.wishlistItem.findMany({
    where: { userId: user.id },
    orderBy: [{ sequence: 'asc' }, { createdDate: 'desc' }, { itemId: 'desc' }],
  });

  return res.json({
    found: true,
    user: { name: user.name },
    items: items.map(toWishlistResponse),
  });
});

router.patch('/public/purchased', async (req, res) => {
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase();
  const itemId = parseItemId(req.body?.item_id);
  const purchased = req.body?.purchased;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  if (!itemId) {
    return res.status(400).json({ error: 'Valid item_id is required' });
  }

  if (typeof purchased !== 'boolean') {
    return res.status(400).json({ error: 'purchased must be a boolean' });
  }

  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'Wishlist owner not found' });
  }

  const result = await prisma.wishlistItem.updateMany({
    where: { itemId, userId: user.id },
    data: { purchased },
  });

  if (result.count === 0) {
    return res.status(404).json({ error: 'Wishlist item not found' });
  }

  const item = await prisma.wishlistItem.findFirst({
    where: { itemId, userId: user.id },
  });

  return res.json({ item: toWishlistResponse(item) });
});

router.use(requireAuth);

router.post('/', async (req, res) => {
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

  if (!title || typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (
    description !== undefined &&
    description !== null &&
    typeof description !== 'string'
  ) {
    return res.status(400).json({ error: 'description must be a string' });
  }
  if (url !== undefined && url !== null && typeof url !== 'string') {
    return res.status(400).json({ error: 'url must be a string' });
  }
  if (priority !== undefined && ![0, 1, 2].includes(priority)) {
    return res
      .status(400)
      .json({ error: 'priority must be one of 0, 1, or 2' });
  }
  if (quantity !== undefined) {
    const quantityErr = parseInteger(quantity, 'quantity', { min: 1 });
    if (quantityErr) return res.status(400).json({ error: quantityErr });
  }
  if (purchased !== undefined && typeof purchased !== 'boolean') {
    return res.status(400).json({ error: 'purchased must be a boolean' });
  }
  if (sequence !== undefined) {
    const sequenceErr = parseInteger(sequence, 'sequence', { min: 0 });
    if (sequenceErr) return res.status(400).json({ error: sequenceErr });
  }

  const image = parseOptionalImageBlob(item_image);
  if (image.error) return res.status(400).json({ error: image.error });

  const parsedPrice = parsePrice(price);
  if (parsedPrice.error) {
    return res.status(400).json({ error: parsedPrice.error });
  }

  const finalSequence = await resolveSequenceForCreate(req.user.id, sequence);

  const item = await prisma.wishlistItem.create({
    data: {
      userId: req.user.id,
      title: title.trim(),
      description: description ?? null,
      url: url ?? null,
      itemImage: image.blob ?? null,
      price: parsedPrice.value,
      priority: priority ?? 1,
      quantity: quantity ?? 1,
      purchased: !!purchased,
      sequence: finalSequence,
      createdDate: toSqliteDateOnly(Date.now()),
    },
  });

  return res.status(201).json({ item: toWishlistResponse(item) });
});

router.get('/', async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId: req.user.id },
    orderBy: [{ sequence: 'asc' }, { createdDate: 'desc' }, { itemId: 'desc' }],
  });

  return res.json({ items: items.map(toWishlistResponse) });
});

router.get('/:itemId', async (req, res) => {
  const itemId = parseItemId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: 'Invalid item_id' });

  const item = await prisma.wishlistItem.findFirst({
    where: { itemId, userId: req.user.id },
  });

  if (!item) return res.status(404).json({ error: 'Wishlist item not found' });
  return res.json({ item: toWishlistResponse(item) });
});

router.put('/:itemId', async (req, res) => {
  const itemId = parseItemId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: 'Invalid item_id' });

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

  const data = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      return res
        .status(400)
        .json({ error: 'title must be a non-empty string' });
    }
    data.title = title.trim();
  }

  if (description !== undefined) {
    if (description !== null && typeof description !== 'string') {
      return res
        .status(400)
        .json({ error: 'description must be a string or null' });
    }
    data.description = description;
  }

  if (url !== undefined) {
    if (url !== null && typeof url !== 'string') {
      return res.status(400).json({ error: 'url must be a string or null' });
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

  if (priority !== undefined) {
    if (![0, 1, 2].includes(priority)) {
      return res
        .status(400)
        .json({ error: 'priority must be one of 0, 1, or 2' });
    }
    data.priority = priority;
  }

  if (quantity !== undefined) {
    const quantityErr = parseInteger(quantity, 'quantity', { min: 1 });
    if (quantityErr) return res.status(400).json({ error: quantityErr });
    data.quantity = quantity;
  }

  if (purchased !== undefined) {
    if (typeof purchased !== 'boolean') {
      return res.status(400).json({ error: 'purchased must be a boolean' });
    }
    data.purchased = purchased;
  }

  if (sequence !== undefined) {
    const sequenceErr = parseInteger(sequence, 'sequence', { min: 0 });
    if (sequenceErr) return res.status(400).json({ error: sequenceErr });
    data.sequence = sequence;
  }

  if (Object.keys(data).length === 0) {
    return res
      .status(400)
      .json({ error: 'At least one updatable field is required' });
  }

  const result = await prisma.wishlistItem.updateMany({
    where: { itemId, userId: req.user.id },
    data,
  });

  if (result.count === 0) {
    return res.status(404).json({ error: 'Wishlist item not found' });
  }

  const item = await prisma.wishlistItem.findFirst({
    where: { itemId, userId: req.user.id },
  });

  return res.json({ item: toWishlistResponse(item) });
});

router.delete('/:itemId', async (req, res) => {
  const itemId = parseItemId(req.params.itemId);
  if (!itemId) return res.status(400).json({ error: 'Invalid item_id' });

  const result = await prisma.wishlistItem.deleteMany({
    where: { itemId, userId: req.user.id },
  });

  if (result.count === 0) {
    return res.status(404).json({ error: 'Wishlist item not found' });
  }

  return res.json({ message: 'Wishlist item deleted successfully' });
});

module.exports = router;

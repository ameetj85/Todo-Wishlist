'use strict';

process.env.DATABASE_URL = 'file:./data/test.db';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { prisma } = require('../db/prisma');
const { resetDb } = require('./helpers');

describe('Database', () => {
  beforeEach(resetDb);

  it('enforces unique email on users', async () => {
    await prisma.user.create({
      data: {
        id: randomUUID(),
        email: 'a@b.com',
        password: 'hash',
        name: 'Test',
      },
    });

    await assert.rejects(() =>
      prisma.user.create({
        data: {
          id: randomUUID(),
          email: 'a@b.com',
          password: 'hash',
          name: 'Test2',
        },
      }),
    );
  });

  it('cascades session delete when user is deleted', async () => {
    const uid = randomUUID();
    const sid = randomUUID();

    await prisma.user.create({
      data: {
        id: uid,
        email: 'b@b.com',
        password: 'h',
        name: 'B',
      },
    });

    await prisma.session.create({
      data: {
        id: sid,
        userId: uid,
        token: 'tok',
        expiresAt: '2099-01-01 00:00:00',
      },
    });

    await prisma.user.delete({ where: { id: uid } });
    const sess = await prisma.session.findUnique({ where: { id: sid } });
    assert.equal(sess, null);
  });

  it('cascades todo delete when user is deleted', async () => {
    const uid = randomUUID();
    await prisma.user.create({
      data: {
        id: uid,
        email: 'todo@b.com',
        password: 'h',
        name: 'Todo User',
      },
    });

    const todo = await prisma.todo.create({
      data: {
        userId: uid,
        name: 'Task',
        description: 'Desc',
        dueDate: '2099-01-01',
        category: 'Work',
        completed: false,
        createdDate: '2026-03-09',
      },
    });

    await prisma.user.delete({ where: { id: uid } });
    const deleted = await prisma.todo.findUnique({ where: { todoId: todo.todoId } });
    assert.equal(deleted, null);
  });

  it('sets default created_date for todos', async () => {
    const uid = randomUUID();
    await prisma.user.create({
      data: {
        id: uid,
        email: 'date@b.com',
        password: 'h',
        name: 'Date User',
      },
    });

    const todo = await prisma.todo.create({
      data: {
        userId: uid,
        name: 'Task',
        description: 'Desc',
        category: 'Work',
      },
    });

    assert.ok(todo.createdDate);
    assert.match(todo.createdDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('sets wishlist defaults', async () => {
    const uid = randomUUID();

    await prisma.user.create({
      data: {
        id: uid,
        email: 'wish@b.com',
        password: 'h',
        name: 'Wish User',
      },
    });

    const first = await prisma.wishlistItem.create({
      data: {
        userId: uid,
        title: 'First item',
      },
    });

    assert.equal(first.price, 0);
    assert.equal(first.priority, 1);
    assert.equal(first.quantity, 1);
    assert.equal(first.purchased, false);
    assert.equal(first.sequence, 0);
    assert.match(first.createdDate, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('cascades wishlist delete when user is deleted', async () => {
    const uid = randomUUID();

    await prisma.user.create({
      data: {
        id: uid,
        email: 'wish2@b.com',
        password: 'h',
        name: 'Wish User2',
      },
    });

    const inserted = await prisma.wishlistItem.create({
      data: {
        userId: uid,
        title: 'Cascade item',
      },
    });

    await prisma.user.delete({ where: { id: uid } });
    const item = await prisma.wishlistItem.findUnique({ where: { itemId: inserted.itemId } });

    assert.equal(item, null);
  });
});

'use strict';

process.env.DATABASE_URL = 'file:./data/test.db';
process.env.SESSION_EXPIRY_HOURS = '24';
process.env.RESET_TOKEN_EXPIRY_MINUTES = '60';
process.env.BCRYPT_ROUNDS = '4';
process.env.RATE_LIMIT_GLOBAL = '100000';
process.env.RATE_LIMIT_AUTH = '100000';

const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../db/prisma');
const { resetDb, getUser } = require('./helpers');

let app;
before(() => {
  app = require('../../server');
});

beforeEach(resetDb);

function request(app, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const data = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          method,
          path,
          headers: {
            'Content-Type': 'application/json',
            ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
            ...headers,
          },
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => {
            raw += c;
          });
          res.on('end', () => {
            server.close();
            resolve({
              status: res.statusCode,
              body: JSON.parse(raw || 'null'),
            });
          });
        },
      );

      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  });
}

// No API route grants admin rights, so users are seeded directly.
async function createUser({ email, name, password = 'Password1', isAdmin = false }) {
  return prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email,
      name,
      password: await bcrypt.hash(password, 4),
      isVerified: true,
      isAdmin,
    },
  });
}

async function login(email, password = 'Password1') {
  const res = await request(app, 'POST', '/api/auth/login', { email, password });
  assert.equal(res.status, 200);
  return res.body.token;
}

async function setupAdmin() {
  const admin = await createUser({ email: 'admin@example.com', name: 'Admin', isAdmin: true });
  const token = await login('admin@example.com');
  return { admin, auth: { Authorization: `Bearer ${token}` } };
}

async function createWishlistItem(userId, overrides = {}) {
  return prisma.wishlistItem.create({
    data: {
      userId,
      title: 'Headphones',
      description: 'Noise cancelling',
      url: 'https://example.com/headphones',
      price: 199.99,
      quantity: 1,
      priority: 1,
      sequence: 0,
      ...overrides,
    },
  });
}

describe('Admin access control', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app, 'GET', '/api/admin/overview');
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Missing authorization token');
  });

  it('rejects an invalid token', async () => {
    const res = await request(app, 'GET', '/api/admin/overview', null, {
      Authorization: 'Bearer not-a-real-token',
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'Invalid or expired session token');
  });

  it('rejects non-admin users on every admin route', async () => {
    await createUser({ email: 'user@example.com', name: 'Regular' });
    const token = await login('user@example.com');
    const auth = { Authorization: `Bearer ${token}` };

    const calls = [
      ['GET', '/api/admin/overview', null],
      ['POST', '/api/admin/users', { email: 'x@example.com', name: 'X', password: 'Password1' }],
      ['PUT', '/api/admin/users/some-id', { name: 'X' }],
      ['PUT', '/api/admin/wishlists/1', { title: 'X' }],
    ];

    for (const [method, path, body] of calls) {
      const res = await request(app, method, path, body, auth);
      assert.equal(res.status, 403, `${method} ${path}`);
      assert.equal(res.body.error, 'Admin access required');
    }
  });
});

describe('POST /api/admin/users', () => {
  it('creates a user and returns the snake_case shape', async () => {
    const { auth } = await setupAdmin();

    const res = await request(
      app,
      'POST',
      '/api/admin/users',
      {
        email: '  New.User@Example.com ',
        name: '  New User ',
        password: 'Password1',
        is_verified: true,
        is_admin: false,
      },
      auth,
    );

    assert.equal(res.status, 201);
    assert.deepEqual(Object.keys(res.body.user).sort(), [
      'created_at',
      'email',
      'id',
      'is_admin',
      'is_verified',
      'name',
    ]);
    assert.equal(typeof res.body.user.id, 'string');
    assert.equal(res.body.user.email, 'new.user@example.com');
    assert.equal(res.body.user.name, 'New User');
    assert.equal(res.body.user.is_verified, true);
    assert.equal(res.body.user.is_admin, false);
    assert.equal(typeof res.body.user.created_at, 'string');

    // The created user can log in with the given password.
    await login('new.user@example.com');
  });

  it('defaults is_verified and is_admin to false', async () => {
    const { auth } = await setupAdmin();

    const res = await request(
      app,
      'POST',
      '/api/admin/users',
      { email: 'pending@example.com', name: 'Pending', password: 'Password1' },
      auth,
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.user.is_verified, false);
    assert.equal(res.body.user.is_admin, false);

    const loginRes = await request(app, 'POST', '/api/auth/login', {
      email: 'pending@example.com',
      password: 'Password1',
    });
    assert.equal(loginRes.status, 403);
    assert.equal(loginRes.body.code, 'UNVERIFIED_ACCOUNT');
  });

  it('validates required fields in order', async () => {
    const { auth } = await setupAdmin();

    const cases = [
      [{ name: 'A', password: 'Password1' }, 'email is required'],
      [{ email: 'a@example.com', password: 'Password1' }, 'name is required'],
      [{ email: 'a@example.com', name: '   ' }, 'name is required'],
      [{ email: 'a@example.com', name: 'A' }, 'password is required'],
      [{ email: 'a@example.com', name: 'A', password: 'short' }, 'Password must be at least 8 characters'],
      [{ email: 'a@example.com', name: 'A', password: 'password1' }, 'Password must contain at least one uppercase letter'],
      [{ email: 'a@example.com', name: 'A', password: 'Password' }, 'Password must contain at least one number'],
    ];

    for (const [body, error] of cases) {
      const res = await request(app, 'POST', '/api/admin/users', body, auth);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error, error);
    }
  });

  it('rejects a duplicate email', async () => {
    const { auth } = await setupAdmin();

    const res = await request(
      app,
      'POST',
      '/api/admin/users',
      { email: 'ADMIN@example.com', name: 'Dup', password: 'Password1' },
      auth,
    );

    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'A user with this email already exists');
  });
});

describe('PUT /api/admin/users/:userId', () => {
  it('updates name, email and flags', async () => {
    const { auth } = await setupAdmin();
    const user = await createUser({ email: 'target@example.com', name: 'Target' });

    const res = await request(
      app,
      'PUT',
      `/api/admin/users/${user.id}`,
      { name: ' Renamed ', email: 'Renamed@Example.com', is_verified: false, is_admin: true },
      auth,
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.user.id, user.id);
    assert.equal(res.body.user.name, 'Renamed');
    assert.equal(res.body.user.email, 'renamed@example.com');
    assert.equal(res.body.user.is_verified, false);
    assert.equal(res.body.user.is_admin, true);
    assert.equal(typeof res.body.user.created_at, 'string');
  });

  it('changes the password when a non-empty one is given', async () => {
    const { auth } = await setupAdmin();
    const user = await createUser({ email: 'target@example.com', name: 'Target' });

    const res = await request(
      app,
      'PUT',
      `/api/admin/users/${user.id}`,
      { password: 'NewPassword9' },
      auth,
    );
    assert.equal(res.status, 200);

    await login('target@example.com', 'NewPassword9');
  });

  it('ignores an empty password', async () => {
    const { auth } = await setupAdmin();
    const user = await createUser({ email: 'target@example.com', name: 'Target' });
    const before = await getUser('target@example.com');

    const onlyPassword = await request(
      app,
      'PUT',
      `/api/admin/users/${user.id}`,
      { password: '' },
      auth,
    );
    assert.equal(onlyPassword.status, 400);
    assert.equal(onlyPassword.body.error, 'At least one updatable field is required');

    const withName = await request(
      app,
      'PUT',
      `/api/admin/users/${user.id}`,
      { name: 'Still Target', password: '' },
      auth,
    );
    assert.equal(withName.status, 200);

    const after = await getUser('target@example.com');
    assert.equal(after.password, before.password);
  });

  it('returns 404 for an unknown user', async () => {
    const { auth } = await setupAdmin();

    const res = await request(app, 'PUT', '/api/admin/users/does-not-exist', { name: 'X' }, auth);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'User not found');
  });

  it('validates fields', async () => {
    const { auth } = await setupAdmin();
    const user = await createUser({ email: 'target@example.com', name: 'Target' });

    const cases = [
      [{ email: '   ' }, 'email must be a non-empty string'],
      [{ name: '   ' }, 'name must be a non-empty string'],
      [{ password: 'weak' }, 'Password must be at least 8 characters'],
      [{}, 'At least one updatable field is required'],
    ];

    for (const [body, error] of cases) {
      const res = await request(app, 'PUT', `/api/admin/users/${user.id}`, body, auth);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error, error);
    }
  });

  it('rejects an email that belongs to another user', async () => {
    const { auth } = await setupAdmin();
    const user = await createUser({ email: 'target@example.com', name: 'Target' });

    const res = await request(
      app,
      'PUT',
      `/api/admin/users/${user.id}`,
      { email: 'admin@example.com' },
      auth,
    );
    assert.equal(res.status, 409);
    assert.equal(res.body.error, 'A user with this email already exists');
  });

  it('allows keeping the same email', async () => {
    const { auth } = await setupAdmin();
    const user = await createUser({ email: 'target@example.com', name: 'Target' });

    const res = await request(
      app,
      'PUT',
      `/api/admin/users/${user.id}`,
      { email: 'TARGET@example.com' },
      auth,
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'target@example.com');
  });
});

describe('PUT /api/admin/wishlists/:itemId', () => {
  it('updates fields and returns the admin wishlist shape', async () => {
    const { auth } = await setupAdmin();
    const owner = await createUser({ email: 'owner@example.com', name: 'Owner' });
    const item = await createWishlistItem(owner.id);
    const image = Buffer.from('fake-image-bytes').toString('base64');

    const res = await request(
      app,
      'PUT',
      `/api/admin/wishlists/${item.itemId}`,
      {
        title: '  New Title ',
        description: null,
        url: null,
        item_image: image,
        price: 0,
        quantity: 3,
        priority: 2,
        purchased: true,
        sequence: 5,
        created_date: ' 2026-01-02 ',
      },
      auth,
    );

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.wishlist, {
      item_id: item.itemId,
      user_id: owner.id,
      user_name: 'Owner',
      title: 'New Title',
      description: null,
      url: null,
      item_image: image,
      price: 0,
      quantity: 3,
      priority: 2,
      purchased: true,
      sequence: 5,
      created_date: '2026-01-02',
    });
  });

  it('reassigns an item to another user', async () => {
    const { auth } = await setupAdmin();
    const owner = await createUser({ email: 'owner@example.com', name: 'Owner' });
    const other = await createUser({ email: 'other@example.com', name: 'Other' });
    const item = await createWishlistItem(owner.id);

    const res = await request(
      app,
      'PUT',
      `/api/admin/wishlists/${item.itemId}`,
      { user_id: other.id },
      auth,
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.wishlist.user_id, other.id);
    assert.equal(res.body.wishlist.user_name, 'Other');
  });

  it('clears the image when item_image is null', async () => {
    const { auth } = await setupAdmin();
    const owner = await createUser({ email: 'owner@example.com', name: 'Owner' });
    const item = await createWishlistItem(owner.id, { itemImage: Buffer.from('img') });

    const res = await request(
      app,
      'PUT',
      `/api/admin/wishlists/${item.itemId}`,
      { item_image: null },
      auth,
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.wishlist.item_image, null);
  });

  it('rejects an invalid item id', async () => {
    const { auth } = await setupAdmin();

    for (const id of ['abc', '0', '-1']) {
      const res = await request(app, 'PUT', `/api/admin/wishlists/${id}`, { title: 'X' }, auth);
      assert.equal(res.status, 400, id);
      assert.equal(res.body.error, 'Invalid item_id');
    }
  });

  it('returns 404 for a missing item', async () => {
    const { auth } = await setupAdmin();

    const res = await request(app, 'PUT', '/api/admin/wishlists/999999', { title: 'X' }, auth);
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Wishlist item not found');
  });

  it('validates fields', async () => {
    const { auth, admin } = await setupAdmin();
    const item = await createWishlistItem(admin.id);

    const cases = [
      [{ user_id: '   ' }, 'user_id must be a non-empty string'],
      [{ user_id: 'nobody' }, 'user_id must reference an existing user'],
      [{ title: '  ' }, 'title must be a non-empty string'],
      [{ title: 5 }, 'title must be a non-empty string'],
      [{ description: 5 }, 'description must be a string or null'],
      [{ url: 5 }, 'url must be a string or null'],
      [{ item_image: 5 }, 'item_image must be a base64 string or null'],
      [{ price: 'free' }, 'price must be a number'],
      [{ price: -1 }, 'price must be greater than or equal to 0'],
      [{ quantity: 1.5 }, 'quantity must be an integer'],
      [{ quantity: 0 }, 'quantity must be greater than or equal to 1'],
      [{ priority: 3 }, 'priority must be one of 0, 1, or 2'],
      [{ purchased: 'yes' }, 'purchased must be a boolean'],
      [{ sequence: -1 }, 'sequence must be greater than or equal to 0'],
      [{ created_date: '  ' }, 'created_date must be a non-empty string'],
      [{}, 'At least one updatable field is required'],
    ];

    for (const [body, error] of cases) {
      const res = await request(app, 'PUT', `/api/admin/wishlists/${item.itemId}`, body, auth);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.error, error);
    }
  });
});

describe('GET /api/admin/overview', () => {
  it('returns all users, todos and wishlists in the expected shape', async () => {
    const { auth, admin } = await setupAdmin();
    const owner = await createUser({ email: 'owner@example.com', name: 'Owner' });

    await prisma.todo.create({
      data: {
        userId: owner.id,
        name: 'Older todo',
        description: 'Desc',
        category: 'Work',
        dueDate: '2099-01-01',
        createdDate: '2026-01-01 10:00:00',
      },
    });
    await prisma.todo.create({
      data: {
        userId: admin.id,
        name: 'Newer todo',
        description: 'Desc',
        category: 'Home',
        completed: true,
        createdDate: '2026-02-01 10:00:00',
      },
    });
    await createWishlistItem(owner.id, {
      itemImage: Buffer.from('img'),
      createdDate: '2026-01-01',
    });

    const res = await request(app, 'GET', '/api/admin/overview', null, auth);
    assert.equal(res.status, 200);

    assert.equal(res.body.users.length, 2);
    for (const user of res.body.users) {
      assert.deepEqual(Object.keys(user).sort(), [
        'created_at',
        'email',
        'id',
        'is_admin',
        'is_verified',
        'name',
      ]);
    }
    const adminRow = res.body.users.find((u) => u.email === 'admin@example.com');
    assert.equal(adminRow.is_admin, true);
    assert.equal(adminRow.is_verified, true);

    assert.equal(res.body.todos.length, 2);
    assert.deepEqual(
      res.body.todos.map((t) => t.name),
      ['Newer todo', 'Older todo'],
    );
    assert.deepEqual(res.body.todos[1], {
      todo_id: res.body.todos[1].todo_id,
      user_id: owner.id,
      user_name: 'Owner',
      name: 'Older todo',
      description: 'Desc',
      due_date: '2099-01-01',
      created_date: '2026-01-01 10:00:00',
      category: 'Work',
      completed: false,
    });
    assert.equal(typeof res.body.todos[1].todo_id, 'number');
    assert.equal(res.body.todos[0].completed, true);
    assert.equal(res.body.todos[0].due_date, null);

    assert.equal(res.body.wishlists.length, 1);
    const wish = res.body.wishlists[0];
    assert.equal(wish.user_id, owner.id);
    assert.equal(wish.user_name, 'Owner');
    assert.equal(wish.item_image, Buffer.from('img').toString('base64'));
    assert.equal(wish.price, 199.99);
    assert.equal(wish.purchased, false);
    assert.equal(wish.created_date, '2026-01-01');
  });

  it('returns empty lists when there is no content', async () => {
    const { auth } = await setupAdmin();

    const res = await request(app, 'GET', '/api/admin/overview', null, auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.users.length, 1);
    assert.deepEqual(res.body.todos, []);
    assert.deepEqual(res.body.wishlists, []);
  });
});

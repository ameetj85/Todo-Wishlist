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
const { resetDb, getUser, getResetToken } = require('./helpers');

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

async function signupAndGetToken(user = null) {
  const payload =
    user ||
    {
      email: 'contract@example.com',
      password: 'ContractPass1',
      name: 'Contract User',
    };

  const response = await request(app, 'POST', '/api/auth/signup', payload);
  assert.equal(response.status, 201);
  assert.equal(response.body.requiresVerification, true);

  const createdUser = await getUser(payload.email);
  assert.ok(createdUser);

  const verificationToken = await getResetToken(createdUser.id);
  assert.ok(verificationToken);

  const verify = await request(app, 'POST', '/api/auth/verify-email', {
    token: verificationToken.token,
  });
  assert.equal(verify.status, 200);

  const login = await request(app, 'POST', '/api/auth/login', {
    email: payload.email,
    password: payload.password,
  });
  assert.equal(login.status, 200);

  return { token: login.body.token, user: login.body.user };
}

describe('Frontend API contract', () => {
  it('keeps auth payload shape used by Auth-FrontEnd', async () => {
    const signup = await request(app, 'POST', '/api/auth/signup', {
      email: 'alice@example.com',
      password: 'AlicePass1',
      name: 'Alice',
    });

    assert.equal(signup.status, 201);
    assert.equal(typeof signup.body.message, 'string');
    assert.equal(signup.body.requiresVerification, true);

    const user = await getUser('alice@example.com');
    assert.ok(user);

    const verificationToken = await getResetToken(user.id);
    assert.ok(verificationToken);

    const verify = await request(app, 'POST', '/api/auth/verify-email', {
      token: verificationToken.token,
    });
    assert.equal(verify.status, 200);

    const login = await request(app, 'POST', '/api/auth/login', {
      email: 'alice@example.com',
      password: 'AlicePass1',
    });
    assert.equal(login.status, 200);
    assert.equal(typeof login.body.token, 'string');
    assert.equal(typeof login.body.expiresIn, 'string');
    assert.equal(typeof login.body.user.id, 'string');
    assert.equal(typeof login.body.user.email, 'string');
    assert.equal(typeof login.body.user.name, 'string');

    const me = await request(app, 'GET', '/api/auth/me', null, {
      Authorization: `Bearer ${login.body.token}`,
    });

    assert.equal(me.status, 200);
    assert.equal(typeof me.body.user.id, 'string');
    assert.equal(typeof me.body.user.email, 'string');
    assert.equal(typeof me.body.user.name, 'string');

    const sessions = await request(app, 'GET', '/api/auth/sessions', null, {
      Authorization: `Bearer ${login.body.token}`,
    });

    assert.equal(sessions.status, 200);
    assert.ok(Array.isArray(sessions.body.sessions));
    assert.ok(sessions.body.sessions.length >= 1);
    assert.equal(typeof sessions.body.sessions[0].id, 'string');
    assert.equal(typeof sessions.body.sessions[0].created_at, 'string');
    assert.equal(typeof sessions.body.sessions[0].expires_at, 'string');
    assert.equal(
      Number.isInteger(sessions.body.sessions[0].is_current),
      true,
    );
  });

  it('keeps todo response field names expected by frontend', async () => {
    const { token } = await signupAndGetToken();

    const created = await request(
      app,
      'POST',
      '/api/todos',
      {
        name: 'Task',
        description: 'Desc',
        category: 'Work',
        due_date: '2099-01-01',
        completed: false,
      },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(created.status, 201);
    assert.equal(typeof created.body.todo.todo_id, 'number');
    assert.equal(typeof created.body.todo.user_id, 'string');
    assert.equal(typeof created.body.todo.created_date, 'string');
    assert.equal(typeof created.body.todo.completed, 'boolean');
    assert.equal(typeof created.body.todo.remind_me, 'boolean');
    assert.equal(
      created.body.todo.reminder_date === null ||
        typeof created.body.todo.reminder_date === 'string',
      true,
    );
    assert.equal(typeof created.body.todo.reminder_sent, 'boolean');

    const list = await request(app, 'GET', '/api/todos', null, {
      Authorization: `Bearer ${token}`,
    });

    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body.todos));
    assert.equal(typeof list.body.todos[0].todo_id, 'number');
  });

  it('keeps wishlist public payload shape expected by frontend', async () => {
    const { token, user } = await signupAndGetToken({
      email: 'wishlist-owner@example.com',
      password: 'WishlistPass1',
      name: 'Wishlist Owner',
    });

    const create = await request(
      app,
      'POST',
      '/api/wishlist',
      {
        title: 'Monitor',
        description: '4k',
        priority: 1,
        price: 299.99,
        quantity: 1,
      },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(create.status, 201);
    assert.equal(typeof create.body.item.item_id, 'number');
    assert.equal(typeof create.body.item.userid, 'string');
    assert.equal(typeof create.body.item.purchased, 'boolean');

    const publicByEmail = await request(
      app,
      'GET',
      `/api/wishlist/public/by-email?email=${encodeURIComponent(user.email)}`,
    );

    assert.equal(publicByEmail.status, 200);
    assert.equal(publicByEmail.body.found, true);
    assert.equal(typeof publicByEmail.body.user.name, 'string');
    assert.ok(Array.isArray(publicByEmail.body.items));
    assert.equal(typeof publicByEmail.body.items[0].item_id, 'number');
    assert.equal(typeof publicByEmail.body.items[0].title, 'string');
    assert.equal(typeof publicByEmail.body.items[0].price, 'number');
    assert.equal(typeof publicByEmail.body.items[0].quantity, 'number');
    assert.equal(typeof publicByEmail.body.items[0].purchased, 'boolean');
    assert.equal(typeof publicByEmail.body.items[0].priority, 'number');
  });

  it('keeps error payload shape for frontend error handling', async () => {
    const missingToken = await request(app, 'GET', '/api/auth/me');
    assert.equal(missingToken.status, 401);
    assert.equal(typeof missingToken.body.error, 'string');

    const badTodo = await request(app, 'POST', '/api/todos', {
      name: '',
      description: 'Desc',
      category: 'Work',
    });
    assert.equal(badTodo.status, 401);
    assert.equal(typeof badTodo.body.error, 'string');

    const invalidPublic = await request(
      app,
      'GET',
      '/api/wishlist/public/by-email?email=not-an-email',
    );
    assert.equal(invalidPublic.status, 400);
    assert.equal(typeof invalidPublic.body.error, 'string');
  });
});

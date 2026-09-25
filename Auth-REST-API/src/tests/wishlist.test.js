'use strict';

process.env.DATABASE_URL = 'file:./data/test.db';
process.env.SESSION_EXPIRY_HOURS = '24';
process.env.RESET_TOKEN_EXPIRY_MINUTES = '60';
process.env.BCRYPT_ROUNDS = '4';
process.env.RATE_LIMIT_GLOBAL = '100000';
process.env.RATE_LIMIT_AUTH = '100000';

const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { resetDb, getUser, getResetToken } = require('./helpers');

let app;
before(() => {
  app = require('../../server');
});
beforeEach(resetDb);

const http = require('http');

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

async function signupAndGetToken(email = 'wish-user@example.com') {
  const password = 'WishPass123';
  const res = await request(app, 'POST', '/api/auth/signup', {
    email,
    password,
    name: 'Wish User',
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.requiresVerification, true);

  const user = await getUser(email);
  assert.ok(user);

  const verificationToken = await getResetToken(user.id);
  assert.ok(verificationToken);

  const verify = await request(app, 'POST', '/api/auth/verify-email', {
    token: verificationToken.token,
  });
  assert.equal(verify.status, 200);

  const login = await request(app, 'POST', '/api/auth/login', {
    email,
    password,
  });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);

  return login.body.token;
}

describe('Wishlist CRUD Routes', () => {
  it('allows public wishlist lookup by email', async () => {
    const ownerEmail = 'public-owner@example.com';
    const token = await signupAndGetToken(ownerEmail);

    await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'Public Item' },
      { Authorization: `Bearer ${token}` },
    );

    const res = await request(
      app,
      'GET',
      `/api/wishlist/public/by-email?email=${encodeURIComponent(ownerEmail)}`,
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.found, true);
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].title, 'Public Item');
  });

  it('creates a new share link each time that exposes the wishlist read-only', async () => {
    const token = await signupAndGetToken('share-owner@example.com');
    const auth = { Authorization: `Bearer ${token}` };

    await request(app, 'POST', '/api/wishlist', { title: 'Shared Item' }, auth);

    const created = await request(app, 'POST', '/api/wishlist/share-link', null, auth);
    assert.equal(created.status, 200);
    assert.ok(created.body.token);

    const recreated = await request(app, 'POST', '/api/wishlist/share-link', null, auth);
    assert.equal(recreated.status, 200);
    assert.notEqual(recreated.body.token, created.body.token);

    for (const shareToken of [created.body.token, recreated.body.token]) {
      const shared = await request(
        app,
        'GET',
        `/api/wishlist/public/by-token?token=${encodeURIComponent(shareToken)}`,
      );
      assert.equal(shared.status, 200);
      assert.equal(shared.body.found, true);
      assert.equal(shared.body.user.name, 'Wish User');
      assert.equal(shared.body.items[0].title, 'Shared Item');
    }
  });

  it('allows share link viewers to toggle purchased status', async () => {
    const token = await signupAndGetToken('share-toggle-owner@example.com');
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(app, 'POST', '/api/wishlist', { title: 'Toggle Item' }, auth);
    const itemId = created.body.item.item_id;
    const link = await request(app, 'POST', '/api/wishlist/share-link', null, auth);

    const patchRes = await request(app, 'PATCH', '/api/wishlist/public/by-token/purchased', {
      token: link.body.token,
      item_id: itemId,
      purchased: true,
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.item.purchased, true);

    const unpatchRes = await request(app, 'PATCH', '/api/wishlist/public/by-token/purchased', {
      token: link.body.token,
      item_id: itemId,
      purchased: false,
    });
    assert.equal(unpatchRes.status, 200);
    assert.equal(unpatchRes.body.item.purchased, false);

    const forged = await request(app, 'PATCH', '/api/wishlist/public/by-token/purchased', {
      token: `${link.body.token}x`,
      item_id: itemId,
      purchased: true,
    });
    assert.equal(forged.status, 400);
  });

  it('rejects share link creation without auth and tampered share tokens', async () => {
    const unauth = await request(app, 'POST', '/api/wishlist/share-link');
    assert.equal(unauth.status, 401);

    const forgedPayload = Buffer.from('some-user-id').toString('base64url');
    const forged = await request(
      app,
      'GET',
      `/api/wishlist/public/by-token?token=${forgedPayload}.someNonce.bogusSignature`,
    );
    assert.equal(forged.status, 400);

    const malformed = await request(app, 'GET', '/api/wishlist/public/by-token?token=bad');
    assert.equal(malformed.status, 400);
  });

  it('returns not found payload for unknown public wishlist email', async () => {
    const res = await request(
      app,
      'GET',
      `/api/wishlist/public/by-email?email=${encodeURIComponent('missing@example.com')}`,
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.found, false);
    assert.deepEqual(res.body.items, []);
  });

  it('allows public viewers to mark an item as purchased', async () => {
    const ownerEmail = 'public-purchase-owner@example.com';
    const token = await signupAndGetToken(ownerEmail);

    const created = await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'Public Purchase Item', purchased: false },
      { Authorization: `Bearer ${token}` },
    );

    const itemId = created.body.item.item_id;

    const patchRes = await request(app, 'PATCH', '/api/wishlist/public/purchased', {
      email: ownerEmail,
      item_id: itemId,
      purchased: true,
    });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.item.item_id, itemId);
    assert.equal(patchRes.body.item.purchased, true);

    const unpatchRes = await request(app, 'PATCH', '/api/wishlist/public/purchased', {
      email: ownerEmail,
      item_id: itemId,
      purchased: false,
    });

    assert.equal(unpatchRes.status, 200);
    assert.equal(unpatchRes.body.item.item_id, itemId);
    assert.equal(unpatchRes.body.item.purchased, false);
  });

  it('creates a wishlist item', async () => {
    const token = await signupAndGetToken();
    const imageB64 = Buffer.from('img-bytes').toString('base64');

    const res = await request(
      app,
      'POST',
      '/api/wishlist',
      {
        title: 'Mechanical Keyboard',
        description: '75% layout',
        priority: 2,
        item_image: imageB64,
      },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.item.title, 'Mechanical Keyboard');
    assert.equal(res.body.item.price, 0);
    assert.equal(res.body.item.priority, 2);
    assert.equal(res.body.item.quantity, 1);
    assert.equal(res.body.item.purchased, false);
    assert.equal(res.body.item.item_image, imageB64);
    assert.ok(res.body.item.created_date);
  });

  it('adds new wishlist items to the top of the display order', async () => {
    const token = await signupAndGetToken();

    const first = await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'First Item' },
      { Authorization: `Bearer ${token}` },
    );

    const second = await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'Second Item' },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(first.body.item.sequence, 0);
    assert.equal(second.body.item.sequence, 0);

    const list = await request(app, 'GET', '/api/wishlist', null, {
      Authorization: `Bearer ${token}`,
    });

    assert.equal(list.status, 200);
    assert.equal(list.body.items.length, 2);
    assert.equal(list.body.items[0].title, 'Second Item');
    assert.equal(list.body.items[0].sequence, 0);
    assert.equal(list.body.items[1].title, 'First Item');
    assert.equal(list.body.items[1].sequence, 1);
  });

  it('lists only current user wishlist items', async () => {
    const token1 = await signupAndGetToken('w1@example.com');
    const token2 = await signupAndGetToken('w2@example.com');

    await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'W1 Item' },
      { Authorization: `Bearer ${token1}` },
    );

    await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'W2 Item' },
      { Authorization: `Bearer ${token2}` },
    );

    const list1 = await request(app, 'GET', '/api/wishlist', null, {
      Authorization: `Bearer ${token1}`,
    });

    assert.equal(list1.status, 200);
    assert.equal(list1.body.items.length, 1);
    assert.equal(list1.body.items[0].title, 'W1 Item');
  });

  it('gets a wishlist item by id', async () => {
    const token = await signupAndGetToken();

    const create = await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'Laptop Stand' },
      { Authorization: `Bearer ${token}` },
    );

    const itemId = create.body.item.item_id;
    const getOne = await request(app, 'GET', `/api/wishlist/${itemId}`, null, {
      Authorization: `Bearer ${token}`,
    });

    assert.equal(getOne.status, 200);
    assert.equal(getOne.body.item.item_id, itemId);
  });

  it('updates a wishlist item', async () => {
    const token = await signupAndGetToken();

    const create = await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'Old title' },
      { Authorization: `Bearer ${token}` },
    );

    const itemId = create.body.item.item_id;

    const update = await request(
      app,
      'PUT',
      `/api/wishlist/${itemId}`,
      {
        title: 'New title',
        purchased: true,
        quantity: 2,
        priority: 0,
        price: 129.99,
      },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(update.status, 200);
    assert.equal(update.body.item.title, 'New title');
    assert.equal(update.body.item.purchased, true);
    assert.equal(update.body.item.quantity, 2);
    assert.equal(update.body.item.priority, 0);
    assert.equal(update.body.item.price, 129.99);
  });

  it('deletes a wishlist item', async () => {
    const token = await signupAndGetToken();

    const create = await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'Delete me' },
      { Authorization: `Bearer ${token}` },
    );

    const itemId = create.body.item.item_id;

    const del = await request(app, 'DELETE', `/api/wishlist/${itemId}`, null, {
      Authorization: `Bearer ${token}`,
    });

    assert.equal(del.status, 200);

    const getOne = await request(app, 'GET', `/api/wishlist/${itemId}`, null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(getOne.status, 404);
  });

  it('validates wishlist fields', async () => {
    const token = await signupAndGetToken();

    const badPriority = await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'Bad', priority: 99 },
      { Authorization: `Bearer ${token}` },
    );
    assert.equal(badPriority.status, 400);

    const badQuantity = await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'Bad', quantity: 0 },
      { Authorization: `Bearer ${token}` },
    );
    assert.equal(badQuantity.status, 400);

    const badPrice = await request(
      app,
      'POST',
      '/api/wishlist',
      { title: 'Bad', price: -1 },
      { Authorization: `Bearer ${token}` },
    );
    assert.equal(badPrice.status, 400);
  });

  it('rejects unauthenticated access', async () => {
    const res = await request(app, 'GET', '/api/wishlist');
    assert.equal(res.status, 401);
  });

  it('imports exported wishlist items in append and replace modes', async () => {
    const token = await signupAndGetToken();
    const auth = { Authorization: `Bearer ${token}` };
    const image = Buffer.from('fake-image-bytes').toString('base64');

    await request(app, 'POST', '/api/wishlist', { title: 'Existing' }, auth);
    const exported = await request(app, 'GET', '/api/wishlist', null, auth);

    const appendRes = await request(
      app,
      'POST',
      '/api/wishlist/import',
      {
        mode: 'append',
        items: [
          { title: 'First import', price: 12.5, priority: 0, item_image: image },
          { title: 'Second import', quantity: 2, purchased: true },
        ],
      },
      auth,
    );
    assert.equal(appendRes.status, 200);
    assert.deepEqual(appendRes.body, { imported: 2, removed: 0 });

    const afterAppend = await request(app, 'GET', '/api/wishlist', null, auth);
    assert.deepEqual(
      afterAppend.body.items.map((item) => item.title),
      ['Existing', 'First import', 'Second import'],
    );
    assert.equal(afterAppend.body.items[1].item_image, image);
    assert.equal(afterAppend.body.items[1].price, 12.5);
    assert.equal(afterAppend.body.items[2].purchased, true);

    const replaceRes = await request(
      app,
      'POST',
      '/api/wishlist/import',
      { mode: 'replace', items: exported.body.items },
      auth,
    );
    assert.deepEqual(replaceRes.body, { imported: 1, removed: 3 });

    const afterReplace = await request(app, 'GET', '/api/wishlist', null, auth);
    assert.deepEqual(
      afterReplace.body.items.map((item) => item.title),
      ['Existing'],
    );
  });

  it('rejects invalid wishlist imports without changing data', async () => {
    const token = await signupAndGetToken();
    const auth = { Authorization: `Bearer ${token}` };

    await request(app, 'POST', '/api/wishlist', { title: 'Keep me' }, auth);

    const res = await request(
      app,
      'POST',
      '/api/wishlist/import',
      { mode: 'replace', items: [{ title: 'Valid' }, { title: 'Bad', priority: 7 }] },
      auth,
    );
    assert.equal(res.status, 400);
    assert.match(res.body.error, /^items\[1\]: priority/);

    const list = await request(app, 'GET', '/api/wishlist', null, auth);
    assert.deepEqual(
      list.body.items.map((item) => item.title),
      ['Keep me'],
    );
  });
});

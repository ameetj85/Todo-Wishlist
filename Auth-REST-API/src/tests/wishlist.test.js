"use strict";

process.env.DATABASE_URL = "file:./data/test.db";
process.env.SESSION_EXPIRY_HOURS = "24";
process.env.RESET_TOKEN_EXPIRY_MINUTES = "60";
process.env.BCRYPT_ROUNDS = "4";
process.env.RATE_LIMIT_GLOBAL = "100000";
process.env.RATE_LIMIT_AUTH = "100000";

const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { resetDb } = require("./helpers");

let app;
before(() => {
  app = require("../../server");
});
beforeEach(resetDb);

const http = require("http");

function request(app, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const data = body ? JSON.stringify(body) : null;
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          method,
          path,
          headers: {
            "Content-Type": "application/json",
            ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
            ...headers,
          },
        },
        (res) => {
          let raw = "";
          res.on("data", (c) => {
            raw += c;
          });
          res.on("end", () => {
            server.close();
            resolve({
              status: res.statusCode,
              body: JSON.parse(raw || "null"),
            });
          });
        },
      );

      req.on("error", reject);
      if (data) req.write(data);
      req.end();
    });
  });
}

async function signupAndGetToken(email = "wish-user@example.com") {
  const res = await request(app, "POST", "/api/auth/signup", {
    email,
    password: "WishPass123",
    name: "Wish User",
  });

  assert.equal(res.status, 201);
  return res.body.token;
}

describe("Wishlist CRUD Routes", () => {
  it("allows public wishlist lookup by email", async () => {
    const ownerEmail = "public-owner@example.com";
    const token = await signupAndGetToken(ownerEmail);

    await request(
      app,
      "POST",
      "/api/wishlist",
      { title: "Public Item" },
      { Authorization: `Bearer ${token}` },
    );

    const res = await request(
      app,
      "GET",
      `/api/wishlist/public/by-email?email=${encodeURIComponent(ownerEmail)}`,
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.found, true);
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].title, "Public Item");
  });

  it("returns not found payload for unknown public wishlist email", async () => {
    const res = await request(
      app,
      "GET",
      `/api/wishlist/public/by-email?email=${encodeURIComponent("missing@example.com")}`,
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.found, false);
    assert.deepEqual(res.body.items, []);
  });

  it("allows public viewers to mark an item as purchased", async () => {
    const ownerEmail = "public-purchase-owner@example.com";
    const token = await signupAndGetToken(ownerEmail);

    const created = await request(
      app,
      "POST",
      "/api/wishlist",
      { title: "Public Purchase Item", purchased: false },
      { Authorization: `Bearer ${token}` },
    );

    const itemId = created.body.item.item_id;

    const patchRes = await request(app, "PATCH", "/api/wishlist/public/purchased", {
      email: ownerEmail,
      item_id: itemId,
      purchased: true,
    });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.item.item_id, itemId);
    assert.equal(patchRes.body.item.purchased, true);

    const unpatchRes = await request(app, "PATCH", "/api/wishlist/public/purchased", {
      email: ownerEmail,
      item_id: itemId,
      purchased: false,
    });

    assert.equal(unpatchRes.status, 200);
    assert.equal(unpatchRes.body.item.item_id, itemId);
    assert.equal(unpatchRes.body.item.purchased, false);
  });

  it("creates a wishlist item", async () => {
    const token = await signupAndGetToken();
    const imageB64 = Buffer.from("img-bytes").toString("base64");

    const res = await request(
      app,
      "POST",
      "/api/wishlist",
      {
        title: "Mechanical Keyboard",
        description: "75% layout",
        priority: 2,
        item_image: imageB64,
      },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.item.title, "Mechanical Keyboard");
    assert.equal(res.body.item.price, 0);
    assert.equal(res.body.item.priority, 2);
    assert.equal(res.body.item.quantity, 1);
    assert.equal(res.body.item.purchased, false);
    assert.equal(res.body.item.item_image, imageB64);
    assert.ok(res.body.item.created_date);
  });

  it("lists only current user wishlist items", async () => {
    const token1 = await signupAndGetToken("w1@example.com");
    const token2 = await signupAndGetToken("w2@example.com");

    await request(
      app,
      "POST",
      "/api/wishlist",
      { title: "W1 Item" },
      { Authorization: `Bearer ${token1}` },
    );

    await request(
      app,
      "POST",
      "/api/wishlist",
      { title: "W2 Item" },
      { Authorization: `Bearer ${token2}` },
    );

    const list1 = await request(app, "GET", "/api/wishlist", null, {
      Authorization: `Bearer ${token1}`,
    });

    assert.equal(list1.status, 200);
    assert.equal(list1.body.items.length, 1);
    assert.equal(list1.body.items[0].title, "W1 Item");
  });

  it("gets a wishlist item by id", async () => {
    const token = await signupAndGetToken();

    const create = await request(
      app,
      "POST",
      "/api/wishlist",
      { title: "Laptop Stand" },
      { Authorization: `Bearer ${token}` },
    );

    const itemId = create.body.item.item_id;
    const getOne = await request(app, "GET", `/api/wishlist/${itemId}`, null, {
      Authorization: `Bearer ${token}`,
    });

    assert.equal(getOne.status, 200);
    assert.equal(getOne.body.item.item_id, itemId);
  });

  it("updates a wishlist item", async () => {
    const token = await signupAndGetToken();

    const create = await request(
      app,
      "POST",
      "/api/wishlist",
      { title: "Old title" },
      { Authorization: `Bearer ${token}` },
    );

    const itemId = create.body.item.item_id;

    const update = await request(
      app,
      "PUT",
      `/api/wishlist/${itemId}`,
      {
        title: "New title",
        purchased: true,
        quantity: 2,
        priority: 0,
        price: 129.99,
      },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(update.status, 200);
    assert.equal(update.body.item.title, "New title");
    assert.equal(update.body.item.purchased, true);
    assert.equal(update.body.item.quantity, 2);
    assert.equal(update.body.item.priority, 0);
    assert.equal(update.body.item.price, 129.99);
  });

  it("deletes a wishlist item", async () => {
    const token = await signupAndGetToken();

    const create = await request(
      app,
      "POST",
      "/api/wishlist",
      { title: "Delete me" },
      { Authorization: `Bearer ${token}` },
    );

    const itemId = create.body.item.item_id;

    const del = await request(app, "DELETE", `/api/wishlist/${itemId}`, null, {
      Authorization: `Bearer ${token}`,
    });

    assert.equal(del.status, 200);

    const getOne = await request(app, "GET", `/api/wishlist/${itemId}`, null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(getOne.status, 404);
  });

  it("validates wishlist fields", async () => {
    const token = await signupAndGetToken();

    const badPriority = await request(
      app,
      "POST",
      "/api/wishlist",
      { title: "Bad", priority: 99 },
      { Authorization: `Bearer ${token}` },
    );
    assert.equal(badPriority.status, 400);

    const badQuantity = await request(
      app,
      "POST",
      "/api/wishlist",
      { title: "Bad", quantity: 0 },
      { Authorization: `Bearer ${token}` },
    );
    assert.equal(badQuantity.status, 400);

    const badPrice = await request(
      app,
      "POST",
      "/api/wishlist",
      { title: "Bad", price: -1 },
      { Authorization: `Bearer ${token}` },
    );
    assert.equal(badPrice.status, 400);
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app, "GET", "/api/wishlist");
    assert.equal(res.status, 401);
  });
});

"use strict";

process.env.DATABASE_URL = "file:./data/test.db";
process.env.SESSION_EXPIRY_HOURS = "24";
process.env.RESET_TOKEN_EXPIRY_MINUTES = "60";
process.env.BCRYPT_ROUNDS = "4"; // Low rounds for speed in tests
process.env.RATE_LIMIT_GLOBAL = "100000";
process.env.RATE_LIMIT_AUTH = "100000";

const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { resetDb, getUser, getSession, getResetToken } = require("./helpers");

// Lazy-load app after env is set
let app;
before(() => {
  app = require("../../server");
});
beforeEach(resetDb);

// ─── Minimal fetch-like helper using http ────────────────────────────────────
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
          res.on("data", (c) => (raw += c));
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

const VALID_USER = {
  email: "alice@example.com",
  password: "AlicePass1",
  name: "Alice",
};

// ─── /signup ─────────────────────────────────────────────────────────────────

describe("POST /api/auth/signup", () => {
  it("creates account and returns token", async () => {
    const res = await request(app, "POST", "/api/auth/signup", VALID_USER);
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, VALID_USER.email);
  });

  it("rejects duplicate email", async () => {
    await request(app, "POST", "/api/auth/signup", VALID_USER);
    const res = await request(app, "POST", "/api/auth/signup", VALID_USER);
    assert.equal(res.status, 409);
  });

  it("rejects missing fields", async () => {
    const res = await request(app, "POST", "/api/auth/signup", {
      email: "x@x.com",
    });
    assert.equal(res.status, 400);
  });

  it("rejects weak password", async () => {
    const res = await request(app, "POST", "/api/auth/signup", {
      ...VALID_USER,
      password: "weak",
    });
    assert.equal(res.status, 400);
  });

  it("rejects invalid email", async () => {
    const res = await request(app, "POST", "/api/auth/signup", {
      ...VALID_USER,
      email: "notanemail",
    });
    assert.equal(res.status, 400);
  });
});

// ─── /login ──────────────────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  it("returns token on valid credentials", async () => {
    await request(app, "POST", "/api/auth/signup", VALID_USER);
    const res = await request(app, "POST", "/api/auth/login", {
      email: VALID_USER.email,
      password: VALID_USER.password,
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  it("rejects wrong password", async () => {
    await request(app, "POST", "/api/auth/signup", VALID_USER);
    const res = await request(app, "POST", "/api/auth/login", {
      email: VALID_USER.email,
      password: "WrongPass1",
    });
    assert.equal(res.status, 401);
  });

  it("rejects non-existent user", async () => {
    const res = await request(app, "POST", "/api/auth/login", {
      email: "ghost@nowhere.com",
      password: "GhostPass1",
    });
    assert.equal(res.status, 401);
  });

  it("rejects missing password", async () => {
    const res = await request(app, "POST", "/api/auth/login", {
      email: "x@x.com",
    });
    assert.equal(res.status, 400);
  });
});

// ─── /me ─────────────────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("returns user info with valid token", async () => {
    const signup = await request(app, "POST", "/api/auth/signup", VALID_USER);
    const res = await request(app, "GET", "/api/auth/me", null, {
      Authorization: `Bearer ${signup.body.token}`,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, VALID_USER.email);
  });

  it("rejects missing token", async () => {
    const res = await request(app, "GET", "/api/auth/me");
    assert.equal(res.status, 401);
  });

  it("rejects invalid token", async () => {
    const res = await request(app, "GET", "/api/auth/me", null, {
      Authorization: "Bearer fake-token",
    });
    assert.equal(res.status, 401);
  });
});

// ─── /logout ─────────────────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  it("invalidates the session token", async () => {
    const signup = await request(app, "POST", "/api/auth/signup", VALID_USER);
    const token = signup.body.token;
    assert.ok(await getSession(token));

    const logout = await request(app, "POST", "/api/auth/logout", null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(logout.status, 200);
    assert.equal(await getSession(token), null);

    // Token should no longer work
    const me = await request(app, "GET", "/api/auth/me", null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(me.status, 401);
  });
});

// ─── /logout-all ─────────────────────────────────────────────────────────────

describe("POST /api/auth/logout-all", () => {
  it("invalidates all sessions", async () => {
    const s1 = await request(app, "POST", "/api/auth/signup", VALID_USER);
    const s2 = await request(app, "POST", "/api/auth/login", {
      email: VALID_USER.email,
      password: VALID_USER.password,
    });

    await request(app, "POST", "/api/auth/logout-all", null, {
      Authorization: `Bearer ${s1.body.token}`,
    });

    const check1 = await request(app, "GET", "/api/auth/me", null, {
      Authorization: `Bearer ${s1.body.token}`,
    });
    const check2 = await request(app, "GET", "/api/auth/me", null, {
      Authorization: `Bearer ${s2.body.token}`,
    });
    assert.equal(check1.status, 401);
    assert.equal(check2.status, 401);
  });
});

// ─── /forgot-password ────────────────────────────────────────────────────────

describe("POST /api/auth/forgot-password", () => {
  it("always returns 200 (prevents enumeration)", async () => {
    const res = await request(app, "POST", "/api/auth/forgot-password", {
      email: "nobody@nowhere.com",
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.message);
  });

  it("creates a reset token for existing users", async () => {
    await request(app, "POST", "/api/auth/signup", VALID_USER);
    const user = await getUser(VALID_USER.email);
    await request(app, "POST", "/api/auth/forgot-password", {
      email: VALID_USER.email,
    });
    const token = await getResetToken(user.id);
    assert.ok(token);
    assert.equal(token.used, false);
  });

  it("rejects missing email", async () => {
    const res = await request(app, "POST", "/api/auth/forgot-password", {});
    assert.equal(res.status, 400);
  });
});

// ─── /reset-password ─────────────────────────────────────────────────────────

describe("POST /api/auth/reset-password", () => {
  async function setupReset() {
    await request(app, "POST", "/api/auth/signup", VALID_USER);
    const user = await getUser(VALID_USER.email);
    await request(app, "POST", "/api/auth/forgot-password", {
      email: VALID_USER.email,
    });
    const tokenRecord = await getResetToken(user.id);
    return { user, resetToken: tokenRecord.token };
  }

  it("resets password and invalidates sessions", async () => {
    const { resetToken } = await setupReset();
    const res = await request(app, "POST", "/api/auth/reset-password", {
      token: resetToken,
      password: "NewPass123",
    });
    assert.equal(res.status, 200);

    // Old password should no longer work
    const login = await request(app, "POST", "/api/auth/login", {
      email: VALID_USER.email,
      password: VALID_USER.password,
    });
    assert.equal(login.status, 401);

    // New password should work
    const login2 = await request(app, "POST", "/api/auth/login", {
      email: VALID_USER.email,
      password: "NewPass123",
    });
    assert.equal(login2.status, 200);
  });

  it("rejects an already-used token", async () => {
    const { resetToken } = await setupReset();
    await request(app, "POST", "/api/auth/reset-password", {
      token: resetToken,
      password: "NewPass123",
    });
    const res = await request(app, "POST", "/api/auth/reset-password", {
      token: resetToken,
      password: "AnotherPass1",
    });
    assert.equal(res.status, 400);
  });

  it("rejects invalid token", async () => {
    const res = await request(app, "POST", "/api/auth/reset-password", {
      token: "fake-token",
      password: "NewPass123",
    });
    assert.equal(res.status, 400);
  });

  it("rejects weak new password", async () => {
    const { resetToken } = await setupReset();
    const res = await request(app, "POST", "/api/auth/reset-password", {
      token: resetToken,
      password: "weak",
    });
    assert.equal(res.status, 400);
  });
});

// ─── /sessions ───────────────────────────────────────────────────────────────

describe("GET /api/auth/sessions", () => {
  it("lists active sessions", async () => {
    const signup = await request(app, "POST", "/api/auth/signup", VALID_USER);
    const res = await request(app, "GET", "/api/auth/sessions", null, {
      Authorization: `Bearer ${signup.body.token}`,
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.sessions));
    assert.equal(res.body.sessions.length, 1);
    assert.equal(res.body.sessions[0].is_current, 1);
  });
});

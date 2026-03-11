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

async function signupAndGetToken(email = "todo-user@example.com") {
  const res = await request(app, "POST", "/api/auth/signup", {
    email,
    password: "TodoPass123",
    name: "Todo User",
  });

  assert.equal(res.status, 201);
  return res.body.token;
}

describe("Todo CRUD Routes", () => {
  it("creates a todo", async () => {
    const token = await signupAndGetToken();
    const res = await request(
      app,
      "POST",
      "/api/todos",
      {
        name: "Buy milk",
        description: "2 liters of milk",
        category: "Personal",
        due_date: "2099-01-01",
        completed: false,
        remind_me: true,
        reminder_date: "2099-01-01T09:30:00.000Z",
        reminder_sent: false,
      },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.todo.name, "Buy milk");
    assert.equal(res.body.todo.completed, false);
    assert.equal(res.body.todo.remind_me, true);
    assert.equal(res.body.todo.reminder_date, "2099-01-01T09:30:00.000Z");
    assert.equal(res.body.todo.reminder_sent, false);
    assert.ok(res.body.todo.created_date);
  });

  it("lists only current user todos", async () => {
    const token1 = await signupAndGetToken("u1@example.com");
    const token2 = await signupAndGetToken("u2@example.com");

    await request(
      app,
      "POST",
      "/api/todos",
      { name: "U1 Todo", description: "d1", category: "Work" },
      { Authorization: `Bearer ${token1}` },
    );

    await request(
      app,
      "POST",
      "/api/todos",
      { name: "U2 Todo", description: "d2", category: "Work" },
      { Authorization: `Bearer ${token2}` },
    );

    const list1 = await request(app, "GET", "/api/todos", null, {
      Authorization: `Bearer ${token1}`,
    });

    assert.equal(list1.status, 200);
    assert.equal(list1.body.todos.length, 1);
    assert.equal(list1.body.todos[0].name, "U1 Todo");
  });

  it("filters todos due today or overdue and not completed", async () => {
    const token = await signupAndGetToken("due-today@example.com");

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await request(
      app,
      "POST",
      "/api/todos",
      {
        name: "Overdue open",
        description: "Should be included",
        category: "Work",
        due_date: yesterday,
        completed: false,
      },
      { Authorization: `Bearer ${token}` },
    );

    await request(
      app,
      "POST",
      "/api/todos",
      {
        name: "Due today open",
        description: "Should be included",
        category: "Work",
        due_date: today,
        completed: false,
      },
      { Authorization: `Bearer ${token}` },
    );

    await request(
      app,
      "POST",
      "/api/todos",
      {
        name: "No due date open",
        description: "Should be excluded",
        category: "Work",
        due_date: null,
        completed: false,
      },
      { Authorization: `Bearer ${token}` },
    );

    await request(
      app,
      "POST",
      "/api/todos",
      {
        name: "Due today completed",
        description: "Should be excluded",
        category: "Work",
        due_date: today,
        completed: true,
      },
      { Authorization: `Bearer ${token}` },
    );

    await request(
      app,
      "POST",
      "/api/todos",
      {
        name: "Due tomorrow open",
        description: "Should be excluded",
        category: "Work",
        due_date: tomorrow,
        completed: false,
      },
      { Authorization: `Bearer ${token}` },
    );

    const filtered = await request(app, "GET", "/api/todos?due_today_open=1", null, {
      Authorization: `Bearer ${token}`,
    });

    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.todos.length, 2);
    assert.equal(
      filtered.body.todos.some((todo) => todo.name === "Overdue open"),
      true,
    );
    assert.equal(
      filtered.body.todos.some((todo) => todo.name === "Due today open"),
      true,
    );
    assert.equal(
      filtered.body.todos.every((todo) => todo.completed === false),
      true,
    );
    assert.equal(
      filtered.body.todos.every((todo) => todo.due_date !== null && todo.due_date <= today),
      true,
    );
  });

  it("gets a todo by id", async () => {
    const token = await signupAndGetToken();

    const create = await request(
      app,
      "POST",
      "/api/todos",
      { name: "Read book", description: "Read 10 pages", category: "Learning" },
      { Authorization: `Bearer ${token}` },
    );

    const todoId = create.body.todo.todo_id;
    const getOne = await request(app, "GET", `/api/todos/${todoId}`, null, {
      Authorization: `Bearer ${token}`,
    });

    assert.equal(getOne.status, 200);
    assert.equal(getOne.body.todo.todo_id, todoId);
  });

  it("updates a todo", async () => {
    const token = await signupAndGetToken();

    const create = await request(
      app,
      "POST",
      "/api/todos",
      { name: "Old title", description: "Old desc", category: "Work" },
      { Authorization: `Bearer ${token}` },
    );

    const todoId = create.body.todo.todo_id;

    const update = await request(
      app,
      "PUT",
      "/api/todos",
      {
        todo_id: todoId,
        name: "New title",
        completed: true,
        remind_me: true,
        reminder_date: "2099-05-05T12:00:00.000Z",
        reminder_sent: true,
      },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(update.status, 200);
    assert.equal(update.body.todo.name, "New title");
    assert.equal(update.body.todo.completed, true);
    assert.equal(update.body.todo.remind_me, true);
    assert.equal(update.body.todo.reminder_date, "2099-05-05T12:00:00.000Z");
    assert.equal(update.body.todo.reminder_sent, true);
  });

  it("rejects create when reminder_sent is true and reminder_date is null", async () => {
    const token = await signupAndGetToken();

    const res = await request(
      app,
      "POST",
      "/api/todos",
      {
        name: "Invalid reminder",
        description: "Should fail",
        category: "Work",
        remind_me: true,
        reminder_date: null,
        reminder_sent: true,
      },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(res.status, 400);
    assert.equal(
      res.body.error,
      "reminder_date is required when reminder_sent is true",
    );
  });

  it("rejects update that would set reminder_sent true without reminder_date", async () => {
    const token = await signupAndGetToken();

    const create = await request(
      app,
      "POST",
      "/api/todos",
      {
        name: "Prepare meeting",
        description: "Set reminder first",
        category: "Work",
      },
      { Authorization: `Bearer ${token}` },
    );

    const todoId = create.body.todo.todo_id;

    const update = await request(
      app,
      "PUT",
      "/api/todos",
      {
        todo_id: todoId,
        reminder_sent: true,
      },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(update.status, 400);
    assert.equal(
      update.body.error,
      "reminder_date is required when reminder_sent is true",
    );
  });

  it("deletes a todo", async () => {
    const token = await signupAndGetToken();

    const create = await request(
      app,
      "POST",
      "/api/todos",
      { name: "Delete me", description: "Soon gone", category: "Personal" },
      { Authorization: `Bearer ${token}` },
    );

    const todoId = create.body.todo.todo_id;

    const del = await request(app, "DELETE", `/api/todos/${todoId}`, null, {
      Authorization: `Bearer ${token}`,
    });

    assert.equal(del.status, 200);

    const getOne = await request(app, "GET", `/api/todos/${todoId}`, null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(getOne.status, 404);
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app, "GET", "/api/todos");
    assert.equal(res.status, 401);
  });

  it("rejects update without todo_id", async () => {
    const token = await signupAndGetToken();
    const res = await request(
      app,
      "PUT",
      "/api/todos",
      { name: "Should fail" },
      { Authorization: `Bearer ${token}` },
    );

    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Invalid todo_id");
  });
});

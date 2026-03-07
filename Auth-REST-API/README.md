# Auth API

A production-ready REST API authentication system built with **Node.js**, **Express**, and **SQLite** (via `better-sqlite3`). No external auth services required — sessions are stored on disk.

## Features

- Signup, Login, Logout (single session or all sessions)
- Forgot Password / Reset Password via email
- Active session listing
- bcrypt password hashing, timing-safe login
- Rate limiting & security headers (helmet)
- Fully configurable session expiry
- Built-in database scripts (init, seed, reset, cleanup)
- Environment validation script
- Full test suite (Node.js built-in test runner — no extra deps)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET and SMTP credentials

# 3. Validate environment
npm run check:env

# 4. Start
npm start          # production
npm run dev        # development (auto-restart on file changes)
```

---

## npm Scripts

| Script                  | Description                            |
| ----------------------- | -------------------------------------- |
| `npm start`             | Start the server                       |
| `npm run dev`           | Start with `--watch` (auto-restart)    |
| `npm test`              | Run all tests                          |
| `npm run test:watch`    | Run tests in watch mode                |
| `npm run test:coverage` | Run tests with coverage report         |
| `npm run lint`          | Lint with ESLint                       |
| `npm run lint:fix`      | Auto-fix lint issues                   |
| `npm run db:init`       | Initialize database schema             |
| `npm run db:seed`       | Insert sample dev/test users and todos |
| `npm run db:reset`      | ⚠️ Drop and recreate database          |
| `npm run db:cleanup`    | Remove expired sessions & tokens       |
| `npm run check:env`     | Validate all environment variables     |

---

## Project Structure

```
auth-api/
├── server.js                    # Entry point
├── package.json
├── .env.example                 # All supported env vars with comments
├── .eslintrc.json
│
├── src/
│   ├── config/
│   │   └── index.js             # Central config (reads from env)
│   ├── db/
│   │   └── database.js          # SQLite init & schema
│   ├── middleware/
│   │   └── auth.js              # requireAuth middleware
│   ├── routes/
│   │   └── auth.js              # All 8 auth endpoints
│   ├── utils/
│   │   └── email.js             # Nodemailer password reset emails
│   └── validators/
│       └── index.js             # Input validation functions
│
├── scripts/
│   ├── db-init.js               # npm run db:init
│   ├── db-reset.js              # npm run db:reset
│   ├── db-seed.js               # npm run db:seed
│   ├── db-cleanup.js            # npm run db:cleanup
│   └── check-env.js             # npm run check:env
│
└── tests/
    ├── helpers.js               # Shared DB helpers for tests
    ├── validators.test.js       # Unit tests — validators
    ├── database.test.js         # Unit tests — DB schema
    └── auth.test.js             # Integration tests — all endpoints
```

---

## API Reference

Auth endpoints are under `/api/auth`, Todo endpoints are under `/api/todos`, Wishlist endpoints are under `/api/wishlist`, and health is at `/health`. Protected endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint           | Auth | Description                |
| ------ | ------------------ | ---- | -------------------------- |
| `POST` | `/signup`          | —    | Create account             |
| `POST` | `/login`           | —    | Authenticate               |
| `POST` | `/logout`          | 🔒   | Invalidate current session |
| `POST` | `/logout-all`      | 🔒   | Invalidate all sessions    |
| `GET`  | `/me`              | 🔒   | Get current user           |
| `GET`  | `/sessions`        | 🔒   | List active sessions       |
| `POST` | `/forgot-password` | —    | Send reset email           |
| `POST` | `/reset-password`  | —    | Reset password with token  |
| `GET`  | `/health`          | —    | Health check               |

### Todo Endpoints

| Method   | Endpoint             | Auth | Description      |
| -------- | -------------------- | ---- | ---------------- |
| `POST`   | `/api/todos`         | 🔒   | Create todo      |
| `GET`    | `/api/todos`         | 🔒   | List user todos  |
| `GET`    | `/api/todos/:todoId` | 🔒   | Get a todo by id |
| `PUT`    | `/api/todos`         | 🔒   | Update a todo    |
| `DELETE` | `/api/todos/:todoId` | 🔒   | Delete a todo    |

### Wishlist Endpoints

| Method   | Endpoint                | Auth | Description               |
| -------- | ----------------------- | ---- | ------------------------- |
| `POST`   | `/api/wishlist`         | 🔒   | Create wishlist item      |
| `GET`    | `/api/wishlist`         | 🔒   | List user wishlist items  |
| `GET`    | `/api/wishlist/:itemId` | 🔒   | Get a wishlist item by id |
| `PUT`    | `/api/wishlist/:itemId` | 🔒   | Update a wishlist item    |
| `DELETE` | `/api/wishlist/:itemId` | 🔒   | Delete a wishlist item    |

### POST `/api/auth/signup`

```json
{ "email": "user@example.com", "password": "SecurePass1", "name": "Jane Doe" }
```

Password rules: min 8 chars, 1 uppercase, 1 number.

### POST `/api/auth/login`

```json
{ "email": "user@example.com", "password": "SecurePass1" }
```

### POST `/api/auth/forgot-password`

```json
{ "email": "user@example.com" }
```

Always returns 200 (prevents email enumeration).

### POST `/api/auth/reset-password`

```json
{ "token": "<token-from-email>", "password": "NewSecurePass1" }
```

Invalidates all active sessions on success.

### POST `/api/todos`

```json
{
  "name": "Buy milk",
  "description": "Get 2 liters",
  "category": "Personal",
  "due_date": "2026-03-15",
  "completed": false
}
```

Response (`201`):

```json
{
  "todo": {
    "todo_id": 1,
    "user_id": "a9f7f8b6-2d21-4cd4-8d9e-2db29ea9a2f2",
    "name": "Buy milk",
    "description": "Get 2 liters",
    "due_date": "2026-03-15",
    "created_date": "2026-03-06",
    "category": "Personal",
    "completed": false
  }
}
```

### GET `/api/todos`

Response (`200`):

```json
{
  "todos": [
    {
      "todo_id": 1,
      "user_id": "a9f7f8b6-2d21-4cd4-8d9e-2db29ea9a2f2",
      "name": "Buy milk",
      "description": "Get 2 liters",
      "due_date": "2026-03-15",
      "created_date": "2026-03-06",
      "category": "Personal",
      "completed": false
    }
  ]
}
```

### GET `/api/todos/:todoId`

Response (`200`):

```json
{
  "todo": {
    "todo_id": 1,
    "user_id": "a9f7f8b6-2d21-4cd4-8d9e-2db29ea9a2f2",
    "name": "Buy milk",
    "description": "Get 2 liters",
    "due_date": "2026-03-15",
    "created_date": "2026-03-06",
    "category": "Personal",
    "completed": false
  }
}
```

### PUT `/api/todos`

```json
{
  "todo_id": 1,
  "name": "Buy milk and bread",
  "completed": true
}
```

Response (`200`):

```json
{
  "todo": {
    "todo_id": 1,
    "user_id": "a9f7f8b6-2d21-4cd4-8d9e-2db29ea9a2f2",
    "name": "Buy milk and bread",
    "description": "Get 2 liters",
    "due_date": "2026-03-15",
    "created_date": "2026-03-06",
    "category": "Personal",
    "completed": true
  }
}
```

### DELETE `/api/todos/:todoId`

Response (`200`):

```json
{ "message": "Todo deleted successfully" }
```

### Common Todo Error Responses

`400 Bad Request` (validation / invalid id)

```json
{ "error": "Invalid todo_id" }
```

`401 Unauthorized` (missing or invalid token)

```json
{ "error": "Missing authorization token" }
```

`404 Not Found` (todo does not exist for current user)

```json
{ "error": "Todo not found" }
```

### Todo Field Validation Rules

- `name`: required, non-empty string
- `description`: required, non-empty string
- `category`: required, non-empty string
- `due_date`: optional, must be `YYYY-MM-DD` when provided (or `null` on update)
- `completed`: optional on create, must be boolean when provided
- `todoId` path param: must be a positive integer

Invalid request example (`POST /api/todos`):

```json
{
  "name": "",
  "description": "Get 2 liters",
  "category": "Personal",
  "due_date": "03-15-2026",
  "completed": "no"
}
```

Response (`400`):

```json
{ "error": "name is required" }
```

Invalid request example (`POST /api/todos`) — bad `due_date` format:

```json
{
  "name": "Buy milk",
  "description": "Get 2 liters",
  "category": "Personal",
  "due_date": "03-15-2026"
}
```

Response (`400`):

```json
{ "error": "due_date must be in YYYY-MM-DD format" }
```

Invalid request example (`PUT /api/todos`) — non-boolean `completed`:

```json
{
  "completed": "yes"
}
```

Response (`400`):

```json
{ "error": "completed must be a boolean" }
```

### Quick cURL Examples (Todo)

```bash
# Set your auth token first
TOKEN="<your-jwt-or-session-token>"

# Create todo
curl -X POST http://localhost:3000/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Buy milk","description":"Get 2 liters","category":"Personal","due_date":"2026-03-15","completed":false}'

# List todos
curl -X GET http://localhost:3000/api/todos \
  -H "Authorization: Bearer $TOKEN"

# Get one todo
curl -X GET http://localhost:3000/api/todos/1 \
  -H "Authorization: Bearer $TOKEN"

# Update todo
curl -X PUT http://localhost:3000/api/todos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"todo_id":1,"completed":true,"name":"Buy milk and bread"}'

# Delete todo
curl -X DELETE http://localhost:3000/api/todos/1 \
  -H "Authorization: Bearer $TOKEN"
```

### POST `/api/wishlist`

```json
{
  "title": "Mechanical Keyboard",
  "description": "75% layout with hot-swap switches",
  "url": "https://example.com/keyboard",
  "priority": 2,
  "quantity": 1,
  "purchased": false,
  "sequence": 0,
  "item_image": "aW1hZ2UtYnl0ZXM="
}
```

Response (`201`):

```json
{
  "item": {
    "item_id": 1,
    "userid": "a9f7f8b6-2d21-4cd4-8d9e-2db29ea9a2f2",
    "title": "Mechanical Keyboard",
    "description": "75% layout with hot-swap switches",
    "url": "https://example.com/keyboard",
    "item_image": "aW1hZ2UtYnl0ZXM=",
    "priority": 2,
    "quantity": 1,
    "purchased": false,
    "sequence": 1,
    "created_date": "2026-03-06"
  }
}
```

### GET `/api/wishlist`

Response (`200`):

```json
{
  "items": [
    {
      "item_id": 1,
      "userid": "a9f7f8b6-2d21-4cd4-8d9e-2db29ea9a2f2",
      "title": "Mechanical Keyboard",
      "description": "75% layout with hot-swap switches",
      "url": "https://example.com/keyboard",
      "item_image": "aW1hZ2UtYnl0ZXM=",
      "priority": 2,
      "quantity": 1,
      "purchased": false,
      "sequence": 1,
      "created_date": "2026-03-06"
    }
  ]
}
```

### GET `/api/wishlist/:itemId`

Response (`200`):

```json
{
  "item": {
    "item_id": 1,
    "userid": "a9f7f8b6-2d21-4cd4-8d9e-2db29ea9a2f2",
    "title": "Mechanical Keyboard",
    "description": "75% layout with hot-swap switches",
    "url": "https://example.com/keyboard",
    "item_image": "aW1hZ2UtYnl0ZXM=",
    "priority": 2,
    "quantity": 1,
    "purchased": false,
    "sequence": 1,
    "created_date": "2026-03-06"
  }
}
```

### PUT `/api/wishlist/:itemId`

```json
{
  "title": "Mechanical Keyboard Pro",
  "priority": 1,
  "quantity": 2,
  "purchased": true
}
```

Response (`200`):

```json
{
  "item": {
    "item_id": 1,
    "userid": "a9f7f8b6-2d21-4cd4-8d9e-2db29ea9a2f2",
    "title": "Mechanical Keyboard Pro",
    "description": "75% layout with hot-swap switches",
    "url": "https://example.com/keyboard",
    "item_image": "aW1hZ2UtYnl0ZXM=",
    "priority": 1,
    "quantity": 2,
    "purchased": true,
    "sequence": 1,
    "created_date": "2026-03-06"
  }
}
```

### DELETE `/api/wishlist/:itemId`

Response (`200`):

```json
{ "message": "Wishlist item deleted successfully" }
```

### Common Wishlist Error Responses

`400 Bad Request` (validation / invalid id)

```json
{ "error": "Invalid item_id" }
```

`401 Unauthorized` (missing or invalid token)

```json
{ "error": "Missing authorization token" }
```

`404 Not Found` (item does not exist for current user)

```json
{ "error": "Wishlist item not found" }
```

### Wishlist Field Validation Rules

- `title`: required, non-empty string
- `description`: optional, string (or `null` on update)
- `url`: optional, string (or `null` on update)
- `item_image`: optional, base64-encoded string (or `null` on update)
- `priority`: optional, integer one of `0` (LOW), `1` (MEDIUM), `2` (HIGH)
- `quantity`: optional, integer >= 1
- `purchased`: optional, boolean
- `sequence`: optional, integer >= 0 (if `0`, it auto-computes on create)
- `itemId` path param: must be a positive integer

### Quick cURL Examples (Wishlist)

```bash
# Set your auth token first
TOKEN="<your-jwt-or-session-token>"

# Create wishlist item
curl -X POST http://localhost:3000/api/wishlist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Mechanical Keyboard","description":"75% layout","priority":2,"quantity":1,"purchased":false}'

# List wishlist items
curl -X GET http://localhost:3000/api/wishlist \
  -H "Authorization: Bearer $TOKEN"

# Get one wishlist item
curl -X GET http://localhost:3000/api/wishlist/1 \
  -H "Authorization: Bearer $TOKEN"

# Update wishlist item
curl -X PUT http://localhost:3000/api/wishlist/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priority":1,"quantity":2,"purchased":true}'

# Delete wishlist item
curl -X DELETE http://localhost:3000/api/wishlist/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Configuration

See `.env.example` for all variables. Key ones:

| Variable               | Default          | Notes                                  |
| ---------------------- | ---------------- | -------------------------------------- |
| `SESSION_EXPIRY_HOURS` | `24`             | Supports decimals, e.g. `0.5` = 30 min |
| `BCRYPT_ROUNDS`        | `12`             | 10–14 recommended                      |
| `RATE_LIMIT_AUTH`      | `20`             | Per IP per 15 min on auth routes       |
| `DB_PATH`              | `./data/auth.db` | Use `:memory:` in tests                |

---

## Running Tests

Tests use **Node.js's built-in test runner** (no extra dependencies needed, requires Node 18+).

```bash
npm test
npm run test:coverage
```

Tests run against an **in-memory SQLite database** — your dev DB is untouched.

---

## Production Tips

- Set `NODE_ENV=production` — this suppresses stack traces in error responses
- Set `BCRYPT_ROUNDS=12` or higher
- Change `JWT_SECRET` to a long, random string
- Run `npm run db:cleanup` on a cron to purge expired sessions
- Put behind nginx with TLS

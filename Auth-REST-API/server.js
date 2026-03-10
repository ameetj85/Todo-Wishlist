"use strict";

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const config = require("./src/config");
const authRoutes = require("./src/routes/auth");
const adminRoutes = require("./src/routes/admin");
const todoRoutes = require("./src/routes/todo");
const wishlistRoutes = require("./src/routes/wishlist");

const app = express();

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true, limit: "8mb" }));
app.set("trust proxy", 1);

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use(
  rateLimit({
    ...config.rateLimit.global,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  }),
);

const authLimiter = rateLimit({
  ...config.rateLimit.auth,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts, please try again later" },
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/todos", todoRoutes);
app.use("/api/wishlist", wishlistRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: config.server.env,
  });
});

// ─── 404 & Error Handler ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request payload too large (max 8MB)" });
  }

  console.error(err.stack);
  res.status(500).json({
    error: config.server.isProd ? "Internal server error" : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(config.server.port, () => {
    console.log(`🚀 Auth API  →  http://localhost:${config.server.port}`);
    console.log(`   Env          : ${config.server.env}`);
    console.log(`   Session TTL  : ${config.session.expiryHours}h`);
    console.log(`   DB path      : ${config.db.path}`);
  });
}

module.exports = app;

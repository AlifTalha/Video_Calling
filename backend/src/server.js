require("express-async-errors");
const express = require("express");
const cors = require("cors");
const config = require("./config");
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/rooms");
const adminRoutes = require("./routes/admin");
const errorHandler = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  const allowAllOrigins = config.clientUrls.includes("*");
  const allowedOrigins = new Set(config.clientUrls);

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowAllOrigins || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );

  // ── Body parser ───────────────────────────────────────────────────────────
  app.use(express.json());

  // ── Health check ──────────────────────────────────────────────────────────
  app.get("/", (req, res) => res.json({ status: "ok" }));

  // ── API Routes ────────────────────────────────────────────────────────────
  app.use("/api/auth", authRoutes);
  app.use("/api/rooms", roomRoutes);
  app.use("/api/admin", adminRoutes);

  // ── 404 handler ───────────────────────────────────────────────────────────
  app.use((req, res) => res.status(404).json({ message: "Route not found" }));

  // ── Global error handler ──────────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}

module.exports = createApp;

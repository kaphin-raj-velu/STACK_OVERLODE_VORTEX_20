require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

connectDB();

const app = express();

// Raw body needed for Slack signature verification
app.use("/api/slack", express.raw({ type: "application/x-www-form-urlencoded" }));

// JSON + URL-encoded for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ── Routes ────────────────────────────────────────────────────────────────
app.use("/api/slack",    require("./routes/slack"));
app.use("/api",          require("./routes/questions"));
app.use("/api",          require("./routes/analytics"));

// ── Health ────────────────────────────────────────────────────────────────
app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "ai-interview-audit-backend", version: "2.0.0" })
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`💬 Slack endpoint: POST http://localhost:${PORT}/api/slack/precheck`);
});

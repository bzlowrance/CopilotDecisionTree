/**
 * Copilot Decision Tree — Server Entry Point
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { resolve } from "path";
import { createRouter } from "./routes.js";
import { CopilotTreeAgent } from "./agent.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const TREES_DIR = resolve(process.env.TREES_DIR ?? "../trees");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || undefined;

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Create agent with SDK config
const agent = new CopilotTreeAgent({
  githubToken: GITHUB_TOKEN && GITHUB_TOKEN !== "your_github_token_here" ? GITHUB_TOKEN : undefined,
  useLoggedInUser: true,
  model: "gpt-5.3-codex",
});

app.use("/api", createRouter(TREES_DIR, agent));

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🌳 Copilot Decision Tree — Server      ║
║   http://localhost:${PORT}                  ║
║   Trees dir: ${TREES_DIR.padEnd(28)}║
║   SDK: @github/copilot-sdk v0.1.30       ║
╚═══════════════════════════════════════════╝
  `);

  // Start SDK client in background AFTER server is listening
  // so incoming requests aren't blocked by SDK init
  agent.ensureClient().then(() => {
    console.log("[SDK] CopilotClient ready — auth will be checked on first request");
  }).catch((err) => {
    console.warn("[SDK] CopilotClient startup failed (will retry on first request):", err.message ?? err);
  });
});

/**
 * Routes — Integration tests
 *
 * Tests the Express REST API endpoints using supertest-like
 * approach with the actual router, mocking only the Copilot SDK agent.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express, { type Express } from "express";
import { mkdtemp, rm, writeFile, readFile, readdir, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createRouter } from "../routes.js";
import { CopilotTreeAgent } from "../agent.js";
import type { DecisionTree } from "../types.js";

// ─── Helpers ────────────────────────────────────────────────

let app: Express;
let treesDir: string;
let agent: CopilotTreeAgent;

async function request(method: string, path: string, body?: unknown) {
  // Use the native fetch with an ephemeral server
  const response = await new Promise<{ status: number; body: any }>((resolve) => {
    const req = new Request(`http://localhost${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });

    // Simulate Express handling
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: null as any,
      status(code: number) { this.statusCode = code; return this; },
      json(data: any) { this.body = data; this.headers["content-type"] = "application/json"; },
    };

    // We'll use a simpler approach — actually start a temp server
    resolve({ status: 0, body: null }); // placeholder
  });

  return response;
}

// Since we can't easily use supertest without installing it,
// test the route handler logic directly through the Express app
// by starting a temporary HTTP server.

function makeTestTree(id: string, name: string = "Test Tree"): DecisionTree {
  return {
    id,
    name,
    description: "A test tree",
    version: "1.0.0",
    rootNodeId: "root",
    nodes: [
      {
        id: "root",
        type: "input",
        label: "Start",
        prompt: "Enter a value",
        variableName: "val",
        inputType: "text",
        position: { x: 0, y: 0 },
      },
      {
        id: "end",
        type: "action",
        label: "End",
        actionType: "respond",
        template: "Result: {{val}}",
        position: { x: 200, y: 0 },
      },
    ],
    edges: [{ id: "e1", source: "root", target: "end" }],
    tags: ["test"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

// ─── Test the route handlers via actual HTTP ────────────────

describe("Routes — Tree CRUD", () => {
  let server: any;
  let baseUrl: string;

  beforeEach(async () => {
    treesDir = await mkdtemp(join(tmpdir(), "tree-test-"));
    
    // Create a mock agent that doesn't require the real SDK
    agent = {
      getAuthStatus: vi.fn().mockResolvedValue({ isAuthenticated: true, authType: "token" }),
      getConfig: vi.fn().mockReturnValue({ useLoggedInUser: false, hasToken: true, model: "test" }),
      listModels: vi.fn().mockResolvedValue([{ id: "test-model", name: "Test" }]),
      reconfigure: vi.fn().mockResolvedValue(undefined),
      startRun: vi.fn(),
      advanceRun: vi.fn(),
      getSession: vi.fn(),
      updateWeights: vi.fn(),
      getPendingResult: vi.fn(),
      runPipeline: vi.fn(),
    } as unknown as CopilotTreeAgent;

    app = express();
    app.use(express.json());
    app.use("/api", createRouter(treesDir, agent));

    // Start server on random port
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(resolve));
    await rm(treesDir, { recursive: true, force: true });
  });

  // ── GET /api/trees ────────────────────────────────────

  describe("GET /api/trees", () => {
    it("should return empty array when no trees exist", async () => {
      const res = await fetch(`${baseUrl}/api/trees`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual([]);
    });

    it("should return all trees", async () => {
      const tree = makeTestTree("tree-1", "First Tree");
      await writeFile(join(treesDir, "tree-1.tree.json"), JSON.stringify(tree));

      const res = await fetch(`${baseUrl}/api/trees`);
      const data = await res.json();

      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("tree-1");
      expect(data[0].name).toBe("First Tree");
    });

    it("should only return .tree.json files", async () => {
      await writeFile(join(treesDir, "tree-1.tree.json"), JSON.stringify(makeTestTree("tree-1")));
      await writeFile(join(treesDir, "notes.txt"), "not a tree");
      await writeFile(join(treesDir, "data.json"), "{}");

      const res = await fetch(`${baseUrl}/api/trees`);
      const data = await res.json();

      expect(data).toHaveLength(1);
    });
  });

  // ── GET /api/trees/:id ────────────────────────────────

  describe("GET /api/trees/:id", () => {
    it("should return a specific tree", async () => {
      const tree = makeTestTree("my-tree", "My Tree");
      await writeFile(join(treesDir, "my-tree.tree.json"), JSON.stringify(tree));

      const res = await fetch(`${baseUrl}/api/trees/my-tree`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.id).toBe("my-tree");
      expect(data.name).toBe("My Tree");
    });

    it("should return 404 for non-existent tree", async () => {
      const res = await fetch(`${baseUrl}/api/trees/nonexistent`);
      expect(res.status).toBe(404);
    });
  });

  // ── PUT /api/trees/:id ────────────────────────────────

  describe("PUT /api/trees/:id", () => {
    it("should create a new tree", async () => {
      const tree = makeTestTree("new-tree", "New Tree");

      const res = await fetch(`${baseUrl}/api/trees/new-tree`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tree),
      });

      expect(res.status).toBe(200);

      // Verify file was written
      const files = await readdir(treesDir);
      expect(files).toContain("new-tree.tree.json");
    });

    it("should update an existing tree", async () => {
      const tree = makeTestTree("update-me", "Original");
      await writeFile(join(treesDir, "update-me.tree.json"), JSON.stringify(tree));

      const updated = { ...tree, name: "Updated Name" };
      await fetch(`${baseUrl}/api/trees/update-me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      const content = JSON.parse(await readFile(join(treesDir, "update-me.tree.json"), "utf-8"));
      expect(content.name).toBe("Updated Name");
    });

    it("should set updatedAt timestamp", async () => {
      const tree = makeTestTree("ts-test");

      await fetch(`${baseUrl}/api/trees/ts-test`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tree),
      });

      const content = JSON.parse(await readFile(join(treesDir, "ts-test.tree.json"), "utf-8"));
      expect(content.updatedAt).toBeDefined();
      // Should be a recent ISO string
      const diff = Date.now() - new Date(content.updatedAt).getTime();
      expect(diff).toBeLessThan(5000);
    });
  });

  // ── POST /api/trees ───────────────────────────────────

  describe("POST /api/trees", () => {
    it("should create a tree with a generated ID", async () => {
      const res = await fetch(`${baseUrl}/api/trees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Auto ID Tree",
          description: "Created via POST",
          version: "1.0.0",
          rootNodeId: "root",
          nodes: [],
          edges: [],
          tags: [],
        }),
      });

      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.id).toBeTruthy();
      expect(data.name).toBe("Auto ID Tree");
      expect(data.createdAt).toBeDefined();
    });
  });

  // ── Auth endpoints ────────────────────────────────────

  describe("GET /api/auth/status", () => {
    it("should return auth status", async () => {
      const res = await fetch(`${baseUrl}/api/auth/status`);
      const data = await res.json();

      expect(data.isAuthenticated).toBe(true);
      expect(data.config).toBeDefined();
    });
  });

  describe("GET /api/models", () => {
    it("should return model list", async () => {
      const res = await fetch(`${baseUrl}/api/models`);
      const data = await res.json();

      expect(Array.isArray(data)).toBe(true);
      expect(data[0].id).toBe("test-model");
    });
  });

  // ── Session endpoints ─────────────────────────────────

  describe("POST /api/sessions", () => {
    it("should start a session for a valid tree", async () => {
      const tree = makeTestTree("session-tree");
      await writeFile(join(treesDir, "session-tree.tree.json"), JSON.stringify(tree));

      (agent.startRun as any).mockResolvedValue({
        sessionId: "test-session-123",
        step: { nodeId: "root", nodeType: "input", message: "Enter a value", isTerminal: false },
        narration: "Welcome",
      });

      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId: "session-tree" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessionId).toBe("test-session-123");
    });

    it("should return 404 for non-existent tree", async () => {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId: "nonexistent" }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ── Pipeline endpoints ────────────────────────────────

  describe("POST /api/pipeline/run", () => {
    it("should reject request without treeId", async () => {
      const res = await fetch(`${baseUrl}/api/pipeline/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent tree", async () => {
      const res = await fetch(`${baseUrl}/api/pipeline/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId: "nope" }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/pipeline/batch", () => {
    it("should reject request without treeId and runs", async () => {
      const res = await fetch(`${baseUrl}/api/pipeline/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  // ── Weight endpoints ──────────────────────────────────

  describe("GET /api/weights/defaults", () => {
    it("should return tree-specific weights when treeId is provided", async () => {
      const tree = makeTestTree("weight-tree");
      (tree as any).defaultWeights = [
        { id: "w1", label: "Weight 1", value: 75, color: "#F00" },
      ];
      await writeFile(join(treesDir, "weight-tree.tree.json"), JSON.stringify(tree));

      const res = await fetch(`${baseUrl}/api/weights/defaults?treeId=weight-tree`);
      const data = await res.json();

      expect(data).toHaveLength(1);
      expect(data[0].id).toBe("w1");
    });

    it("should return empty array when no treeId", async () => {
      const res = await fetch(`${baseUrl}/api/weights/defaults`);
      const data = await res.json();

      expect(data).toEqual([]);
    });
  });
});

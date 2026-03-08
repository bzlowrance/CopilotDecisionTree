/**
 * REST API Routes
 *
 * Provides CRUD for decision trees and session management
 * for tree execution with weight profiles.
 */

import { Router, type Request, type Response } from "express";
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname, resolve, isAbsolute } from "path";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import type { DecisionTree, WeightProfile, WeightDimension } from "./types.js";
import { CopilotTreeAgent } from "./agent.js";

export function createRouter(treesDir: string, agent: CopilotTreeAgent): Router {
  const router = Router();

  // ─── Auth & Credential Management ─────────────────────────

  /** Get current authentication status */
  router.get("/auth/status", async (_req: Request, res: Response) => {
    try {
      const status = await agent.getAuthStatus();
      const config = agent.getConfig();
      res.json({ ...status, config });
    } catch (err) {
      res.status(500).json({ error: "Failed to get auth status", details: String(err) });
    }
  });

  /** Reconfigure credentials */
  router.post("/auth/configure", async (req: Request, res: Response) => {
    try {
      const { githubToken, useLoggedInUser, model } = req.body;
      await agent.reconfigure({
        githubToken: githubToken || undefined,
        useLoggedInUser: useLoggedInUser ?? true,
        model: model || undefined,
      });
      // Re-init and check status
      const status = await agent.getAuthStatus();
      const config = agent.getConfig();
      res.json({ ...status, config });
    } catch (err) {
      res.status(500).json({ error: "Failed to configure auth", details: String(err) });
    }
  });

  /** List available models */
  router.get("/models", async (_req: Request, res: Response) => {
    try {
      const models = await agent.listModels();
      res.json(models);
    } catch (err) {
      res.status(500).json({ error: "Failed to list models", details: String(err) });
    }
  });

  // ─── Tree CRUD ────────────────────────────────────────────

  /** List all trees */
  router.get("/trees", async (_req: Request, res: Response) => {
    try {
      await mkdir(treesDir, { recursive: true });
      const files = await readdir(treesDir);
      const treeFiles = files.filter((f) => f.endsWith(".tree.json"));

      const trees: DecisionTree[] = [];
      for (const file of treeFiles) {
        const content = await readFile(join(treesDir, file), "utf-8");
        trees.push(JSON.parse(content));
      }

      res.json(trees);
    } catch (err) {
      res.status(500).json({ error: "Failed to list trees", details: String(err) });
    }
  });

  /** Get a single tree */
  router.get("/trees/:id", async (req: Request, res: Response) => {
    try {
      const tree = await loadTree(treesDir, req.params.id as string);
      if (!tree) {
        res.status(404).json({ error: "Tree not found" });
        return;
      }
      res.json(tree);
    } catch (err) {
      res.status(500).json({ error: "Failed to load tree", details: String(err) });
    }
  });

  /** Create or update a tree */
  router.put("/trees/:id", async (req: Request, res: Response) => {
    try {
      const tree: DecisionTree = {
        ...req.body,
        id: req.params.id,
        updatedAt: new Date().toISOString(),
      };

      if (!tree.createdAt) {
        tree.createdAt = new Date().toISOString();
      }

      await mkdir(treesDir, { recursive: true });
      await writeFile(
        join(treesDir, `${tree.id}.tree.json`),
        JSON.stringify(tree, null, 2),
        "utf-8"
      );

      res.json(tree);
    } catch (err) {
      res.status(500).json({ error: "Failed to save tree", details: String(err) });
    }
  });

  /** Create a new tree */
  router.post("/trees", async (req: Request, res: Response) => {
    try {
      const id = uuidv4();
      const tree: DecisionTree = {
        ...req.body,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await mkdir(treesDir, { recursive: true });
      await writeFile(
        join(treesDir, `${id}.tree.json`),
        JSON.stringify(tree, null, 2),
        "utf-8"
      );

      res.status(201).json(tree);
    } catch (err) {
      res.status(500).json({ error: "Failed to create tree", details: String(err) });
    }
  });

  // ─── Pipeline (Batch) Execution ────────────────────────────

  /**
   * Analyze a tree to discover all required input fields.
   * Returns the "form schema" for the pipeline — variable names,
   * types, choices, defaults, and the order they'd be encountered.
   */
  router.get("/pipeline/schema/:treeId", async (req: Request, res: Response) => {
    try {
      const tree = await loadTree(treesDir, req.params.treeId as string);
      if (!tree) { res.status(404).json({ error: "Tree not found" }); return; }

      // Walk the tree to discover input/assumption nodes in traversal order
      const fields: any[] = [];
      const visited = new Set<string>();
      const queue = [tree.rootNodeId];

      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const node = tree.nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        if (node.type === "input") {
          const inp = node as any;
          fields.push({
            variableName: inp.variableName,
            label: inp.label,
            prompt: inp.prompt,
            inputType: inp.inputType ?? "text",
            choices: inp.choices ?? null,
            default: inp.default ?? (inp.choices?.[0] ?? ""),
            nodeId: node.id,
            required: true,
          });
        } else if (node.type === "assumption") {
          const assump = node as any;
          fields.push({
            variableName: assump.variableName ?? assump.id,
            label: assump.label,
            prompt: assump.assumption,
            inputType: "boolean",
            choices: null,
            default: true,
            nodeId: node.id,
            required: false,
          });
        }

        // Enqueue children
        const outEdges = tree.edges.filter((e) => e.source === nodeId);
        for (const edge of outEdges) {
          if (!visited.has(edge.target)) queue.push(edge.target);
        }
      }

      res.json({
        treeId: tree.id,
        treeName: tree.name,
        description: tree.description,
        fieldCount: fields.length,
        fields,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to build schema", details: String(err) });
    }
  });

  /**
   * Execute a tree in pipeline mode — all inputs pre-filled.
   * Returns the full execution trace and final result.
   */
  router.post("/pipeline/run", async (req: Request, res: Response) => {
    try {
      const { treeId, inputs, weights } = req.body;
      if (!treeId) { res.status(400).json({ error: "treeId is required" }); return; }

      const tree = await loadTree(treesDir, treeId);
      if (!tree) { res.status(404).json({ error: "Tree not found" }); return; }

      const result = await agent.runPipeline(tree, inputs ?? {}, weights);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Pipeline execution failed", details: String(err) });
    }
  });

  /**
   * Batch execute — run a tree multiple times with different inputs.
   * Body: { treeId, runs: [{ inputs, weights? }], concurrency?: number }
   */
  router.post("/pipeline/batch", async (req: Request, res: Response) => {
    try {
      const { treeId, runs, concurrency = 3 } = req.body;
      if (!treeId || !runs?.length) {
        res.status(400).json({ error: "treeId and runs[] are required" });
        return;
      }

      const tree = await loadTree(treesDir, treeId);
      if (!tree) { res.status(404).json({ error: "Tree not found" }); return; }

      // Execute in parallel batches
      const results: any[] = [];
      for (let i = 0; i < runs.length; i += concurrency) {
        const batch = runs.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map((run: any) =>
            agent.runPipeline(tree, run.inputs ?? {}, run.weights).catch((err: any) => ({
              error: String(err),
              inputs: run.inputs,
            }))
          )
        );
        results.push(...batchResults);
      }

      res.json({
        treeId: tree.id,
        treeName: tree.name,
        totalRuns: results.length,
        successful: results.filter((r) => !r.error).length,
        failed: results.filter((r) => r.error).length,
        results,
      });
    } catch (err) {
      res.status(500).json({ error: "Batch execution failed", details: String(err) });
    }
  });

  // ─── Session / Run Endpoints ──────────────────────────────

  /** Start a new tree execution session */
  router.post("/sessions", async (req: Request, res: Response) => {
    try {
      const { treeId, weights, initialContext } = req.body;

      const tree = await loadTree(treesDir, treeId);
      if (!tree) {
        res.status(404).json({ error: "Tree not found" });
        return;
      }

      const result = await agent.startRun(tree, weights, initialContext);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to start session", details: String(err) });
    }
  });

  /** Advance a session with user input */
  router.post("/sessions/:sessionId/advance", async (req: Request, res: Response) => {
    // Allow long-running Copilot SDK calls (up to 5 min)
    req.socket.setTimeout(300_000);
    try {
      const { sessionId } = req.params;
      const { value, treeId } = req.body;

      const tree = await loadTree(treesDir, treeId);
      if (!tree) {
        res.status(404).json({ error: "Tree not found" });
        return;
      }

      const result = await agent.advanceRun(sessionId as string, tree, value);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to advance session", details: String(err) });
    }
  });

  /** Poll for pending Copilot SDK result */
  router.get("/sessions/:sessionId/pending-result", (req: Request, res: Response) => {
    const pending = agent.getPendingResult(req.params.sessionId as string);
    if (!pending) {
      res.status(404).json({ status: "not-found" });
      return;
    }
    res.json(pending);
  });

  /** Get session state (for weight visualization) */
  router.get("/sessions/:sessionId", (req: Request, res: Response) => {
    const state = agent.getSession(req.params.sessionId as string);
    if (!state) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(state);
  });

  /** Update weights mid-session */
  router.put("/sessions/:sessionId/weights", (req: Request, res: Response) => {
    try {
      const { weights } = req.body;
      agent.updateWeights(req.params.sessionId as string, weights);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update weights", details: String(err) });
    }
  });

  // ─── Weight Profiles ──────────────────────────────────────

  /**
   * Get weight dimensions for a specific tree.
   * If ?treeId is provided, returns that tree's own defaultWeights.
   * Otherwise returns an empty array (no more global defaults — weights live on trees).
   */
  router.get("/weights/defaults", async (req: Request, res: Response) => {
    try {
      const treeId = req.query.treeId as string | undefined;
      if (treeId) {
        const tree = await loadTree(treesDir, treeId);
        if (tree?.defaultWeights) {
          res.json(tree.defaultWeights);
          return;
        }
      }
      // No tree-specific weights — return empty (client FALLBACK_WEIGHTS handles this)
      res.json([]);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch weights", details: String(err) });
    }
  });

  /**
   * Get weight profiles for a specific tree.
   * Dynamically generates profiles from the tree's own dimensions.
   */
  router.get("/weights/profiles", async (req: Request, res: Response) => {
    try {
      const treeId = req.query.treeId as string | undefined;
      let dims: WeightDimension[] = [];

      if (treeId) {
        const tree = await loadTree(treesDir, treeId);
        if (tree?.defaultWeights) dims = tree.defaultWeights;
      }

      // Load any user-saved profiles from disk
      const profilesDir = join(treesDir, "profiles");
      await mkdir(profilesDir, { recursive: true });

      const files = await readdir(profilesDir);
      const profiles: WeightProfile[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const content = await readFile(join(profilesDir, file), "utf-8");
          profiles.push(JSON.parse(content));
        }
      }

      // Add dynamically generated profiles from tree dimensions
      if (dims.length > 0) {
        profiles.unshift(
          {
            id: "tree-default",
            name: "Tree Default",
            description: "Author-tuned defaults for this tree",
            dimensions: dims.map((d) => ({ ...d })),
            createdAt: "",
            updatedAt: "",
          },
          {
            id: "balanced",
            name: "Balanced",
            description: "All weights at 50 — no bias in any direction",
            dimensions: dims.map((d) => ({ ...d, value: 50 })),
            createdAt: "",
            updatedAt: "",
          },
          {
            id: "aggressive",
            name: "Aggressive",
            description: "Push all weights high",
            dimensions: dims.map((d) => ({ ...d, value: 80 })),
            createdAt: "",
            updatedAt: "",
          },
          {
            id: "conservative",
            name: "Conservative",
            description: "Pull all weights low",
            dimensions: dims.map((d) => ({ ...d, value: 25 })),
            createdAt: "",
            updatedAt: "",
          }
        );
      }

      res.json(profiles);
    } catch (err) {
      res.status(500).json({ error: "Failed to list profiles", details: String(err) });
    }
  });

  /** Save a weight profile */
  router.post("/weights/profiles", async (req: Request, res: Response) => {
    try {
      const profilesDir = join(treesDir, "profiles");
      await mkdir(profilesDir, { recursive: true });

      const profile: WeightProfile = {
        ...req.body,
        id: req.body.id || uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await writeFile(
        join(profilesDir, `${profile.id}.json`),
        JSON.stringify(profile, null, 2),
        "utf-8"
      );

      res.status(201).json(profile);
    } catch (err) {
      res.status(500).json({ error: "Failed to save profile", details: String(err) });
    }
  });

  // ─── Scaffold File Writer ─────────────────────────────────

  /** Parse code blocks with file annotations from markdown output */
  function parseScaffoldFiles(markdown: string): { path: string; content: string }[] {
    const files: { path: string; content: string }[] = [];
    // Match fenced code blocks: ```lang\n// file: path\n...content...\n```
    const codeBlockRegex = /```[\w]*\n(?:\/\/|#)\s*file:\s*(.+?)\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      const filePath = match[1].trim();
      const content = match[2].trimEnd();
      if (filePath && content) {
        files.push({ path: filePath, content });
      }
    }
    return files;
  }

  /** Save scaffold files to a target directory and optionally open in VS Code */
  router.post("/scaffold/save", async (req: Request, res: Response) => {
    try {
      const { markdown, targetDir, openInVSCode } = req.body;

      if (!markdown || !targetDir) {
        res.status(400).json({ error: "markdown and targetDir are required" });
        return;
      }

      // Resolve and validate the path
      const resolvedDir = resolve(targetDir);

      const files = parseScaffoldFiles(markdown);
      if (files.length === 0) {
        res.status(400).json({ error: "No file annotations found in the output. Code blocks must start with '// file: path' or '# file: path'." });
        return;
      }

      // Write files
      const written: string[] = [];
      for (const file of files) {
        const fullPath = join(resolvedDir, file.path);
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, file.content, "utf-8");
        written.push(file.path);
      }

      // Open in VS Code if requested
      if (openInVSCode) {
        exec(`code "${resolvedDir}"`, (err) => {
          if (err) console.warn("[scaffold] Failed to open VS Code:", err.message);
        });
      }

      res.json({
        success: true,
        targetDir: resolvedDir,
        filesWritten: written,
        fileCount: written.length,
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to save scaffold", details: String(err) });
    }
  });

  return router;
}

// ─── Helpers ────────────────────────────────────────────────

async function loadTree(treesDir: string, id: string): Promise<DecisionTree | null> {
  try {
    const content = await readFile(join(treesDir, `${id}.tree.json`), "utf-8");
    return JSON.parse(content);
  } catch {
    // Also try scanning all files for matching ID
    try {
      const files = await readdir(treesDir);
      for (const file of files) {
        if (!file.endsWith(".tree.json")) continue;
        const content = await readFile(join(treesDir, file), "utf-8");
        const tree = JSON.parse(content);
        if (tree.id === id) return tree;
      }
    } catch { /* ignore */ }
    return null;
  }
}

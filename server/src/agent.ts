/**
 * Copilot SDK Agent Integration
 *
 * Uses the real @github/copilot-sdk CopilotClient to drive
 * conversational tree execution and AI-powered action nodes.
 */

import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type {
  DecisionTree,
  WeightDimension,
  StepResponse,
} from "./types.js";
import { TreeEngine } from "./tree-engine.js";

// ─── Types ──────────────────────────────────────────────────

export interface AuthStatus {
  isAuthenticated: boolean;
  authType?: string;
  login?: string;
  host?: string;
  statusMessage?: string;
}

export interface ModelInfo {
  id: string;
  name?: string;
  capabilities?: Record<string, unknown>;
}

export interface AgentConfig {
  /** Explicit GitHub token — takes priority over logged-in user */
  githubToken?: string;
  /** Use the logged-in user's OAuth / gh CLI credentials (default: true) */
  useLoggedInUser?: boolean;
  /** Which model to use for AI sessions */
  model?: string;
}

// ─── Pipeline Types ─────────────────────────────────────────

export interface PipelineTraceEntry {
  nodeId: string;
  nodeType: string;
  label: string;
  message: string;
  inputUsed?: unknown;
  result?: string;
}

export interface PipelineResult {
  sessionId: string;
  treeId: string;
  treeName: string;
  status: string;
  context: Record<string, unknown>;
  trace: PipelineTraceEntry[];
  finalResult: string | null;
  nodeCount: number;
}

// ─── Agent ──────────────────────────────────────────────────

export class CopilotTreeAgent {
  private engine: TreeEngine;
  private client: CopilotClient | null = null;
  private config: AgentConfig;
  private starting: Promise<void> | null = null;
  /** Stores async SDK results keyed by sessionId */
  private pendingResults: Map<string, { status: "generating" | "done" | "error"; result?: string; error?: string }> = new Map();

  constructor(config: AgentConfig = {}) {
    this.engine = new TreeEngine();
    this.config = {
      useLoggedInUser: true,
      model: "gpt-5.3-codex",
      ...config,
    };
  }

  // ─── SDK Lifecycle ────────────────────────────────────────

  /** Ensure the CopilotClient is started (idempotent). */
  async ensureClient(): Promise<CopilotClient> {
    if (this.client) return this.client;

    // Deduplicate concurrent start calls
    if (!this.starting) {
      this.starting = this._startClient();
    }
    await this.starting;
    return this.client!;
  }

  private async _startClient(): Promise<void> {
    const opts: Record<string, unknown> = {
      autoStart: true,
      autoRestart: true,
    };

    if (this.config.githubToken) {
      opts.githubToken = this.config.githubToken;
      opts.useLoggedInUser = false;
    } else {
      opts.useLoggedInUser = this.config.useLoggedInUser ?? true;
    }

    console.log("[SDK] Starting CopilotClient…", {
      useLoggedInUser: opts.useLoggedInUser,
      hasToken: !!opts.githubToken,
    });

    this.client = new CopilotClient(opts as any);
    await this.client.start();
    console.log("[SDK] CopilotClient started ✓");
  }

  /** Stop the SDK client gracefully. */
  async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = null;
      this.starting = null;
      console.log("[SDK] CopilotClient stopped");
    }
  }

  /** Reconfigure credentials and restart the client. */
  async reconfigure(newConfig: Partial<AgentConfig>): Promise<void> {
    await this.stop();
    this.config = { ...this.config, ...newConfig };
    // Client will be lazily re-created on next call
  }

  // ─── Auth & Models ────────────────────────────────────────

  /** Get current authentication status from the SDK. */
  async getAuthStatus(): Promise<AuthStatus> {
    try {
      const client = await this.ensureClient();
      const status = await client.getAuthStatus();
      return {
        isAuthenticated: status.isAuthenticated,
        authType: status.authType,
        login: status.login,
        host: status.host,
        statusMessage: status.statusMessage,
      };
    } catch (err) {
      return {
        isAuthenticated: false,
        statusMessage: `SDK error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /** List available models. */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const client = await this.ensureClient();
      const models = await client.listModels();
      return models.map((m: any) => ({
        id: m.id ?? m.modelId ?? "unknown",
        name: m.name ?? m.id ?? "unknown",
        capabilities: m.capabilities,
      }));
    } catch (err) {
      console.warn("[SDK] listModels failed:", err);
      return [];
    }
  }

  /** Get current config (safe — no secrets). */
  getConfig(): { useLoggedInUser: boolean; hasToken: boolean; model: string } {
    return {
      useLoggedInUser: this.config.useLoggedInUser ?? true,
      hasToken: !!this.config.githubToken,
      model: this.config.model ?? "gpt-5.3-codex",
    };
  }

  // ─── Tree Execution ───────────────────────────────────────

  async startRun(
    tree: DecisionTree,
    weights?: WeightDimension[],
    initialContext?: Record<string, unknown>
  ): Promise<{ sessionId: string; step: StepResponse; narration: string }> {
    const { sessionId, firstStep } = this.engine.startSession(tree, weights, initialContext);
    const narration = this.generateNarration(tree, firstStep, weights);
    return { sessionId, step: firstStep, narration };
  }

  async advanceRun(
    sessionId: string,
    tree: DecisionTree,
    userValue: unknown
  ): Promise<{ step: StepResponse; narration: string }> {
    const step = this.engine.advance(sessionId, tree, userValue);
    const state = this.engine.getSession(sessionId);
    const narration = await this.generateStepNarration(step, state?.weights);

    // If action node with copilot_prompt type, fire SDK in background
    if (step.result) {
      const node = tree.nodes.find((n) => n.id === step.nodeId);
      if (node?.type === "action" && (node as any).actionType === "copilot_prompt") {
        const templateResult = step.result;
        step.result = undefined; // clear — will arrive via polling
        (step as any).isGenerating = true;

        // Fire SDK call in background
        this.pendingResults.set(sessionId, { status: "generating" });
        this.executeCopilotAction(
          (node as any).systemPrompt ?? "",
          templateResult,
          state?.context ?? {},
          state?.weights
        ).then((aiResult) => {
          this.pendingResults.set(sessionId, { status: "done", result: aiResult });
          // Store result in context for downstream nodes
          if ((node as any).resultVariable && state) {
            state.context[(node as any).resultVariable] = aiResult;
          }
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.pendingResults.set(sessionId, {
            status: "error",
            result: `[Copilot SDK Error: ${msg}]\n\nFallback result:\n${templateResult}`,
          });
        });
      }
    }

    return { step, narration };
  }

  /** Poll for a pending SDK result */
  getPendingResult(sessionId: string): { status: "generating" | "done" | "error"; result?: string } | null {
    const pending = this.pendingResults.get(sessionId);
    if (!pending) return null;
    if (pending.status !== "generating") {
      // Clean up after retrieval
      this.pendingResults.delete(sessionId);
    }
    return pending;
  }

  updateWeights(sessionId: string, weights: WeightDimension[]): void {
    this.engine.updateWeights(sessionId, weights);
  }

  getSession(sessionId: string) {
    return this.engine.getSession(sessionId);
  }

  // ─── Pipeline (Batch) Execution ───────────────────────────

  /**
   * Run a decision tree end-to-end with pre-filled inputs.
   * Returns the full execution trace and final result.
   */
  async runPipeline(
    tree: DecisionTree,
    inputs: Record<string, unknown>,
    weights?: WeightDimension[],
  ): Promise<PipelineResult> {
    const { sessionId, firstStep } = this.engine.startSession(tree, weights);
    const trace: PipelineTraceEntry[] = [];
    let step = firstStep;
    let iterationCount = 0;
    const MAX_ITERATIONS = 100; // safety valve

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;

      // Record this step in the trace
      const node = tree.nodes.find((n) => n.id === step.nodeId);
      const traceEntry: PipelineTraceEntry = {
        nodeId: step.nodeId,
        nodeType: step.nodeType,
        label: node?.label ?? step.nodeId,
        message: step.message,
      };

      // If terminal, handle possible Copilot action then finish
      if (step.isTerminal) {
        if (step.result && node?.type === "action" && (node as any).actionType === "copilot_prompt") {
          try {
            const state = this.engine.getSession(sessionId);
            step.result = await this.executeCopilotAction(
              (node as any).systemPrompt ?? "",
              step.result,
              state?.context ?? {},
              state?.weights
            );
            if ((node as any).resultVariable && state) {
              state.context[(node as any).resultVariable] = step.result;
            }
          } catch { /* use the template-interpolated fallback */ }
        }
        traceEntry.result = step.result;
        trace.push(traceEntry);
        break;
      }

      // Non-terminal action with feedback loop — run Copilot, then use first choice to continue
      if (step.nodeType === "action" && step.result) {
        if (node?.type === "action" && (node as any).actionType === "copilot_prompt") {
          try {
            const state = this.engine.getSession(sessionId);
            step.result = await this.executeCopilotAction(
              (node as any).systemPrompt ?? "",
              step.result,
              state?.context ?? {},
              state?.weights
            );
            if ((node as any).resultVariable && state) {
              state.context[(node as any).resultVariable] = step.result;
            }
          } catch { /* use the template-interpolated fallback */ }
        }
        traceEntry.result = step.result;
        trace.push(traceEntry);
        // For pipeline, auto-select (first choice = positive confirmation)
        const feedbackValue = step.choices?.[0] ?? "__auto__";
        step = this.engine.advance(sessionId, tree, feedbackValue);
        continue;
      }

      // Determine the value to use for this node
      let value: unknown;
      if (step.nodeType === "input") {
        const inputNode = node as any;
        const varName: string = inputNode?.variableName ?? step.nodeId;
        value = inputs[varName];
        if (value === undefined && step.choices?.length) {
          value = step.choices[0]; // default to first choice
        }
        if (value === undefined) {
          value = inputNode?.default ?? "";
        }
        traceEntry.inputUsed = value;
      } else if (step.nodeType === "assumption") {
        const varName = (node as any)?.variableName ?? step.nodeId;
        value = inputs[varName] ?? true; // default: accept assumptions
        traceEntry.inputUsed = value;
      } else if (step.nodeType === "decision") {
        // Decisions auto-resolve via weights + context — provide empty value
        value = "__auto__";
      } else {
        value = "__auto__";
      }

      trace.push(traceEntry);

      // Advance to next node
      try {
        step = this.engine.advance(sessionId, tree, value);
      } catch (err) {
        trace.push({
          nodeId: step.nodeId,
          nodeType: step.nodeType,
          label: "Error",
          message: `Engine error: ${err instanceof Error ? err.message : String(err)}`,
        });
        break;
      }
    }

    const state = this.engine.getSession(sessionId);
    return {
      sessionId,
      treeId: tree.id,
      treeName: tree.name,
      status: state?.status ?? "completed",
      context: state?.context ?? {},
      trace,
      finalResult: trace[trace.length - 1]?.result ?? null,
      nodeCount: trace.length,
    };
  }

  // ─── Private: SDK-Powered Helpers ─────────────────────────

  /**
   * Send a prompt to a Copilot SDK session and return the response.
   * Creates an ephemeral session, sends the message, then destroys it.
   */
  private async sendPrompt(systemMessage: string, userMessage: string): Promise<string> {
    const client = await this.ensureClient();

    const session = await client.createSession({
      model: this.config.model ?? "gpt-5.3-codex",
      systemMessage: { mode: "replace", content: systemMessage },
      onPermissionRequest: approveAll,
    });

    try {
      const response = await session.sendAndWait(
        { prompt: userMessage },
        300_000 // 5 min — SDK defaults to 60s which is too short for large generations
      );
      return response?.data?.content ?? "No response from Copilot";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[SDK] sendAndWait error:", msg);
      throw new Error(`SDK error: ${msg}`);
    } finally {
      await session.destroy().catch(() => {});
    }
  }

  private generateNarration(
    tree: DecisionTree,
    step: StepResponse,
    _weights?: WeightDimension[]
  ): string {
    return `Starting "${tree.name}" — ${tree.description}`;
  }

  private async generateStepNarration(
    step: StepResponse,
    weights?: WeightDimension[]
  ): Promise<string> {
    if (step.weightExplanation) return step.weightExplanation;
    if (step.isTerminal) return "Decision tree complete. Here's the result:";
    return step.message;
  }

  private async executeCopilotAction(
    systemPrompt: string,
    userPrompt: string,
    context: Record<string, unknown>,
    weights?: WeightDimension[]
  ): Promise<string> {
    const contextStr = Object.entries(context)
      .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
      .join("\n");

    const weightStr = weights?.length
      ? "\n\nWeight configuration (0-100 scale, use these to calibrate your response):\n" +
        weights.map((w) => `- ${w.label}: ${w.value}/100 — ${w.description}`).join("\n")
      : "";

    try {
      return await this.sendPrompt(
        `${systemPrompt}\n\nContext gathered from decision tree:\n${contextStr}${weightStr}`,
        userPrompt
      );
    } catch (err) {
      return `[Copilot SDK Error: ${err instanceof Error ? err.message : "Unknown error"}]\n\nFallback result:\n${userPrompt}`;
    }
  }
}

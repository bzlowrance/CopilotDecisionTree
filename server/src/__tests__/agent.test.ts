/**
 * CopilotTreeAgent — Unit tests
 *
 * Tests the agent's tree execution orchestration (startRun, advanceRun,
 * pipeline execution), config management, and pending result handling.
 * The actual Copilot SDK is mocked — only engine logic is tested.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CopilotTreeAgent } from "../agent.js";
import { makeLinearTree, makeFeedbackLoopTree, makeMultiStepTree } from "./fixtures.js";

// Mock the @github/copilot-sdk module
vi.mock("@github/copilot-sdk", () => {
  class MockCopilotClient {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn().mockResolvedValue(undefined);
    getAuthStatus = vi.fn().mockResolvedValue({
      isAuthenticated: true,
      authType: "token",
      login: "testuser",
      host: "github.com",
    });
    listModels = vi.fn().mockResolvedValue([
      { id: "gpt-5.3-codex", name: "GPT 5.3 Codex" },
      { id: "gpt-4o", name: "GPT 4o" },
    ]);
    createSession = vi.fn().mockResolvedValue({
      sendAndWait: vi.fn().mockResolvedValue({
        content: "Mocked AI response",
      }),
      destroy: vi.fn().mockResolvedValue(undefined),
    });
  }
  return {
    CopilotClient: MockCopilotClient,
    approveAll: vi.fn(),
  };
});

describe("CopilotTreeAgent", () => {
  let agent: CopilotTreeAgent;

  beforeEach(() => {
    agent = new CopilotTreeAgent({
      githubToken: "test-token",
      model: "gpt-5.3-codex",
    });
  });

  // ─── Config Management ────────────────────────────────

  describe("getConfig", () => {
    it("should return safe config without secrets", () => {
      const config = agent.getConfig();

      expect(config.hasToken).toBe(true);
      expect(config.model).toBe("gpt-5.3-codex");
      expect(config.useLoggedInUser).toBe(true);
      // Should NOT expose the actual token
      expect((config as any).githubToken).toBeUndefined();
    });

    it("should report hasToken=false when no token", () => {
      const noTokenAgent = new CopilotTreeAgent({ useLoggedInUser: true });
      const config = noTokenAgent.getConfig();

      expect(config.hasToken).toBe(false);
    });
  });

  describe("reconfigure", () => {
    it("should update config values", async () => {
      await agent.reconfigure({ model: "gpt-4o" });
      const config = agent.getConfig();
      expect(config.model).toBe("gpt-4o");
    });
  });

  // ─── Auth & Models ────────────────────────────────────

  describe("getAuthStatus", () => {
    it("should return auth status from SDK", async () => {
      const status = await agent.getAuthStatus();

      expect(status.isAuthenticated).toBe(true);
      expect(status.authType).toBe("token");
      expect(status.login).toBe("testuser");
    });
  });

  describe("listModels", () => {
    it("should return available models", async () => {
      const models = await agent.listModels();

      expect(models.length).toBeGreaterThan(0);
      expect(models[0].id).toBe("gpt-5.3-codex");
    });
  });

  // ─── Tree Execution ───────────────────────────────────

  describe("startRun", () => {
    it("should create a session and return first step with narration", async () => {
      const tree = makeLinearTree();
      const result = await agent.startRun(tree);

      expect(result.sessionId).toBeTruthy();
      expect(result.step).toBeDefined();
      expect(result.step.nodeId).toBe("input1");
      expect(result.narration).toBeDefined();
      expect(typeof result.narration).toBe("string");
    });

    it("should accept custom weights", async () => {
      const tree = makeLinearTree();
      const weights = [{ id: "w1", label: "Test", description: "", value: 80, color: "#F00" }];

      const result = await agent.startRun(tree, weights);
      expect(result.sessionId).toBeTruthy();
    });

    it("should accept initial context", async () => {
      const tree = makeLinearTree();
      const result = await agent.startRun(tree, undefined, { env: "prod" });

      expect(result.sessionId).toBeTruthy();
    });
  });

  describe("advanceRun", () => {
    it("should advance and return narration", async () => {
      const tree = makeLinearTree();
      const { sessionId } = await agent.startRun(tree);

      const result = await agent.advanceRun(sessionId, tree, "TestUser");

      expect(result.step).toBeDefined();
      expect(result.step.nodeId).toBe("action1");
      expect(result.narration).toBeDefined();
    });
  });

  // ─── Pending Results ──────────────────────────────────

  describe("getPendingResult", () => {
    it("should return null for non-existent session", () => {
      const result = agent.getPendingResult("fake-session");
      expect(result).toBeNull();
    });
  });

  // ─── Session & Weight Management ──────────────────────

  describe("getSession", () => {
    it("should return session state", async () => {
      const tree = makeLinearTree();
      const { sessionId } = await agent.startRun(tree);

      const session = agent.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.treeId).toBe("test-linear");
    });

    it("should return undefined for unknown session", () => {
      expect(agent.getSession("unknown")).toBeUndefined();
    });
  });

  describe("updateWeights", () => {
    it("should update weights for active session", async () => {
      const tree = makeLinearTree();
      const { sessionId } = await agent.startRun(tree);

      const newWeights = [{ id: "w1", label: "New", description: "", value: 99, color: "#F00" }];
      agent.updateWeights(sessionId, newWeights);

      const session = agent.getSession(sessionId);
      expect(session!.weights).toEqual(newWeights);
    });
  });

  // ─── Pipeline Execution ───────────────────────────────

  describe("runPipeline", () => {
    it("should execute a linear tree end-to-end", async () => {
      const tree = makeLinearTree();

      const result = await agent.runPipeline(tree, { userName: "PipelineUser" });

      expect(result.treeId).toBe("test-linear");
      expect(result.treeName).toBe("Linear Test");
      expect(result.trace.length).toBeGreaterThan(0);
      expect(result.status).toBe("completed");
    });

    it("should include input values in trace", async () => {
      const tree = makeLinearTree();

      const result = await agent.runPipeline(tree, { userName: "TrackedUser" });

      const inputEntry = result.trace.find((t) => t.nodeType === "input");
      expect(inputEntry).toBeDefined();
      expect(inputEntry!.inputUsed).toBe("TrackedUser");
    });

    it("should use defaults when inputs not provided", async () => {
      const tree = makeLinearTree();

      const result = await agent.runPipeline(tree, {});

      expect(result.trace.length).toBeGreaterThan(0);
      expect(result.status).toBe("completed");
    });

    it("should handle multi-step trees", async () => {
      const tree = makeMultiStepTree();

      const result = await agent.runPipeline(tree, {
        teamSize: 5,
        budget: "Low",
        useCloud: true,
      });

      expect(result.trace.length).toBeGreaterThanOrEqual(3);
      expect(result.status).toBe("completed");
    });

    it("should handle feedback loop trees", async () => {
      const tree = makeFeedbackLoopTree();

      const result = await agent.runPipeline(tree, { symptom: "test issue" });

      expect(result.trace.length).toBeGreaterThan(1);
      expect(result.status).toBe("completed");
    });

    it("should respect custom weights in pipeline", async () => {
      const tree = makeLinearTree();
      const weights = [{ id: "w1", label: "Custom", description: "", value: 80, color: "#F00" }];

      const result = await agent.runPipeline(tree, { userName: "WeightedUser" }, weights);

      expect(result.status).toBe("completed");
    });

    it("should include nodeCount in result", async () => {
      const tree = makeLinearTree();

      const result = await agent.runPipeline(tree, { userName: "Counter" });

      expect(result.nodeCount).toBeGreaterThan(0);
      expect(result.nodeCount).toBe(result.trace.length);
    });
  });
});

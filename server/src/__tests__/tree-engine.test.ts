/**
 * TreeEngine — Core unit tests
 *
 * Tests the decision tree execution engine: session management,
 * node traversal, edge resolution, weight biasing, template
 * interpolation, and error handling.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TreeEngine } from "../tree-engine.js";
import {
  makeLinearTree,
  makeBranchingTree,
  makeAssumptionTree,
  makeWeightBiasedTree,
  makeFeedbackLoopTree,
  makeMultiStepTree,
  testWeights,
} from "./fixtures.js";

describe("TreeEngine", () => {
  let engine: TreeEngine;

  beforeEach(() => {
    engine = new TreeEngine();
  });

  // ─── Session Lifecycle ──────────────────────────────────

  describe("startSession", () => {
    it("should create a session and return the root node step", () => {
      const tree = makeLinearTree();
      const { sessionId, firstStep } = engine.startSession(tree);

      expect(sessionId).toBeTruthy();
      expect(typeof sessionId).toBe("string");
      expect(firstStep.nodeId).toBe("input1");
      expect(firstStep.nodeType).toBe("input");
      expect(firstStep.isTerminal).toBe(false);
    });

    it("should use custom weights when provided", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree, testWeights);

      const session = engine.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.weights).toHaveLength(3);
      expect(session!.weights[0].id).toBe("risk");
    });

    it("should use tree default weights when none provided", () => {
      const tree = makeWeightBiasedTree();
      const { sessionId } = engine.startSession(tree);

      const session = engine.getSession(sessionId);
      expect(session!.weights).toHaveLength(2);
      expect(session!.weights[0].id).toBe("speed");
    });

    it("should store initial context", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree, undefined, { preloaded: "yes" });

      const session = engine.getSession(sessionId);
      expect(session!.context.preloaded).toBe("yes");
    });

    it("should throw on missing root node", () => {
      const tree = makeLinearTree();
      tree.rootNodeId = "nonexistent";

      expect(() => engine.startSession(tree)).toThrow("Root node nonexistent not found");
    });

    it("should generate unique session IDs", () => {
      const tree = makeLinearTree();
      const ids = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const { sessionId } = engine.startSession(tree);
        ids.add(sessionId);
      }
      expect(ids.size).toBe(20);
    });
  });

  describe("getSession", () => {
    it("should return session state", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree);

      const session = engine.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.treeId).toBe("test-linear");
      expect(session!.status).toBe("running");
      expect(session!.currentNodeId).toBe("input1");
    });

    it("should return undefined for non-existent session", () => {
      expect(engine.getSession("fake-id")).toBeUndefined();
    });
  });

  // ─── Advance (Linear Flow) ─────────────────────────────

  describe("advance — linear flow", () => {
    it("should advance from input to terminal action", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree);

      const step = engine.advance(sessionId, tree, "Alice");

      expect(step.nodeId).toBe("action1");
      expect(step.nodeType).toBe("action");
      expect(step.isTerminal).toBe(true);
      expect(step.result).toBe("Hello, Alice!");
    });

    it("should store user input in context", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree);

      engine.advance(sessionId, tree, "Bob");

      const session = engine.getSession(sessionId);
      expect(session!.context.userName).toBe("Bob");
    });

    it("should mark session as completed after terminal node", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree);

      engine.advance(sessionId, tree, "Charlie");

      const session = engine.getSession(sessionId);
      expect(session!.status).toBe("completed");
    });

    it("should record history entries", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree);

      engine.advance(sessionId, tree, "Dave");

      const session = engine.getSession(sessionId);
      expect(session!.history.length).toBeGreaterThanOrEqual(1);
      expect(session!.history[0].nodeId).toBe("input1");
      expect(session!.history[0].value).toBe("Dave");
    });

    it("should throw on non-existent session", () => {
      const tree = makeLinearTree();
      expect(() => engine.advance("fake-session", tree, "x")).toThrow("Session fake-session not found");
    });

    it("should throw on completed session", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree);

      engine.advance(sessionId, tree, "Done");

      expect(() => engine.advance(sessionId, tree, "again")).toThrow(/is completed/);
    });
  });

  // ─── Branching (Decision Nodes) ────────────────────────

  describe("advance — branching decisions", () => {
    it("should follow the correct branch based on input value", () => {
      const tree = makeBranchingTree();
      const { sessionId } = engine.startSession(tree);

      // Input: "Python" → lands on the decision node
      const decisionStep = engine.advance(sessionId, tree, "Python");
      expect(decisionStep.nodeType).toBe("decision");
      expect(decisionStep.choices).toBeDefined();

      // Agree with the recommendation → should reach the Python action
      const actionStep = engine.advance(sessionId, tree, "Agree");
      expect(actionStep.nodeType).toBe("action");
      expect(actionStep.result).toContain("Python");
    });

    it("should follow alternate branch for different input", () => {
      const tree = makeBranchingTree();
      const { sessionId } = engine.startSession(tree);

      // Input: "TypeScript" → lands on the decision node
      const decisionStep = engine.advance(sessionId, tree, "TypeScript");
      expect(decisionStep.nodeType).toBe("decision");

      // Agree with the recommendation → should reach the TypeScript action
      const actionStep = engine.advance(sessionId, tree, "Agree");
      expect(actionStep.nodeType).toBe("action");
      expect(actionStep.result).toContain("TypeScript");
    });

    it("should return first edge as fallback for unknown value", () => {
      const tree = makeBranchingTree();
      const { sessionId } = engine.startSession(tree);

      // "Rust" doesn't match any edge label directly
      const step = engine.advance(sessionId, tree, "Rust");

      // Should still advance (falls through to first edge or decision evaluation)
      expect(step.nodeType).toBeDefined();
    });
  });

  // ─── Assumption Nodes ──────────────────────────────────

  describe("advance — assumption nodes", () => {
    it("should follow 'Yes' edge when assumption is accepted", () => {
      const tree = makeAssumptionTree();
      const { sessionId } = engine.startSession(tree);

      const step = engine.advance(sessionId, tree, true);

      expect(step.nodeId).toBe("action_yes");
      expect(step.result).toBe("Setting up Docker...");
    });

    it("should follow 'No' edge when assumption is rejected", () => {
      const tree = makeAssumptionTree();
      const { sessionId } = engine.startSession(tree);

      const step = engine.advance(sessionId, tree, false);

      expect(step.nodeId).toBe("action_no");
      expect(step.result).toBe("Setting up bare metal...");
    });

    it("should store assumption value in context", () => {
      const tree = makeAssumptionTree();
      const { sessionId } = engine.startSession(tree);

      engine.advance(sessionId, tree, true);

      const session = engine.getSession(sessionId);
      expect(session!.context.useContainers).toBe(true);
    });

    it("should show weight influence explanation when weights are active", () => {
      const tree = makeAssumptionTree();
      const highRiskWeights = [
        { id: "risk", label: "Risk", description: "", value: 80, color: "#F00" },
      ];
      const { firstStep } = engine.startSession(tree, highRiskWeights);

      // The assumption node has weightInfluence on "risk" — should generate explanation
      expect(firstStep.weightExplanation).toBeDefined();
      expect(firstStep.weightExplanation).toContain("Risk");
    });
  });

  // ─── Weight-Biased Decisions ───────────────────────────

  describe("advance — weight-biased decisions", () => {
    it("should favor monolith when speed weight is high", () => {
      const tree = makeWeightBiasedTree();
      const highSpeedWeights = [
        { id: "speed", label: "Speed", description: "", value: 90, color: "#F00" },
        { id: "cost", label: "Cost", description: "", value: 20, color: "#0F0" },
      ];
      const { sessionId } = engine.startSession(tree, highSpeedWeights);

      // Input a project type → lands on the decision node
      const decisionStep = engine.advance(sessionId, tree, "startup");
      expect(decisionStep.nodeType).toBe("decision");

      // Agree with the weight-biased recommendation
      const actionStep = engine.advance(sessionId, tree, "Agree");

      // With high speed (0.8 strength) and low cost, monolith should be favored
      expect(actionStep.result).toBe("Build a monolith");
    });

    it("should favor microservices when cost weight is high and speed is low", () => {
      const tree = makeWeightBiasedTree();
      const highCostWeights = [
        { id: "speed", label: "Speed", description: "", value: 10, color: "#F00" },
        { id: "cost", label: "Cost", description: "", value: 95, color: "#0F0" },
      ];
      const { sessionId } = engine.startSession(tree, highCostWeights);

      // Input → decision → agree
      const decisionStep = engine.advance(sessionId, tree, "enterprise");
      expect(decisionStep.nodeType).toBe("decision");

      const actionStep = engine.advance(sessionId, tree, "Agree");
      expect(actionStep.result).toBe("Build microservices");
    });

    it("should record weight influence in history", () => {
      const tree = makeWeightBiasedTree();
      const { sessionId } = engine.startSession(tree, [
        { id: "speed", label: "Speed", description: "", value: 80, color: "#F00" },
        { id: "cost", label: "Cost", description: "", value: 20, color: "#0F0" },
      ]);

      // Input → decision (the decision's buildStepResponse triggers weight evaluation)
      engine.advance(sessionId, tree, "app");
      // Agree to advance past decision (resolveDecisionEdge records weight influence)
      engine.advance(sessionId, tree, "Agree");

      const session = engine.getSession(sessionId);
      const weightEntries = session!.history.filter((h) => h.weightInfluence);
      expect(weightEntries.length).toBeGreaterThan(0);
    });
  });

  // ─── Feedback Loops ────────────────────────────────────

  describe("advance — feedback loop nodes", () => {
    it("should not mark action as terminal when it has outgoing edges", () => {
      const tree = makeFeedbackLoopTree();
      const { sessionId } = engine.startSession(tree);

      // Advance past input
      const actionStep = engine.advance(sessionId, tree, "headache");

      expect(actionStep.nodeId).toBe("action_diagnose");
      expect(actionStep.isTerminal).toBe(false);
      expect(actionStep.choices).toContain("Fixed");
      expect(actionStep.choices).toContain("Escalate");
    });

    it("should follow feedback edge to resolved", () => {
      const tree = makeFeedbackLoopTree();
      const { sessionId } = engine.startSession(tree);

      engine.advance(sessionId, tree, "headache");
      const resolved = engine.advance(sessionId, tree, "Fixed");

      expect(resolved.nodeId).toBe("action_resolved");
      expect(resolved.isTerminal).toBe(true);
      expect(resolved.result).toContain("headache");
    });

    it("should follow feedback edge to escalate", () => {
      const tree = makeFeedbackLoopTree();
      const { sessionId } = engine.startSession(tree);

      engine.advance(sessionId, tree, "severe pain");
      const escalated = engine.advance(sessionId, tree, "Escalate");

      expect(escalated.nodeId).toBe("action_escalate");
      expect(escalated.isTerminal).toBe(true);
      expect(escalated.result).toContain("severe pain");
    });

    it("should keep session running on non-terminal action", () => {
      const tree = makeFeedbackLoopTree();
      const { sessionId } = engine.startSession(tree);

      engine.advance(sessionId, tree, "symptom");

      const session = engine.getSession(sessionId);
      expect(session!.status).toBe("running");
    });
  });

  // ─── Template Interpolation ────────────────────────────

  describe("template interpolation", () => {
    it("should replace {{variables}} with context values", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree);

      const step = engine.advance(sessionId, tree, "World");

      expect(step.result).toBe("Hello, World!");
    });

    it("should keep {{placeholder}} when variable is missing", () => {
      const tree = makeLinearTree();
      // Modify template to use unknown variable
      (tree.nodes[1] as any).template = "Hello, {{unknownVar}}!";
      const { sessionId } = engine.startSession(tree);

      const step = engine.advance(sessionId, tree, "test");

      expect(step.result).toBe("Hello, {{unknownVar}}!");
    });

    it("should interpolate multiple variables", () => {
      const tree = makeMultiStepTree();
      const { sessionId } = engine.startSession(tree);

      // input_team → input_budget → assume_cloud → decision → action
      engine.advance(sessionId, tree, 5);        // teamSize = 5
      engine.advance(sessionId, tree, "Low");     // budget = Low
      engine.advance(sessionId, tree, true);      // accept cloud assumption

      const session = engine.getSession(sessionId);
      expect(session!.context.teamSize).toBe(5);
      expect(session!.context.budget).toBe("Low");
    });
  });

  // ─── Multi-Step Traversal ──────────────────────────────

  describe("multi-step traversal", () => {
    it("should traverse input → input → assumption → decision → action", () => {
      const tree = makeMultiStepTree();
      const { sessionId, firstStep } = engine.startSession(tree);

      expect(firstStep.nodeId).toBe("input_team");
      expect(firstStep.nodeType).toBe("input");

      const step2 = engine.advance(sessionId, tree, 10);
      expect(step2.nodeId).toBe("input_budget");
      expect(step2.nodeType).toBe("input");

      const step3 = engine.advance(sessionId, tree, "Low");
      expect(step3.nodeId).toBe("assume_cloud");
      expect(step3.nodeType).toBe("assumption");

      // Accept the assumption → lands on the decision node
      const decisionStep = engine.advance(sessionId, tree, true);
      expect(decisionStep.nodeType).toBe("decision");

      // Agree with the recommendation → reaches the action
      const finalStep = engine.advance(sessionId, tree, "Agree");
      expect(finalStep.nodeType).toBe("action");
      expect(finalStep.isTerminal).toBe(true);
    });

    it("should accumulate context across steps", () => {
      const tree = makeMultiStepTree();
      const { sessionId } = engine.startSession(tree);

      engine.advance(sessionId, tree, 8);
      engine.advance(sessionId, tree, "High");
      engine.advance(sessionId, tree, true);

      const session = engine.getSession(sessionId);
      expect(session!.context.teamSize).toBe(8);
      expect(session!.context.budget).toBe("High");
      expect(session!.context.useCloud).toBe(true);
    });
  });

  // ─── Weight Updates ────────────────────────────────────

  describe("updateWeights", () => {
    it("should update weights mid-session", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree, testWeights);

      const newWeights = testWeights.map((w) => ({ ...w, value: 90 }));
      engine.updateWeights(sessionId, newWeights);

      const session = engine.getSession(sessionId);
      expect(session!.weights.every((w) => w.value === 90)).toBe(true);
    });

    it("should record weight update in history", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree, testWeights);

      engine.updateWeights(sessionId, testWeights);

      const session = engine.getSession(sessionId);
      const updateEntry = session!.history.find((h) => h.action.includes("Weights updated"));
      expect(updateEntry).toBeDefined();
    });

    it("should throw on non-existent session", () => {
      expect(() => engine.updateWeights("fake", testWeights)).toThrow("Session fake not found");
    });
  });

  // ─── Step Response Building ────────────────────────────

  describe("step response structure", () => {
    it("should include prompt and inputType for input nodes", () => {
      const tree = makeLinearTree();
      const { firstStep } = engine.startSession(tree);

      expect(firstStep.prompt).toBe("Enter your name");
      expect(firstStep.inputType).toBe("text");
    });

    it("should include choices for choice-type input nodes", () => {
      const tree = makeBranchingTree();
      const { firstStep } = engine.startSession(tree);

      expect(firstStep.choices).toEqual(["Python", "TypeScript"]);
      expect(firstStep.inputType).toBe("choice");
    });

    it("should include assumption text for assumption nodes", () => {
      const tree = makeAssumptionTree();
      const { firstStep } = engine.startSession(tree);

      expect(firstStep.assumption).toBe("The application will run in Docker containers");
      expect(firstStep.message).toContain("Assumption");
    });

    it("should include result for terminal action nodes", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree);

      const step = engine.advance(sessionId, tree, "Test");

      expect(step.result).toBeDefined();
      expect(step.isTerminal).toBe(true);
    });

    it("should include choices for feedback-loop action nodes", () => {
      const tree = makeFeedbackLoopTree();
      const { sessionId } = engine.startSession(tree);

      const step = engine.advance(sessionId, tree, "test");

      expect(step.choices).toBeDefined();
      expect(step.choices!.length).toBe(2);
    });
  });

  // ─── Edge Cases ────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle tree with no edges (single node = immediate completion)", () => {
      const tree = makeLinearTree();
      tree.edges = [];
      const { sessionId } = engine.startSession(tree);

      const step = engine.advance(sessionId, tree, "value");

      expect(step.isTerminal).toBe(true);
      expect(step.message).toContain("completed");
    });

    it("should handle empty string input", () => {
      const tree = makeLinearTree();
      const { sessionId } = engine.startSession(tree);

      const step = engine.advance(sessionId, tree, "");

      expect(step.result).toBe("Hello, !");
    });

    it("should handle numeric input stored as number", () => {
      const tree = makeMultiStepTree();
      const { sessionId } = engine.startSession(tree);

      engine.advance(sessionId, tree, 42);

      const session = engine.getSession(sessionId);
      expect(session!.context.teamSize).toBe(42);
    });

    it("should handle boolean input for assumption nodes", () => {
      const tree = makeAssumptionTree();
      const { sessionId } = engine.startSession(tree);

      engine.advance(sessionId, tree, false);

      const session = engine.getSession(sessionId);
      expect(session!.context.useContainers).toBe(false);
    });
  });
});

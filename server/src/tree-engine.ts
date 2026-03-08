/**
 * Decision Tree Engine
 *
 * Interprets decision trees at runtime, evaluating conditions,
 * applying weight biases, and driving the conversational flow.
 */

import { v4 as uuidv4 } from "uuid";
import type {
  DecisionTree,
  TreeNode,
  TreeEdge,
  TreeRunState,
  WeightDimension,
  StepResponse,
  InputNode,
  AssumptionNode,
  DecisionNode,
  ActionNode,
} from "./types.js";

export class TreeEngine {
  private sessions: Map<string, TreeRunState> = new Map();

  /**
   * Start a new tree run session.
   */
  startSession(
    tree: DecisionTree,
    weights?: WeightDimension[],
    initialContext?: Record<string, unknown>
  ): { sessionId: string; firstStep: StepResponse } {
    const sessionId = uuidv4();

    const state: TreeRunState = {
      treeId: tree.id,
      currentNodeId: tree.rootNodeId,
      context: initialContext ?? {},
      weights: weights ?? tree.defaultWeights ?? [],
      history: [],
      status: "running",
    };

    this.sessions.set(sessionId, state);

    const rootNode = tree.nodes.find((n) => n.id === tree.rootNodeId);
    if (!rootNode) {
      throw new Error(`Root node ${tree.rootNodeId} not found in tree ${tree.id}`);
    }

    const step = this.buildStepResponse(rootNode, state, tree);
    return { sessionId, firstStep: step };
  }

  /**
   * Advance the session with user input. Returns the next step.
   */
  advance(
    sessionId: string,
    tree: DecisionTree,
    userValue: unknown
  ): StepResponse {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error(`Session ${sessionId} not found`);
    if (state.status !== "running") throw new Error(`Session ${sessionId} is ${state.status}`);

    const currentNode = tree.nodes.find((n) => n.id === state.currentNodeId);
    if (!currentNode) throw new Error(`Node ${state.currentNodeId} not found`);

    // Record the interaction
    state.history.push({
      nodeId: currentNode.id,
      action: `User responded to ${currentNode.type} node`,
      value: userValue,
      timestamp: new Date().toISOString(),
    });

    // Store the value in context
    this.storeValue(currentNode, userValue, state);

    // Determine next node
    const nextNodeId = this.resolveNextNode(currentNode, tree, state, userValue);

    if (!nextNodeId) {
      state.status = "completed";
      return {
        nodeId: currentNode.id,
        nodeType: currentNode.type,
        message: "Decision tree completed. No further paths available.",
        isTerminal: true,
      };
    }

    state.currentNodeId = nextNodeId;

    const nextNode = tree.nodes.find((n) => n.id === nextNodeId);
    if (!nextNode) throw new Error(`Next node ${nextNodeId} not found`);

    const step = this.buildStepResponse(nextNode, state, tree);

    // If it's an action node with no outgoing edges (truly terminal), auto-complete.
    // Action nodes with outgoing edges are feedback-loop nodes — keep running.
    if (nextNode.type === "action") {
      const outEdges = tree.edges.filter((e) => e.source === nextNode.id);
      if (outEdges.length === 0) {
        state.status = "completed";
      }
    }

    return step;
  }

  /**
   * Get the current session state (for the weight visualization).
   */
  getSession(sessionId: string): TreeRunState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update weights mid-session (user adjusts the radar chart).
   */
  updateWeights(sessionId: string, weights: WeightDimension[]): void {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error(`Session ${sessionId} not found`);
    state.weights = weights;
    state.history.push({
      nodeId: state.currentNodeId,
      action: "Weights updated by user",
      value: weights.map((w) => ({ id: w.id, value: w.value })),
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private storeValue(node: TreeNode, value: unknown, state: TreeRunState): void {
    switch (node.type) {
      case "input": {
        const inputNode = node as InputNode;
        state.context[inputNode.variableName] = value;
        break;
      }
      case "assumption": {
        const assumptionNode = node as AssumptionNode;
        state.context[assumptionNode.variableName] = value;
        break;
      }
      case "decision": {
        // Store whether user agreed or overrode the recommendation
        state.context.__decisionUserChoice = String(value).startsWith("Agree")
          ? "agree"
          : "override";
        break;
      }
    }
  }

  /**
   * Auto-advance through consecutive decision nodes.
   * Decision nodes evaluate their expression against collected context
   * and route automatically, collecting a trace for the client to display.
   * Stops when hitting a non-decision node (input, action, assumption).
   */
  private autoAdvanceDecisions(
    startNode: TreeNode,
    tree: DecisionTree,
    state: TreeRunState
  ): { node: TreeNode; trace: { nodeId: string; condition: string; result: string }[] } {
    let current = startNode;
    const trace: { nodeId: string; condition: string; result: string }[] = [];

    while (current.type === "decision") {
      const decisionNode = current as DecisionNode;
      const nextId = this.resolveNextNode(current, tree, state, undefined);

      // Figure out which branch label was chosen
      const outEdges = tree.edges.filter((e) => e.source === current.id);
      const chosenEdge = outEdges.find((e) => e.target === nextId);
      const branchLabel = chosenEdge?.label ?? "default";

      trace.push({
        nodeId: current.id,
        condition: decisionNode.condition ?? decisionNode.label,
        result: branchLabel,
      });

      state.history.push({
        nodeId: current.id,
        action: `Decision auto-resolved: "${decisionNode.condition}" → ${branchLabel}`,
        value: branchLabel,
        timestamp: new Date().toISOString(),
      });

      if (!nextId) break;

      const nextNode = tree.nodes.find((n) => n.id === nextId);
      if (!nextNode) break;
      current = nextNode;
      state.currentNodeId = current.id;
    }

    return { node: current, trace };
  }

  private resolveNextNode(
    currentNode: TreeNode,
    tree: DecisionTree,
    state: TreeRunState,
    userValue: unknown
  ): string | null {
    const outEdges = tree.edges.filter((e) => e.source === currentNode.id);

    if (outEdges.length === 0) return null;
    if (outEdges.length === 1) return outEdges[0].target;

    switch (currentNode.type) {
      case "input":
        return this.resolveInputEdge(outEdges, userValue);
      case "assumption":
        return this.resolveAssumptionEdge(outEdges, userValue as boolean);
      case "decision": {
        // Use the user's agree/override choice rather than re-evaluating
        const recommendedEdgeId = state.context.__decisionRecommendedEdge as string | undefined;
        const userChoice = state.context.__decisionUserChoice as string | undefined;

        if (recommendedEdgeId && userChoice) {
          // Clean up transient decision state
          delete state.context.__decisionEvalResult;
          delete state.context.__decisionRecommendedEdge;
          delete state.context.__decisionUserChoice;

          if (userChoice === "agree") {
            const edge = outEdges.find((e) => e.id === recommendedEdgeId);
            if (edge) return edge.target;
          } else {
            // Override — pick the other edge
            const edge = outEdges.find((e) => e.id !== recommendedEdgeId);
            if (edge) return edge.target;
          }
        }

        // Fallback to normal evaluation if no stored recommendation
        return this.resolveDecisionEdge(
          currentNode as DecisionNode,
          outEdges,
          state
        );
      }
      case "action":
        // Feedback-loop edges: match user's choice (e.g. "Not Fixed") to edge label
        return this.resolveInputEdge(outEdges, userValue);
      default:
        return outEdges[0].target;
    }
  }

  private resolveInputEdge(edges: TreeEdge[], value: unknown): string {
    // Try to match edge label with the user's value
    const match = edges.find(
      (e) => e.label?.toLowerCase() === String(value).toLowerCase()
    );
    if (match) return match.target;

    // Try condition-based matching
    const condMatch = edges.find((e) => {
      if (!e.condition) return false;
      return this.evaluateSimpleCondition(e.condition, String(value));
    });
    if (condMatch) return condMatch.target;

    // Fallback: first edge
    return edges[0].target;
  }

  private resolveAssumptionEdge(edges: TreeEdge[], accepted: boolean): string {
    const yesEdge = edges.find(
      (e) =>
        e.label?.toLowerCase() === "yes" ||
        e.label?.toLowerCase() === "accept" ||
        e.label?.toLowerCase() === "true"
    );
    const noEdge = edges.find(
      (e) =>
        e.label?.toLowerCase() === "no" ||
        e.label?.toLowerCase() === "reject" ||
        e.label?.toLowerCase() === "false"
    );

    if (accepted && yesEdge) return yesEdge.target;
    if (!accepted && noEdge) return noEdge.target;
    return edges[0].target;
  }

  /**
   * The key weight-influenced decision logic.
   * When multiple branches exist, weights bias the outcome.
   */
  private resolveDecisionEdge(
    node: DecisionNode,
    edges: TreeEdge[],
    state: TreeRunState
  ): string {
    // First, try to evaluate the expression against context
    const exprResult = this.evaluateExpression(node.evaluateExpression, state.context);

    if (exprResult !== null) {
      const match = edges.find(
        (e) => e.label?.toLowerCase() === String(exprResult).toLowerCase()
      );
      if (match) return match.target;
    }

    // If expression is ambiguous, use weight biasing
    if (node.weightBias && node.weightBias.length > 0 && state.weights.length > 0) {
      const edgeScores = new Map<string, number>();

      // Initialize scores
      for (const edge of edges) {
        edgeScores.set(edge.id, 0);
      }

      // Apply weight biases
      for (const bias of node.weightBias) {
        const weight = state.weights.find((w) => w.id === bias.dimension);
        if (!weight) continue;

        const normalizedValue = weight.value / 100; // 0-1
        const score = normalizedValue * bias.strength;

        const targetEdge = edges.find(
          (e) => e.id === bias.favorsBranch || e.label === bias.favorsBranch
        );
        if (targetEdge) {
          const current = edgeScores.get(targetEdge.id) ?? 0;
          edgeScores.set(targetEdge.id, current + score);

          // Record the weight influence
          state.history.push({
            nodeId: node.id,
            action: `Weight "${weight.label}" (${weight.value}) biased toward "${targetEdge.label}"`,
            weightInfluence: weight.id,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Pick the highest scoring edge
      let bestEdge = edges[0];
      let bestScore = -1;
      for (const edge of edges) {
        const score = edgeScores.get(edge.id) ?? 0;
        if (score > bestScore) {
          bestScore = score;
          bestEdge = edge;
        }
      }

      return bestEdge.target;
    }

    // Fallback
    return edges[0].target;
  }

  private evaluateExpression(
    expression: string,
    context: Record<string, unknown>
  ): string | null {
    try {
      // Simple variable lookup: "{{variableName}}"
      const varMatch = expression.match(/^\{\{(\w+)\}\}$/);
      if (varMatch) {
        const val = context[varMatch[1]];
        return val !== undefined ? String(val) : null;
      }

      // Simple comparison: "{{var}} == 'value'"
      const compMatch = expression.match(
        /^\{\{(\w+)\}\}\s*(==|!=|>|<|>=|<=)\s*['"]?(.+?)['"]?$/
      );
      if (compMatch) {
        const val = context[compMatch[1]];
        if (val === undefined) return null;
        const op = compMatch[2];
        const target = compMatch[3];

        switch (op) {
          case "==":
            return String(val) === target ? "true" : "false";
          case "!=":
            return String(val) !== target ? "true" : "false";
          case ">":
            return Number(val) > Number(target) ? "true" : "false";
          case "<":
            return Number(val) < Number(target) ? "true" : "false";
          default:
            return null;
        }
      }

      // Rich expression evaluation (ternary, logical operators, etc.)
      // Only variable names found in context are allowed — no globals, no side effects.
      const contextKeys = Object.keys(context).filter((k) => /^\w+$/.test(k));
      if (contextKeys.length > 0) {
        const contextValues = contextKeys.map((k) => context[k]);
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const fn = new Function(...contextKeys, `"use strict"; return (${expression});`);
        const result = fn(...contextValues);
        return result !== undefined && result !== null ? String(result) : null;
      }

      return null;
    } catch {
      return null;
    }
  }

  private evaluateSimpleCondition(condition: string, value: string): boolean {
    try {
      if (condition.startsWith("contains:")) {
        return value.toLowerCase().includes(condition.slice(9).trim().toLowerCase());
      }
      if (condition.startsWith("equals:")) {
        return value.toLowerCase() === condition.slice(7).trim().toLowerCase();
      }
      if (condition.startsWith("matches:")) {
        return new RegExp(condition.slice(8).trim(), "i").test(value);
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Build the response object for a given node.
   * Includes weight influence explanations when relevant.
   */
  private buildStepResponse(node: TreeNode, state: TreeRunState, tree: DecisionTree): StepResponse {
    const base: StepResponse = {
      nodeId: node.id,
      nodeType: node.type,
      message: node.description ?? node.label,
      isTerminal: false,
    };

    switch (node.type) {
      case "input": {
        const inputNode = node as InputNode;
        base.prompt = inputNode.prompt;
        base.message = inputNode.prompt;
        base.inputType = inputNode.inputType;
        if (inputNode.choices) {
          base.choices = inputNode.choices;
        }
        break;
      }
      case "assumption": {
        const assumptionNode = node as AssumptionNode;
        base.assumption = assumptionNode.assumption;
        base.message = `🟨 Assumption: ${assumptionNode.assumption}`;

        // Check if weights influence this assumption
        if (assumptionNode.weightInfluence && state.weights.length > 0) {
          const influences: string[] = [];
          for (const wi of assumptionNode.weightInfluence) {
            const weight = state.weights.find((w) => w.id === wi.dimension);
            if (weight) {
              const hint =
                weight.value > 60
                  ? `${weight.icon ?? ""} ${weight.label} is high (${weight.value}) — biases toward ${wi.direction}ing`
                  : weight.value < 40
                    ? `${weight.icon ?? ""} ${weight.label} is low (${weight.value}) — biases toward ${wi.direction === "accept" ? "reject" : "accept"}ing`
                    : null;
              if (hint) influences.push(hint);
            }
          }
          if (influences.length > 0) {
            base.weightExplanation = influences.join("\n");
          }
        }
        break;
      }
      case "decision": {
        const decisionNode = node as DecisionNode;
        const outEdges = tree.edges.filter((e) => e.source === node.id);

        // Evaluate the expression to determine the recommended branch
        const evalResult = this.evaluateExpression(
          decisionNode.evaluateExpression,
          state.context
        );

        if (evalResult !== null && outEdges.length >= 2) {
          const matchedEdge = outEdges.find(
            (e) => e.label?.toLowerCase() === evalResult.toLowerCase()
          );
          const otherEdge = outEdges.find((e) => e.id !== matchedEdge?.id);

          if (matchedEdge) {
            // Store the evaluation so advance() knows which branch was recommended
            state.context.__decisionEvalResult = evalResult;
            state.context.__decisionRecommendedEdge = matchedEdge.id;

            const recommendedTarget = tree.nodes.find((n) => n.id === matchedEdge.target);
            const otherTarget = otherEdge
              ? tree.nodes.find((n) => n.id === otherEdge.target)
              : null;

            // Build a reasoning message
            const reasoning = decisionNode.description ?? decisionNode.condition;
            base.message =
              `🟩 **Decision: ${decisionNode.condition}**\n\n` +
              `${reasoning}\n\n` +
              `**Recommendation → ${matchedEdge.label?.toUpperCase()}** — ` +
              `proceed to *${recommendedTarget?.label ?? matchedEdge.target}*`;

            // Present agree / override as choices
            const agreeLabel = `Agree — ${matchedEdge.label}: ${recommendedTarget?.label ?? "continue"}`;
            const overrideLabel = otherTarget
              ? `Override — ${otherEdge!.label}: ${otherTarget.label}`
              : "Override";

            base.choices = [agreeLabel, overrideLabel];
          } else {
            // Expression returned a value but no matching edge — show info only
            base.message = `🟩 Decision: ${decisionNode.condition}\n\nEvaluated: ${evalResult}`;
          }
        } else {
          // Expression couldn't be evaluated (missing context) — fallback info
          base.message = `🟩 Decision: ${decisionNode.condition}`;
          // Present raw edge labels as choices so user can pick
          if (outEdges.length >= 2) {
            base.choices = outEdges
              .map((e) => e.label)
              .filter((l): l is string => !!l);
          }
        }
        break;
      }
      case "action": {
        const actionNode = node as ActionNode;
        const outEdges = tree.edges.filter((e) => e.source === node.id);
        base.message = `🟥 Action: ${actionNode.label}`;
        base.result = this.interpolateTemplate(actionNode.template, state.context);

        if (outEdges.length > 0) {
          // Feedback-loop action: present outgoing edge labels as choices
          base.isTerminal = false;
          base.choices = outEdges
            .map((e) => e.label)
            .filter((l): l is string => !!l);
        } else {
          // Truly terminal action
          base.isTerminal = true;
        }
        break;
      }
    }

    return base;
  }

  /**
   * Replace {{variable}} placeholders in templates with context values.
   */
  private interpolateTemplate(
    template: string,
    context: Record<string, unknown>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const val = context[key];
      return val !== undefined ? String(val) : match;
    });
  }
}

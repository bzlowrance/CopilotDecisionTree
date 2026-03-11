/**
 * Test fixtures — reusable tree structures for server tests.
 */

import type {
  DecisionTree,
  InputNode,
  AssumptionNode,
  DecisionNode,
  ActionNode,
  WeightDimension,
} from "../types.js";

// ─── Weight Dimensions ──────────────────────────────────────

export const testWeights: WeightDimension[] = [
  { id: "risk", label: "Risk", description: "Risk tolerance", value: 50, color: "#FF0000", icon: "⚡" },
  { id: "cost", label: "Cost", description: "Cost sensitivity", value: 50, color: "#00FF00", icon: "💰" },
  { id: "speed", label: "Speed", description: "Speed vs quality", value: 50, color: "#0000FF", icon: "⏱️" },
];

// ─── Simple Linear Tree (input → action) ────────────────────

export function makeLinearTree(): DecisionTree {
  const inputNode: InputNode = {
    id: "input1",
    type: "input",
    label: "What is your name?",
    prompt: "Enter your name",
    variableName: "userName",
    inputType: "text",
    position: { x: 0, y: 0 },
  };

  const actionNode: ActionNode = {
    id: "action1",
    type: "action",
    label: "Greet User",
    actionType: "respond",
    template: "Hello, {{userName}}!",
    position: { x: 200, y: 0 },
  };

  return {
    id: "test-linear",
    name: "Linear Test",
    description: "Simple input → action",
    version: "1.0.0",
    rootNodeId: "input1",
    nodes: [inputNode, actionNode],
    edges: [{ id: "e1", source: "input1", target: "action1" }],
    tags: ["test"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

// ─── Branching Tree (input → decision → action1 | action2) ──

export function makeBranchingTree(): DecisionTree {
  const inputNode: InputNode = {
    id: "input_lang",
    type: "input",
    label: "Language",
    prompt: "Pick a language",
    variableName: "language",
    inputType: "choice",
    choices: ["Python", "TypeScript"],
    position: { x: 0, y: 0 },
  };

  const decisionNode: DecisionNode = {
    id: "decision1",
    type: "decision",
    label: "Which language?",
    condition: "Evaluate language choice",
    evaluateExpression: "{{language}}",
    position: { x: 200, y: 0 },
  };

  const actionPython: ActionNode = {
    id: "action_python",
    type: "action",
    label: "Python Result",
    actionType: "respond",
    template: "Use Python with FastAPI for {{language}}",
    position: { x: 400, y: -100 },
  };

  const actionTS: ActionNode = {
    id: "action_ts",
    type: "action",
    label: "TypeScript Result",
    actionType: "respond",
    template: "Use TypeScript with Express for {{language}}",
    position: { x: 400, y: 100 },
  };

  return {
    id: "test-branching",
    name: "Branching Test",
    description: "Input → decision → two actions",
    version: "1.0.0",
    rootNodeId: "input_lang",
    nodes: [inputNode, decisionNode, actionPython, actionTS],
    edges: [
      { id: "e1", source: "input_lang", target: "decision1" },
      { id: "e_py", source: "decision1", target: "action_python", label: "Python" },
      { id: "e_ts", source: "decision1", target: "action_ts", label: "TypeScript" },
    ],
    tags: ["test"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

// ─── Assumption Tree ────────────────────────────────────────

export function makeAssumptionTree(): DecisionTree {
  const assumptionNode: AssumptionNode = {
    id: "assume1",
    type: "assumption",
    label: "Assume containerized",
    assumption: "The application will run in Docker containers",
    variableName: "useContainers",
    default: true,
    weightInfluence: [
      { dimension: "risk", direction: "accept", strength: 0.6 },
    ],
    position: { x: 0, y: 0 },
  };

  const actionYes: ActionNode = {
    id: "action_yes",
    type: "action",
    label: "Docker setup",
    actionType: "respond",
    template: "Setting up Docker...",
    position: { x: 200, y: -50 },
  };

  const actionNo: ActionNode = {
    id: "action_no",
    type: "action",
    label: "Bare metal",
    actionType: "respond",
    template: "Setting up bare metal...",
    position: { x: 200, y: 50 },
  };

  return {
    id: "test-assumption",
    name: "Assumption Test",
    description: "Tests assumption node branching",
    version: "1.0.0",
    rootNodeId: "assume1",
    nodes: [assumptionNode, actionYes, actionNo],
    edges: [
      { id: "e_yes", source: "assume1", target: "action_yes", label: "Yes" },
      { id: "e_no", source: "assume1", target: "action_no", label: "No" },
    ],
    tags: ["test"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

// ─── Weight-biased Decision Tree ────────────────────────────

export function makeWeightBiasedTree(): DecisionTree {
  const inputNode: InputNode = {
    id: "input1",
    type: "input",
    label: "Project type",
    prompt: "What kind of project?",
    variableName: "projectType",
    inputType: "text",
    position: { x: 0, y: 0 },
  };

  const decisionNode: DecisionNode = {
    id: "weighted_decision",
    type: "decision",
    label: "Architecture",
    condition: "Choose architecture based on weights",
    evaluateExpression: "{{nonExistentVar}}",  // Will fail → fall through to weight bias
    weightBias: [
      { dimension: "speed", favorsBranch: "e_mono", strength: 0.8 },
      { dimension: "cost", favorsBranch: "e_micro", strength: 0.7 },
    ],
    position: { x: 200, y: 0 },
  };

  const actionMono: ActionNode = {
    id: "action_mono",
    type: "action",
    label: "Monolith",
    actionType: "respond",
    template: "Build a monolith",
    position: { x: 400, y: -50 },
  };

  const actionMicro: ActionNode = {
    id: "action_micro",
    type: "action",
    label: "Microservices",
    actionType: "respond",
    template: "Build microservices",
    position: { x: 400, y: 50 },
  };

  return {
    id: "test-weighted",
    name: "Weight Biased Test",
    description: "Decision influenced by weight dimensions",
    version: "1.0.0",
    rootNodeId: "input1",
    defaultWeights: [
      { id: "speed", label: "Speed", description: "", value: 50, color: "#F00" },
      { id: "cost", label: "Cost", description: "", value: 50, color: "#0F0" },
    ],
    nodes: [inputNode, decisionNode, actionMono, actionMicro],
    edges: [
      { id: "e_in", source: "input1", target: "weighted_decision" },
      { id: "e_mono", source: "weighted_decision", target: "action_mono", label: "Monolith" },
      { id: "e_micro", source: "weighted_decision", target: "action_micro", label: "Microservices" },
    ],
    tags: ["test"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

// ─── Feedback Loop Tree (action with outgoing edges) ────────

export function makeFeedbackLoopTree(): DecisionTree {
  const inputNode: InputNode = {
    id: "input_symptom",
    type: "input",
    label: "Symptom",
    prompt: "Describe the symptom",
    variableName: "symptom",
    inputType: "text",
    position: { x: 0, y: 0 },
  };

  const actionDiagnose: ActionNode = {
    id: "action_diagnose",
    type: "action",
    label: "Initial diagnosis",
    actionType: "respond",
    template: "Diagnosing: {{symptom}}",
    position: { x: 200, y: 0 },
  };

  const actionResolved: ActionNode = {
    id: "action_resolved",
    type: "action",
    label: "Resolved",
    actionType: "respond",
    template: "Issue resolved for {{symptom}}",
    position: { x: 400, y: -50 },
  };

  const actionEscalate: ActionNode = {
    id: "action_escalate",
    type: "action",
    label: "Escalate",
    actionType: "respond",
    template: "Escalating {{symptom}} to specialist",
    position: { x: 400, y: 50 },
  };

  return {
    id: "test-feedback",
    name: "Feedback Loop Test",
    description: "Action node with outgoing feedback edges",
    version: "1.0.0",
    rootNodeId: "input_symptom",
    nodes: [inputNode, actionDiagnose, actionResolved, actionEscalate],
    edges: [
      { id: "e1", source: "input_symptom", target: "action_diagnose" },
      { id: "e_fixed", source: "action_diagnose", target: "action_resolved", label: "Fixed" },
      { id: "e_escalate", source: "action_diagnose", target: "action_escalate", label: "Escalate" },
    ],
    tags: ["test"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

// ─── Multi-Step Tree (input → assumption → decision → action) ─

export function makeMultiStepTree(): DecisionTree {
  const input1: InputNode = {
    id: "input_team",
    type: "input",
    label: "Team size",
    prompt: "How many developers?",
    variableName: "teamSize",
    inputType: "number",
    position: { x: 0, y: 0 },
  };

  const input2: InputNode = {
    id: "input_budget",
    type: "input",
    label: "Budget",
    prompt: "What is your monthly budget?",
    variableName: "budget",
    inputType: "choice",
    choices: ["Low", "Medium", "High"],
    position: { x: 200, y: 0 },
  };

  const assumption: AssumptionNode = {
    id: "assume_cloud",
    type: "assumption",
    label: "Cloud deployment",
    assumption: "We will deploy to the cloud",
    variableName: "useCloud",
    default: true,
    position: { x: 400, y: 0 },
  };

  const decision: DecisionNode = {
    id: "decide_platform",
    type: "decision",
    label: "Platform",
    condition: "Choose cloud platform",
    evaluateExpression: "{{budget}}",
    position: { x: 600, y: 0 },
  };

  const actionAWS: ActionNode = {
    id: "action_aws",
    type: "action",
    label: "AWS",
    actionType: "respond",
    template: "Deploy team of {{teamSize}} to AWS (budget: {{budget}})",
    position: { x: 800, y: -50 },
  };

  const actionAzure: ActionNode = {
    id: "action_azure",
    type: "action",
    label: "Azure",
    actionType: "respond",
    template: "Deploy team of {{teamSize}} to Azure (budget: {{budget}})",
    position: { x: 800, y: 50 },
  };

  return {
    id: "test-multistep",
    name: "Multi-Step Test",
    description: "Full flow: input → input → assumption → decision → action",
    version: "1.0.0",
    rootNodeId: "input_team",
    nodes: [input1, input2, assumption, decision, actionAWS, actionAzure],
    edges: [
      { id: "e1", source: "input_team", target: "input_budget" },
      { id: "e2", source: "input_budget", target: "assume_cloud" },
      { id: "e3", source: "assume_cloud", target: "decide_platform", label: "Yes" },
      { id: "e_low", source: "decide_platform", target: "action_aws", label: "Low" },
      { id: "e_high", source: "decide_platform", target: "action_azure", label: "High" },
    ],
    tags: ["test"],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

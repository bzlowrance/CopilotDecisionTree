/**
 * Copilot Decision Tree — Core Types
 *
 * These types define the structure of decision trees, nodes,
 * and the Westworld-inspired decision weight system.
 */

// ─── Node Types ──────────────────────────────────────────────

export type NodeType = "input" | "assumption" | "decision" | "action";

export interface Position {
  x: number;
  y: number;
}

export interface BaseNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  position: Position;
}

/** Gathers data from the user */
export interface InputNode extends BaseNode {
  type: "input";
  prompt: string; // Question to ask the user
  variableName: string; // Key to store the answer under
  inputType: "text" | "choice" | "multiselect" | "number" | "boolean" | "image";
  choices?: string[]; // For choice / multiselect type
  default?: string;
}

/** States an explicit assumption — user can confirm or override */
export interface AssumptionNode extends BaseNode {
  type: "assumption";
  assumption: string; // The assumption being made
  variableName: string;
  default: boolean; // Default: assumed true
  /** Which weight dimensions bias toward accepting/rejecting this assumption */
  weightInfluence?: {
    dimension: string; // e.g. "riskTolerance"
    direction: "accept" | "reject"; // high value biases toward accept or reject
    strength: number; // 0-1 how strongly this weight matters
  }[];
}

/** Branches based on a condition — can be influenced by weights */
export interface DecisionNode extends BaseNode {
  type: "decision";
  condition: string; // Human-readable condition
  /** The variable or expression to evaluate */
  evaluateExpression: string;
  /** Weight-based biasing: when expression is ambiguous, weights tip the scale */
  weightBias?: {
    dimension: string;
    favorsBranch: string; // edge ID or label this weight favors
    strength: number; // 0-1
  }[];
}

/** Terminal action — what to do at the end of a path */
export interface ActionNode extends BaseNode {
  type: "action";
  actionType: "generate" | "respond" | "api_call" | "copilot_prompt";
  /** Template string — variables are interpolated from collected context */
  template: string;
  /** For copilot_prompt: the system prompt to send to Copilot SDK */
  systemPrompt?: string;
  /** If set, the SDK result is stored in context under this key for downstream nodes */
  resultVariable?: string;
}

export type TreeNode = InputNode | AssumptionNode | DecisionNode | ActionNode;

// ─── Edges ───────────────────────────────────────────────────

export interface TreeEdge {
  id: string;
  source: string; // Node ID
  target: string; // Node ID
  label?: string; // e.g. "Yes", "No", "Python", "TypeScript"
  condition?: string; // Expression that must be true to follow this edge
}

// ─── Westworld Decision Weights ──────────────────────────────

/**
 * A single dimension on the radar chart.
 * Inspired by the Westworld "attribute tablet" interface.
 * Each dimension has a value 0–100 that influences how the AI
 * traverses ambiguous decision points.
 */
export interface WeightDimension {
  id: string;
  label: string;
  description: string;
  value: number; // 0–100, default 50
  color: string; // Hex color for the radar chart segment
  icon?: string; // Optional emoji/icon
}

/**
 * A complete weight profile — a named set of dimension values.
 * Users can save/load profiles (e.g., "Conservative", "Move Fast").
 */
export interface WeightProfile {
  id: string;
  name: string;
  description: string;
  dimensions: WeightDimension[];
  createdAt: string;
  updatedAt: string;
}

/** Default weight dimensions — the "personality attributes" of the AI */
export const DEFAULT_WEIGHT_DIMENSIONS: WeightDimension[] = [
  {
    id: "riskTolerance",
    label: "Risk Tolerance",
    description: "How much risk is acceptable — low favors conservative choices, high favors bold moves",
    value: 50,
    color: "#FF6B6B",
    icon: "⚡",
  },
  {
    id: "costSensitivity",
    label: "Cost Sensitivity",
    description: "How much cost matters — high favors cheaper options, low allows premium solutions",
    value: 50,
    color: "#4ECDC4",
    icon: "💰",
  },
  {
    id: "innovation",
    label: "Innovation",
    description: "Preference for cutting-edge vs proven — high favors new tech, low favors battle-tested",
    value: 50,
    color: "#45B7D1",
    icon: "🚀",
  },
  {
    id: "complexity",
    label: "Complexity Tolerance",
    description: "Acceptable complexity level — high allows complex architectures, low favors simplicity",
    value: 50,
    color: "#96CEB4",
    icon: "🧩",
  },
  {
    id: "speed",
    label: "Speed vs Quality",
    description: "Ship fast vs do it right — high favors speed, low favors thoroughness",
    value: 50,
    color: "#FFEAA7",
    icon: "⏱️",
  },
  {
    id: "autonomy",
    label: "AI Autonomy",
    description: "How much the AI decides on its own — high means fewer confirmations, low means ask everything",
    value: 50,
    color: "#DDA0DD",
    icon: "🤖",
  },
  {
    id: "security",
    label: "Security Priority",
    description: "How much to prioritize security — high adds extra checks/hardening, low accepts standard practices",
    value: 50,
    color: "#F0E68C",
    icon: "🔒",
  },
  {
    id: "scalability",
    label: "Scalability Focus",
    description: "How much to optimize for scale — high designs for growth, low designs for current needs",
    value: 50,
    color: "#87CEEB",
    icon: "📈",
  },
];

// ─── Decision Tree ───────────────────────────────────────────

export interface DecisionTree {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: TreeNode[];
  edges: TreeEdge[];
  /** The entry node ID */
  rootNodeId: string;
  /** Default weight profile for this tree */
  defaultWeights?: WeightDimension[];
  /** True when user has manually arranged nodes and saved the layout */
  customLayout?: boolean;
  /** Tags for organization */
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Runtime State ───────────────────────────────────────────

export interface TreeRunState {
  treeId: string;
  currentNodeId: string;
  /** Collected variable values from input/assumption nodes */
  context: Record<string, unknown>;
  /** Active weight profile during this run */
  weights: WeightDimension[];
  /** History of nodes visited and decisions made */
  history: {
    nodeId: string;
    action: string;
    value?: unknown;
    weightInfluence?: string; // Which weight tipped the decision, if any
    timestamp: string;
  }[];
  status: "running" | "completed" | "paused";
}

// ─── API Types ───────────────────────────────────────────────

export interface RunTreeRequest {
  treeId: string;
  weights?: WeightDimension[];
  initialContext?: Record<string, unknown>;
}

export interface StepResponse {
  nodeId: string;
  nodeType: NodeType;
  message: string;
  /** For input nodes: the question to answer */
  prompt?: string;
  choices?: string[];
  /** For input nodes: the kind of input widget to render */
  inputType?: "text" | "choice" | "multiselect" | "number" | "boolean" | "image";
  /** For assumption nodes: the assumption to confirm */
  assumption?: string;
  /** Weight influence explanation */
  weightExplanation?: string;
  /** Is this the final node? */
  isTerminal: boolean;
  /** For action nodes: the generated result */
  result?: string;
  /** True when result is being generated asynchronously */
  isGenerating?: boolean;
  /** Auto-resolved decision nodes traversed to reach this step */
  decisionTrace?: { nodeId: string; condition: string; result: string }[];
}

export interface StepInput {
  sessionId: string;
  value: unknown;
}

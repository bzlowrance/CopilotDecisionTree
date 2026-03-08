/**
 * Shared types — mirrors the server types for the frontend.
 */

export type NodeType = "input" | "assumption" | "decision" | "action";

// ─── Auth ───────────────────────────────────────────────────

export interface AuthStatus {
  isAuthenticated: boolean;
  authType?: string;
  login?: string;
  host?: string;
  statusMessage?: string;
  config: {
    useLoggedInUser: boolean;
    hasToken: boolean;
    model: string;
  };
}

export interface ModelInfo {
  id: string;
  name?: string;
  capabilities?: Record<string, unknown>;
}

// ─── Weights ────────────────────────────────────────────────

export interface WeightDimension {
  id: string;
  label: string;
  description?: string;
  value: number;
  color: string;
  icon?: string;
}

export interface WeightProfile {
  id: string;
  name: string;
  description: string;
  dimensions: WeightDimension[];
  createdAt: string;
  updatedAt: string;
}

export interface TreeNodeData {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  position: { x: number; y: number };
  // Input-specific
  prompt?: string;
  variableName?: string;
  inputType?: "text" | "choice" | "multiselect" | "number" | "boolean" | "image";
  choices?: string[];
  default?: string | boolean;
  // Assumption-specific
  assumption?: string;
  weightInfluence?: {
    dimension: string;
    direction: "accept" | "reject";
    strength: number;
  }[];
  // Decision-specific
  condition?: string;
  evaluateExpression?: string;
  weightBias?: {
    dimension: string;
    favorsBranch: string;
    strength: number;
  }[];
  // Action-specific
  actionType?: "generate" | "respond" | "api_call" | "copilot_prompt";
  template?: string;
  systemPrompt?: string;
  resultVariable?: string;
}

export interface TreeEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface DecisionTree {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: TreeNodeData[];
  edges: TreeEdgeData[];
  rootNodeId: string;
  defaultWeights?: WeightDimension[];
  /** True when user has manually arranged nodes and saved the layout */
  customLayout?: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StepResponse {
  nodeId: string;
  nodeType: NodeType;
  message: string;
  prompt?: string;
  choices?: string[];
  inputType?: "text" | "choice" | "multiselect" | "number" | "boolean" | "image";
  assumption?: string;
  weightExplanation?: string;
  isTerminal: boolean;
  result?: string;
  isGenerating?: boolean;
  decisionTrace?: { nodeId: string; condition: string; result: string }[];
}

// ─── Pipeline ───────────────────────────────────────────────

export interface PipelineField {
  variableName: string;
  label: string;
  prompt: string;
  inputType: "text" | "choice" | "multiselect" | "number" | "boolean" | "image";
  choices: string[] | null;
  default: unknown;
  nodeId: string;
  required: boolean;
}

export interface PipelineSchema {
  treeId: string;
  treeName: string;
  description: string;
  fieldCount: number;
  fields: PipelineField[];
}

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

export interface SessionState {
  treeId: string;
  currentNodeId: string;
  context: Record<string, unknown>;
  weights: WeightDimension[];
  history: {
    nodeId: string;
    action: string;
    value?: unknown;
    weightInfluence?: string;
    timestamp: string;
  }[];
  status: "running" | "completed" | "paused";
}

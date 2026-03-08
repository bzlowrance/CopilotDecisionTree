/**
 * weight-utils.ts — Single source of truth for weight helpers.
 *
 * FALLBACK_WEIGHTS:  generic placeholders used only when a tree has no
 *                    `defaultWeights` of its own (new / empty trees).
 *
 * buildProfiles():   derives dynamic weight profiles from whatever
 *                    dimensions the tree defines.
 *
 * Both TreeRunner and PipelineRunner import from here — no duplication.
 */

import type { WeightDimension, WeightProfile } from "./types";

// ─── Default Color Palette for New Dimensions ───────────────

export const WEIGHT_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#F0E68C", "#87CEEB",
  "#FFA07A", "#98D8C8", "#C3B1E1", "#FFD700",
];

export const WEIGHT_ICONS = [
  "⚡", "💰", "🚀", "🧩", "⏱️", "🤖", "🔒", "📈",
  "🎯", "🔥", "💎", "🛡️", "⚖️", "🌐", "📊", "🔑",
];

// ─── Fallback Weights (generic placeholders) ────────────────

export const FALLBACK_WEIGHTS: WeightDimension[] = [
  { id: "priority", label: "Priority", value: 50, color: "#FF6B6B", icon: "⚡" },
  { id: "cost", label: "Cost Sensitivity", value: 50, color: "#4ECDC4", icon: "💰" },
  { id: "innovation", label: "Innovation", value: 50, color: "#45B7D1", icon: "🚀" },
  { id: "complexity", label: "Complexity", value: 50, color: "#96CEB4", icon: "🧩" },
  { id: "speed", label: "Speed", value: 50, color: "#FFEAA7", icon: "⏱️" },
  { id: "automation", label: "Automation", value: 50, color: "#DDA0DD", icon: "🤖" },
  { id: "security", label: "Security", value: 50, color: "#F0E68C", icon: "🔒" },
  { id: "scalability", label: "Scalability", value: 50, color: "#87CEEB", icon: "📈" },
];

// ─── Build Profiles Dynamically ─────────────────────────────

/**
 * Creates a set of weight profiles from the tree's own dimensions.
 * Each profile adjusts all dimension values uniformly.
 */
export function buildProfiles(dims: WeightDimension[]): WeightProfile[] {
  return [
    {
      id: "tree-default",
      name: "Tree Default",
      description: "Author-tuned defaults",
      dimensions: dims.map((d) => ({ ...d })),
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "balanced",
      name: "Balanced",
      description: "All weights at 50",
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
    },
  ];
}

/**
 * Resolve the effective weight dimensions for a tree.
 * This is THE canonical way to get a tree's weights.
 */
export function getTreeWeights(tree: { defaultWeights?: WeightDimension[] }): WeightDimension[] {
  return tree.defaultWeights && tree.defaultWeights.length > 0
    ? tree.defaultWeights
    : FALLBACK_WEIGHTS;
}

/**
 * Generate a unique dimension ID from a label.
 */
export function labelToId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Create a new blank weight dimension with sensible defaults.
 */
export function createWeightDimension(
  existingDims: WeightDimension[],
  overrides?: Partial<WeightDimension>
): WeightDimension {
  const idx = existingDims.length;
  return {
    id: overrides?.id ?? `dim_${Date.now()}`,
    label: overrides?.label ?? `Dimension ${idx + 1}`,
    description: overrides?.description,
    value: overrides?.value ?? 50,
    color: overrides?.color ?? WEIGHT_COLORS[idx % WEIGHT_COLORS.length],
    icon: overrides?.icon ?? WEIGHT_ICONS[idx % WEIGHT_ICONS.length],
  };
}

/**
 * weight-utils — Unit tests
 *
 * Tests the weight utility functions: buildProfiles, getTreeWeights,
 * labelToId, createWeightDimension, and FALLBACK_WEIGHTS.
 */

import { describe, it, expect } from "vitest";
import {
  FALLBACK_WEIGHTS,
  WEIGHT_COLORS,
  WEIGHT_ICONS,
  buildProfiles,
  getTreeWeights,
  labelToId,
  createWeightDimension,
} from "../weight-utils";
import type { WeightDimension } from "../types";

// ─── FALLBACK_WEIGHTS ────────────────────────────────────

describe("FALLBACK_WEIGHTS", () => {
  it("should have 8 default dimensions", () => {
    expect(FALLBACK_WEIGHTS).toHaveLength(8);
  });

  it("should have unique IDs", () => {
    const ids = FALLBACK_WEIGHTS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should all default to value 50", () => {
    expect(FALLBACK_WEIGHTS.every((w) => w.value === 50)).toBe(true);
  });

  it("should all have colors and icons", () => {
    for (const w of FALLBACK_WEIGHTS) {
      expect(w.color).toBeTruthy();
      expect(w.icon).toBeTruthy();
    }
  });
});

// ─── buildProfiles ──────────────────────────────────────

describe("buildProfiles", () => {
  const dims: WeightDimension[] = [
    { id: "risk", label: "Risk", value: 60, color: "#F00" },
    { id: "cost", label: "Cost", value: 40, color: "#0F0" },
  ];

  it("should generate 4 profiles", () => {
    const profiles = buildProfiles(dims);
    expect(profiles).toHaveLength(4);
  });

  it("should include 'Tree Default' profile with original values", () => {
    const profiles = buildProfiles(dims);
    const def = profiles.find((p) => p.id === "tree-default");

    expect(def).toBeDefined();
    expect(def!.dimensions[0].value).toBe(60);
    expect(def!.dimensions[1].value).toBe(40);
  });

  it("should include 'Balanced' profile with all values at 50", () => {
    const profiles = buildProfiles(dims);
    const balanced = profiles.find((p) => p.id === "balanced");

    expect(balanced).toBeDefined();
    expect(balanced!.dimensions.every((d) => d.value === 50)).toBe(true);
  });

  it("should include 'Aggressive' profile with all values at 80", () => {
    const profiles = buildProfiles(dims);
    const aggressive = profiles.find((p) => p.id === "aggressive");

    expect(aggressive).toBeDefined();
    expect(aggressive!.dimensions.every((d) => d.value === 80)).toBe(true);
  });

  it("should include 'Conservative' profile with all values at 25", () => {
    const profiles = buildProfiles(dims);
    const conservative = profiles.find((p) => p.id === "conservative");

    expect(conservative).toBeDefined();
    expect(conservative!.dimensions.every((d) => d.value === 25)).toBe(true);
  });

  it("should not mutate original dimensions", () => {
    const originalValues = dims.map((d) => d.value);
    buildProfiles(dims);
    const afterValues = dims.map((d) => d.value);

    expect(afterValues).toEqual(originalValues);
  });

  it("should handle empty dimensions array", () => {
    const profiles = buildProfiles([]);
    expect(profiles).toHaveLength(4);
    expect(profiles[0].dimensions).toEqual([]);
  });
});

// ─── getTreeWeights ─────────────────────────────────────

describe("getTreeWeights", () => {
  it("should return tree's defaultWeights when present", () => {
    const tree = {
      defaultWeights: [
        { id: "custom", label: "Custom", value: 70, color: "#FFF" },
      ],
    };

    const weights = getTreeWeights(tree);
    expect(weights).toHaveLength(1);
    expect(weights[0].id).toBe("custom");
  });

  it("should return FALLBACK_WEIGHTS when tree has no defaultWeights", () => {
    const tree = {};
    const weights = getTreeWeights(tree);
    expect(weights).toEqual(FALLBACK_WEIGHTS);
  });

  it("should return FALLBACK_WEIGHTS when defaultWeights is empty", () => {
    const tree = { defaultWeights: [] };
    const weights = getTreeWeights(tree);
    expect(weights).toEqual(FALLBACK_WEIGHTS);
  });

  it("should return FALLBACK_WEIGHTS when defaultWeights is undefined", () => {
    const tree = { defaultWeights: undefined };
    const weights = getTreeWeights(tree);
    expect(weights).toEqual(FALLBACK_WEIGHTS);
  });
});

// ─── labelToId ──────────────────────────────────────────

describe("labelToId", () => {
  it("should convert simple labels", () => {
    expect(labelToId("Risk Tolerance")).toBe("risk_tolerance");
  });

  it("should handle special characters", () => {
    expect(labelToId("Cost $$$")).toBe("cost");
  });

  it("should strip leading/trailing underscores", () => {
    expect(labelToId("__test__")).toBe("test");
  });

  it("should handle single word", () => {
    expect(labelToId("Speed")).toBe("speed");
  });

  it("should handle numbers", () => {
    expect(labelToId("Phase 2 Priority")).toBe("phase_2_priority");
  });

  it("should handle empty string", () => {
    expect(labelToId("")).toBe("");
  });

  it("should lowercase everything", () => {
    expect(labelToId("UPPER CASE")).toBe("upper_case");
  });
});

// ─── createWeightDimension ──────────────────────────────

describe("createWeightDimension", () => {
  it("should create a dimension with sensible defaults", () => {
    const dim = createWeightDimension([]);

    expect(dim.id).toBeTruthy();
    expect(dim.label).toBe("Dimension 1");
    expect(dim.value).toBe(50);
    expect(dim.color).toBe(WEIGHT_COLORS[0]);
    expect(dim.icon).toBe(WEIGHT_ICONS[0]);
  });

  it("should cycle through colors based on existing count", () => {
    const existing: WeightDimension[] = [
      { id: "a", label: "A", value: 50, color: "#F00" },
      { id: "b", label: "B", value: 50, color: "#0F0" },
    ];

    const dim = createWeightDimension(existing);

    expect(dim.color).toBe(WEIGHT_COLORS[2]);
    expect(dim.icon).toBe(WEIGHT_ICONS[2]);
    expect(dim.label).toBe("Dimension 3");
  });

  it("should accept overrides", () => {
    const dim = createWeightDimension([], {
      id: "custom-id",
      label: "Custom Label",
      value: 75,
      color: "#ABC",
    });

    expect(dim.id).toBe("custom-id");
    expect(dim.label).toBe("Custom Label");
    expect(dim.value).toBe(75);
    expect(dim.color).toBe("#ABC");
  });

  it("should handle partial overrides", () => {
    const dim = createWeightDimension([], { label: "Only Label" });

    expect(dim.label).toBe("Only Label");
    expect(dim.value).toBe(50); // default
  });
});

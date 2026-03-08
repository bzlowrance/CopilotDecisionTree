/**
 * WeightEditor — CRUD panel for tree-level weight dimensions.
 *
 * Shows the current tree's `defaultWeights` and lets the user:
 *  - Add / remove dimensions
 *  - Edit label, description, value (slider), color, icon
 *  - Reorder dimensions (drag handles TBD — using up/down for now)
 *
 * All changes flow through `onUpdateWeights` which patches the tree
 * and auto-saves via the normal App auto-save path.
 */

import React, { useState } from "react";
import type { WeightDimension } from "../types";
import {
  WEIGHT_COLORS,
  WEIGHT_ICONS,
  createWeightDimension,
  labelToId,
} from "../weight-utils";

// ─── Props ──────────────────────────────────────────────────

interface WeightEditorProps {
  weights: WeightDimension[];
  onUpdateWeights: (weights: WeightDimension[]) => void;
}

// ─── Styles ─────────────────────────────────────────────────

const fieldLabel: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(200,210,230,0.5)",
  marginBottom: 2,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const textInput: React.CSSProperties = {
  width: "100%",
  padding: "5px 7px",
  background: "rgba(20,30,50,0.8)",
  border: "1px solid rgba(100,150,200,0.2)",
  borderRadius: 4,
  color: "#e0e8f0",
  fontSize: 11,
  outline: "none",
  fontFamily: "-apple-system, sans-serif",
};

const miniBtn: React.CSSProperties = {
  padding: "3px 8px",
  border: "1px solid rgba(100,150,200,0.2)",
  borderRadius: 4,
  background: "rgba(20,30,50,0.6)",
  color: "#c8d6e8",
  fontSize: 10,
  cursor: "pointer",
};

// ─── Component ──────────────────────────────────────────────

export const WeightEditor: React.FC<WeightEditorProps> = ({
  weights,
  onUpdateWeights,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── CRUD Handlers ──

  const handleAdd = () => {
    const dim = createWeightDimension(weights);
    onUpdateWeights([...weights, dim]);
    setExpandedId(dim.id);
  };

  const handleRemove = (id: string) => {
    onUpdateWeights(weights.filter((w) => w.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdate = (id: string, patch: Partial<WeightDimension>) => {
    onUpdateWeights(
      weights.map((w) => {
        if (w.id !== id) return w;
        const updated = { ...w, ...patch };
        // Auto-generate id from label if label changed and id is still auto-generated
        if (patch.label && w.id.startsWith("dim_")) {
          updated.id = labelToId(patch.label);
        }
        return updated;
      })
    );
  };

  const handleMove = (id: string, dir: -1 | 1) => {
    const idx = weights.findIndex((w) => w.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= weights.length) return;
    const copy = [...weights];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    onUpdateWeights(copy);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: "#e0e8f0" }}>
          ⚖️ Weight Dimensions ({weights.length})
        </span>
        <button
          onClick={handleAdd}
          style={{
            ...miniBtn,
            background: "rgba(70,200,255,0.1)",
            borderColor: "rgba(70,200,255,0.35)",
            color: "rgba(70,200,255,0.85)",
          }}
        >
          + Add
        </button>
      </div>

      {weights.length === 0 && (
        <div
          style={{
            fontSize: 11,
            color: "rgba(200,210,230,0.35)",
            textAlign: "center",
            padding: "16px 0",
          }}
        >
          No weight dimensions defined.
          <br />
          Click <b>+ Add</b> to create one.
        </div>
      )}

      {/* Dimension List */}
      {weights.map((dim, idx) => {
        const isExpanded = expandedId === dim.id;
        return (
          <div
            key={dim.id}
            style={{
              background: isExpanded
                ? "rgba(20,30,50,0.7)"
                : "rgba(20,30,50,0.4)",
              border: `1px solid ${dim.color}44`,
              borderRadius: 6,
              overflow: "hidden",
              transition: "all 0.15s",
            }}
          >
            {/* Collapsed Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 10px",
                cursor: "pointer",
              }}
              onClick={() => setExpandedId(isExpanded ? null : dim.id)}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>
                {dim.icon ?? "⚙️"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: dim.color,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {dim.label}
                </div>
              </div>
              {/* Value badge */}
              <span
                style={{
                  fontSize: 10,
                  color: "#c8d6e8",
                  background: "rgba(100,150,200,0.15)",
                  padding: "1px 6px",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                {dim.value}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(200,210,230,0.4)",
                  flexShrink: 0,
                }}
              >
                {isExpanded ? "▲" : "▼"}
              </span>
            </div>

            {/* Expanded Editor */}
            {isExpanded && (
              <div
                style={{
                  padding: "8px 10px 10px",
                  borderTop: `1px solid ${dim.color}22`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* Label */}
                <div>
                  <div style={fieldLabel}>Label</div>
                  <input
                    style={textInput}
                    value={dim.label}
                    onChange={(e) =>
                      handleUpdate(dim.id, { label: e.target.value })
                    }
                    placeholder="Dimension name"
                  />
                </div>

                {/* ID (read-only, derived from label) */}
                <div>
                  <div style={fieldLabel}>ID</div>
                  <input
                    style={{ ...textInput, opacity: 0.6 }}
                    value={dim.id}
                    onChange={(e) =>
                      handleUpdate(dim.id, { id: e.target.value })
                    }
                    placeholder="dimension_id"
                  />
                </div>

                {/* Description */}
                <div>
                  <div style={fieldLabel}>Description</div>
                  <input
                    style={textInput}
                    value={dim.description ?? ""}
                    onChange={(e) =>
                      handleUpdate(dim.id, { description: e.target.value })
                    }
                    placeholder="Optional description"
                  />
                </div>

                {/* Value slider */}
                <div>
                  <div style={fieldLabel}>
                    Default Value:{" "}
                    <span style={{ color: dim.color }}>{dim.value}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={dim.value}
                    onChange={(e) =>
                      handleUpdate(dim.id, { value: Number(e.target.value) })
                    }
                    style={{
                      width: "100%",
                      accentColor: dim.color,
                      cursor: "pointer",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 9,
                      color: "rgba(200,210,230,0.3)",
                    }}
                  >
                    <span>0</span>
                    <span>100</span>
                  </div>
                </div>

                {/* Color + Icon row */}
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={fieldLabel}>Color</div>
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {WEIGHT_COLORS.map((c) => (
                        <div
                          key={c}
                          onClick={() => handleUpdate(dim.id, { color: c })}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 3,
                            background: c,
                            cursor: "pointer",
                            border:
                              c === dim.color
                                ? "2px solid #fff"
                                : "2px solid transparent",
                            opacity: c === dim.color ? 1 : 0.5,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div style={{ width: 80 }}>
                    <div style={fieldLabel}>Icon</div>
                    <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                      {WEIGHT_ICONS.slice(0, 8).map((ic) => (
                        <span
                          key={ic}
                          onClick={() => handleUpdate(dim.id, { icon: ic })}
                          style={{
                            cursor: "pointer",
                            fontSize: 14,
                            opacity: ic === dim.icon ? 1 : 0.4,
                            padding: 1,
                          }}
                        >
                          {ic}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    marginTop: 2,
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => handleMove(dim.id, -1)}
                      disabled={idx === 0}
                      style={{
                        ...miniBtn,
                        opacity: idx === 0 ? 0.3 : 1,
                      }}
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMove(dim.id, 1)}
                      disabled={idx === weights.length - 1}
                      style={{
                        ...miniBtn,
                        opacity: idx === weights.length - 1 ? 0.3 : 1,
                      }}
                    >
                      ▼
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Delete dimension "${dim.label}"? This will also remove references from nodes.`
                        )
                      )
                        handleRemove(dim.id);
                    }}
                    style={{
                      ...miniBtn,
                      borderColor: "rgba(248,113,113,0.3)",
                      color: "#f87171",
                    }}
                  >
                    🗑 Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

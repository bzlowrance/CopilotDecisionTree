/**
 * Sidebar — Node palette, tree list, and properties editor.
 */

import React, { useState } from "react";
import type { DecisionTree, NodeType, WeightDimension } from "../types";
import { AuthPanel } from "./AuthPanel";
import { WeightEditor } from "./WeightEditor";

interface SidebarProps {
  trees: DecisionTree[];
  selectedTree: DecisionTree | null;
  onSelectTree: (tree: DecisionTree) => void;
  onNewTree: () => void;
  onAddNode: (type: NodeType) => void;
  onRunTree: () => void;
  onRunPipeline: () => void;
  onUpdateWeights: (weights: WeightDimension[]) => void;
}

const nodeTypeConfig: { type: NodeType; label: string; icon: string; color: string; desc: string }[] = [
  { type: "input", label: "Input", icon: "🟦", color: "#4ea8de", desc: "Gather data from user" },
  { type: "assumption", label: "Assumption", icon: "🟨", color: "#f0c040", desc: "State an explicit assumption" },
  { type: "decision", label: "Decision", icon: "🟩", color: "#4ade80", desc: "Branch on a condition" },
  { type: "action", label: "Action", icon: "🟥", color: "#f87171", desc: "Terminal action" },
];

export const Sidebar: React.FC<SidebarProps> = ({
  trees,
  selectedTree,
  onSelectTree,
  onNewTree,
  onAddNode,
  onRunTree,
  onRunPipeline,
  onUpdateWeights,
}) => {
  const [tab, setTab] = useState<"trees" | "nodes" | "weights">("trees");

  return (
    <div
      style={{
        width: 260,
        background: "rgba(12, 15, 25, 0.95)",
        borderRight: "1px solid rgba(100,150,200,0.15)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 14px 8px",
          borderBottom: "1px solid rgba(100,150,200,0.1)",
        }}
      >
        <h1 style={{ fontSize: 15, fontWeight: 700, color: "#e0e8f0", margin: 0 }}>
          🌳 Copilot Decision Tree
        </h1>
        <p style={{ fontSize: 10, color: "rgba(200,210,230,0.5)", marginTop: 4 }}>
          Visual AI Reasoning Builder
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(100,150,200,0.1)" }}>
        {(["trees", "nodes", "weights"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "8px",
              background: tab === t ? "rgba(70,200,255,0.1)" : "transparent",
              border: "none",
              borderBottom: tab === t ? "2px solid rgba(70,200,255,0.6)" : "2px solid transparent",
              color: tab === t ? "#fff" : "rgba(200,210,230,0.5)",
              fontSize: 11,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t === "trees" ? "📂 Trees" : t === "nodes" ? "🧩 Nodes" : "⚖️ Wts"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
        {tab === "trees" && (
          <>
            <button
              onClick={onNewTree}
              style={{
                width: "100%",
                padding: "8px",
                background: "rgba(70,200,255,0.1)",
                border: "1px dashed rgba(70,200,255,0.4)",
                borderRadius: 6,
                color: "rgba(70,200,255,0.8)",
                fontSize: 11,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              + New Decision Tree
            </button>

            {trees.map((tree) => (
              <div
                key={tree.id}
                onClick={() => onSelectTree(tree)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 6,
                  marginBottom: 4,
                  cursor: "pointer",
                  background:
                    selectedTree?.id === tree.id
                      ? "rgba(70,200,255,0.12)"
                      : "rgba(20,30,50,0.4)",
                  border:
                    selectedTree?.id === tree.id
                      ? "1px solid rgba(70,200,255,0.3)"
                      : "1px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 12, color: "#e0e8f0", fontWeight: 500 }}>
                  {tree.name}
                </div>
                <div style={{ fontSize: 9, color: "rgba(200,210,230,0.4)", marginTop: 2 }}>
                  {tree.nodes.length} nodes · {tree.tags.join(", ")}
                </div>
              </div>
            ))}

            {trees.length === 0 && (
              <div style={{ color: "rgba(200,210,230,0.3)", fontSize: 11, textAlign: "center", marginTop: 20 }}>
                No trees yet. Create one!
              </div>
            )}
          </>
        )}

        {tab === "nodes" && (
          <>
            <p style={{ fontSize: 10, color: "rgba(200,210,230,0.4)", marginBottom: 10 }}>
              Click to add a node to the canvas:
            </p>
            {nodeTypeConfig.map(({ type, label, icon, color, desc }) => (
              <div
                key={type}
                onClick={() => onAddNode(type)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  marginBottom: 6,
                  cursor: "pointer",
                  background: "rgba(20,30,50,0.6)",
                  border: `1px solid ${color}33`,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${color}88`;
                  e.currentTarget.style.background = `${color}11`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${color}33`;
                  e.currentTarget.style.background = "rgba(20,30,50,0.6)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <strong style={{ color, fontSize: 12 }}>{label}</strong>
                </div>
                <div style={{ fontSize: 10, color: "rgba(200,210,230,0.4)", marginTop: 2 }}>
                  {desc}
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "weights" && (
          <>
            {selectedTree ? (
              <WeightEditor
                weights={selectedTree.defaultWeights ?? []}
                onUpdateWeights={onUpdateWeights}
              />
            ) : (
              <div style={{ color: "rgba(200,210,230,0.3)", fontSize: 11, textAlign: "center", marginTop: 20 }}>
                Select a tree to edit its weights.
              </div>
            )}
          </>
        )}
      </div>

      {/* Run buttons */}
      {selectedTree && (
        <div style={{ padding: 10, borderTop: "1px solid rgba(100,150,200,0.1)", display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={onRunTree}
            style={{
              width: "100%",
              padding: "10px",
              background: "linear-gradient(135deg, #1a4a2a, #1e5a35)",
              border: "1px solid rgba(74,222,128,0.5)",
              borderRadius: 8,
              color: "#4ade80",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 0 15px rgba(74,222,128,0.1)",
            }}
          >
            ▶ Run Interactive
          </button>
          <button
            onClick={onRunPipeline}
            style={{
              width: "100%",
              padding: "10px",
              background: "linear-gradient(135deg, #1a3a5a, #1e5080)",
              border: "1px solid rgba(78,168,222,0.5)",
              borderRadius: 8,
              color: "#4ea8de",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 0 15px rgba(78,168,222,0.1)",
            }}
          >
            ⚡ Pipeline Mode
          </button>
        </div>
      )}

      {/* Auth / Credentials */}
      <AuthPanel />
    </div>
  );
};

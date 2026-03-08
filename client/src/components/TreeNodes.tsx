/**
 * Custom React Flow node types for the decision tree editor.
 * Each node type has a distinct visual style matching its role.
 */

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

const baseStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 8,
  fontSize: 13,
  minWidth: 180,
  maxWidth: 280,
  fontFamily: "-apple-system, sans-serif",
  boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
  border: "1px solid",
  lineHeight: 1.4,
};

/** 🟦 Input Node — gathers data from the user */
export const InputNodeComponent = memo(({ data, selected }: NodeProps) => (
  <div
    style={{
      ...baseStyle,
      background: "linear-gradient(135deg, #1a2a4a, #1e3a5f)",
      borderColor: selected ? "#4ea8de" : "rgba(78,168,222,0.4)",
      boxShadow: selected ? "0 0 20px rgba(78,168,222,0.3)" : baseStyle.boxShadow,
    }}
  >
    <Handle type="target" position={Position.Left} style={{ background: "#4ea8de" }} />
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 16 }}>🟦</span>
      <strong style={{ color: "#4ea8de" }}>Input</strong>
    </div>
    <div style={{ color: "#e0e8f0" }}>{data.label}</div>
    {data.prompt && (
      <div style={{ color: "rgba(200,220,240,0.8)", fontSize: 11, marginTop: 4, fontStyle: "italic" }}>
        "{data.prompt}"
      </div>
    )}
    {data.choices && data.choices.length > 0 && (
      <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
        {data.choices.map((c: string) => (
          <span
            key={c}
            style={{
              background: "rgba(78,168,222,0.2)",
              padding: "2px 7px",
              borderRadius: 4,
              fontSize: 10,
              color: "#6dbde8",
            }}
          >
            {c}
          </span>
        ))}
      </div>
    )}
    {data.inputType === "image" && (
      <div style={{ marginTop: 4, fontSize: 10, color: "rgba(78,168,222,0.7)" }}>
        📷 Image upload
      </div>
    )}
    {data.inputType === "multiselect" && (
      <div style={{ marginTop: 4, fontSize: 10, color: "rgba(78,168,222,0.7)" }}>
        📋 Multi-select
      </div>
    )}
    <Handle type="source" position={Position.Right} style={{ background: "#4ea8de" }} />
  </div>
));

/** 🟨 Assumption Node — states an explicit assumption */
export const AssumptionNodeComponent = memo(({ data, selected }: NodeProps) => (
  <div
    style={{
      ...baseStyle,
      background: "linear-gradient(135deg, #3a3520, #4a4525)",
      borderColor: selected ? "#f0c040" : "rgba(240,192,64,0.4)",
      boxShadow: selected ? "0 0 20px rgba(240,192,64,0.3)" : baseStyle.boxShadow,
    }}
  >
    <Handle type="target" position={Position.Left} style={{ background: "#f0c040" }} />
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 16 }}>🟨</span>
      <strong style={{ color: "#f0c040" }}>Assumption</strong>
    </div>
    <div style={{ color: "#e8e0d0" }}>{data.label}</div>
    {data.assumption && (
      <div style={{ color: "rgba(240,220,160,0.8)", fontSize: 11, marginTop: 4 }}>
        ⚠️ {data.assumption}
      </div>
    )}
    {data.weightInfluence && data.weightInfluence.length > 0 && (
      <div style={{ marginTop: 4, fontSize: 10, color: "rgba(240,192,64,0.7)" }}>
        ⚖️ Weight-influenced
      </div>
    )}
    <Handle type="source" position={Position.Right} style={{ background: "#f0c040" }} />
  </div>
));

/** 🟩 Decision Node — branches based on a condition */
export const DecisionNodeComponent = memo(({ data, selected }: NodeProps) => (
  <div
    style={{
      ...baseStyle,
      background: "linear-gradient(135deg, #1a3a2a, #1e4a30)",
      borderColor: selected ? "#4ade80" : "rgba(74,222,128,0.4)",
      boxShadow: selected ? "0 0 20px rgba(74,222,128,0.3)" : baseStyle.boxShadow,
      // Diamond hint
      position: "relative",
    }}
  >
    <Handle type="target" position={Position.Left} style={{ background: "#4ade80" }} />
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 16 }}>🟩</span>
      <strong style={{ color: "#4ade80" }}>Decision</strong>
    </div>
    <div style={{ color: "#d0f0e0" }}>{data.label}</div>
    {data.condition && (
      <div style={{ color: "rgba(160,240,200,0.8)", fontSize: 11, marginTop: 4 }}>
        ❓ {data.condition}
      </div>
    )}
    {data.weightBias && data.weightBias.length > 0 && (
      <div style={{ marginTop: 4, fontSize: 10, color: "rgba(74,222,128,0.7)" }}>
        ⚖️ Weight-biased
      </div>
    )}
    <Handle type="source" position={Position.Right} style={{ background: "#4ade80" }} />
  </div>
));

/** 🟥 Action Node — terminal action */
export const ActionNodeComponent = memo(({ data, selected }: NodeProps) => (
  <div
    style={{
      ...baseStyle,
      background: "linear-gradient(135deg, #3a1a2a, #4a1e30)",
      borderColor: selected ? "#f87171" : "rgba(248,113,113,0.4)",
      boxShadow: selected ? "0 0 20px rgba(248,113,113,0.3)" : baseStyle.boxShadow,
    }}
  >
    <Handle type="target" position={Position.Left} style={{ background: "#f87171" }} />
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 16 }}>🟥</span>
      <strong style={{ color: "#f87171" }}>Action</strong>
      {data.actionType && (
        <span style={{ fontSize: 10, color: "rgba(248,113,113,0.75)", marginLeft: "auto" }}>
          {data.actionType}
        </span>
      )}
    </div>
    <div style={{ color: "#f0d0d8" }}>{data.label}</div>
    {data.template && (
      <div
        style={{
          color: "rgba(248,180,180,0.75)",
          fontSize: 10,
          marginTop: 4,
          fontFamily: "monospace",
          maxHeight: 50,
          overflow: "hidden",
        }}
      >
        {data.template.slice(0, 100)}…
      </div>
    )}
    {/* Source handle — allows feedback loops from action nodes */}
    <Handle type="source" position={Position.Right} style={{ background: "#f87171" }} />
  </div>
));

export const nodeTypes = {
  input: InputNodeComponent,
  assumption: AssumptionNodeComponent,
  decision: DecisionNodeComponent,
  action: ActionNodeComponent,
};

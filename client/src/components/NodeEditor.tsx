/**
 * NodeEditor — Properties panel for editing selected node data.
 * Appears on the right side when a node is clicked.
 * Supports full CRUD: edit all fields, duplicate, set as root, delete.
 */

import React, { useState, useEffect } from "react";
import type { Node } from "reactflow";
import type { NodeType, TreeNodeData, WeightDimension } from "../types";

interface NodeEditorProps {
  node: Node;
  onUpdate: (id: string, data: Partial<TreeNodeData>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (node: Node) => void;
  onSetRoot: (id: string) => void;
  isRoot: boolean;
  /** The tree's weight dimensions — used to populate dropdowns */
  weightDimensions: WeightDimension[];
  /** Labels from outgoing edges — used for weightBias favorsBranch dropdown */
  outgoingEdgeLabels: string[];
}

const fieldLabel: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(200,210,230,0.5)",
  marginBottom: 3,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const textInput: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  background: "rgba(20,30,50,0.8)",
  border: "1px solid rgba(100,150,200,0.2)",
  borderRadius: 4,
  color: "#e0e8f0",
  fontSize: 12,
  outline: "none",
  fontFamily: "-apple-system, sans-serif",
};

const textArea: React.CSSProperties = {
  ...textInput,
  minHeight: 60,
  resize: "vertical",
  fontFamily: "monospace",
  fontSize: 11,
};

const selectInput: React.CSSProperties = {
  ...textInput,
  cursor: "pointer",
};

const colorMap: Record<NodeType, string> = {
  input: "#4ea8de",
  assumption: "#f0c040",
  decision: "#4ade80",
  action: "#f87171",
};

const iconMap: Record<NodeType, string> = {
  input: "🟦",
  assumption: "🟨",
  decision: "🟩",
  action: "🟥",
};

export const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  onUpdate,
  onDelete,
  onDuplicate,
  onSetRoot,
  isRoot,
  weightDimensions,
  outgoingEdgeLabels,
}) => {
  const data = node.data as TreeNodeData;
  const nodeType = node.type as NodeType;
  const color = colorMap[nodeType] ?? "#888";

  // Local state for choices editing
  const [choicesText, setChoicesText] = useState(data.choices?.join("\n") ?? "");

  useEffect(() => {
    setChoicesText(data.choices?.join("\n") ?? "");
  }, [node.id, data.choices]);

  const update = (fields: Partial<TreeNodeData>) => {
    onUpdate(node.id, fields);
  };

  return (
    <div
      style={{
        width: 300,
        background: "rgba(12, 15, 25, 0.97)",
        borderLeft: "1px solid rgba(100,150,200,0.15)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `2px solid ${color}44`,
          background: `${color}08`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18 }}>{iconMap[nodeType]}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color }}>
              {nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node
            </div>
            <div style={{ fontSize: 9, color: "rgba(200,210,230,0.4)" }}>
              ID: {node.id.slice(0, 20)}...
            </div>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* ── Common Fields ── */}
        <div>
          <div style={fieldLabel}>Label</div>
          <input
            style={textInput}
            value={data.label ?? ""}
            onChange={(e) => update({ label: e.target.value })}
            placeholder="Node label"
          />
        </div>

        <div>
          <div style={fieldLabel}>Description</div>
          <textarea
            style={textArea}
            value={data.description ?? ""}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Optional description"
          />
        </div>

        {/* ── Input Node Fields ── */}
        {nodeType === "input" && (
          <>
            <div>
              <div style={fieldLabel}>Prompt (question to ask)</div>
              <textarea
                style={textArea}
                value={data.prompt ?? ""}
                onChange={(e) => update({ prompt: e.target.value })}
                placeholder='e.g. "What language do you prefer?"'
              />
            </div>
            <div>
              <div style={fieldLabel}>Variable Name</div>
              <input
                style={textInput}
                value={data.variableName ?? ""}
                onChange={(e) => update({ variableName: e.target.value })}
                placeholder="e.g. language"
              />
            </div>
            <div>
              <div style={fieldLabel}>Input Type</div>
              <select
                style={selectInput}
                value={data.inputType ?? "text"}
                onChange={(e) => update({ inputType: e.target.value as any })}
              >
                <option value="text">Text</option>
                <option value="choice">Choice (single select)</option>
                <option value="multiselect">Multi-select (pick many)</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean (Yes/No)</option>
                <option value="image">Image Upload</option>
              </select>
            </div>
            {(data.inputType === "choice" || data.inputType === "multiselect" || data.choices?.length) && (
              <div>
                <div style={fieldLabel}>Choices (one per line)</div>
                <textarea
                  style={{ ...textArea, minHeight: 80 }}
                  value={choicesText}
                  onChange={(e) => {
                    setChoicesText(e.target.value);
                    update({ choices: e.target.value.split("\n").filter((c) => c.trim()) });
                  }}
                  placeholder={"Option 1\nOption 2\nOption 3"}
                />
              </div>
            )}
            <div>
              <div style={fieldLabel}>Default Value</div>
              <input
                style={textInput}
                value={typeof data.default === "string" ? data.default : ""}
                onChange={(e) => update({ default: e.target.value })}
                placeholder="Optional default"
              />
            </div>
          </>
        )}

        {/* ── Assumption Node Fields ── */}
        {nodeType === "assumption" && (
          <>
            <div>
              <div style={fieldLabel}>Assumption Statement</div>
              <textarea
                style={{ ...textArea, minHeight: 70 }}
                value={data.assumption ?? ""}
                onChange={(e) => update({ assumption: e.target.value })}
                placeholder="The assumption being made..."
              />
            </div>
            <div>
              <div style={fieldLabel}>Variable Name</div>
              <input
                style={textInput}
                value={data.variableName ?? ""}
                onChange={(e) => update({ variableName: e.target.value })}
                placeholder="e.g. assumesProduction"
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={data.default === true}
                onChange={(e) => update({ default: e.target.checked })}
                style={{ accentColor: color }}
              />
              <span style={{ fontSize: 11, color: "#e0e8f0" }}>Default: assumed true</span>
            </div>

            {/* ── Weight Influence (assumption nodes) ── */}
            {weightDimensions.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ ...fieldLabel, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Weight Influence</span>
                  <button
                    onClick={() => {
                      const existing = data.weightInfluence ?? [];
                      update({
                        weightInfluence: [
                          ...existing,
                          { dimension: weightDimensions[0].id, direction: "accept", strength: 0.5 },
                        ],
                      });
                    }}
                    style={{
                      padding: "1px 6px",
                      border: "1px solid rgba(100,150,200,0.2)",
                      borderRadius: 3,
                      background: "rgba(20,30,50,0.6)",
                      color: "rgba(70,200,255,0.8)",
                      fontSize: 9,
                      cursor: "pointer",
                    }}
                  >
                    + Add
                  </button>
                </div>
                {(data.weightInfluence ?? []).map((wi, idx) => {
                  const dim = weightDimensions.find((d) => d.id === wi.dimension);
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        padding: "6px 8px",
                        background: "rgba(20,30,50,0.5)",
                        borderRadius: 4,
                        marginTop: 4,
                        border: `1px solid ${dim?.color ?? "rgba(100,150,200,0.15)"}33`,
                      }}
                    >
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <select
                          style={{ ...selectInput, flex: 1 }}
                          value={wi.dimension}
                          onChange={(e) => {
                            const arr = [...(data.weightInfluence ?? [])];
                            arr[idx] = { ...arr[idx], dimension: e.target.value };
                            update({ weightInfluence: arr });
                          }}
                        >
                          {weightDimensions.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.icon ?? ""} {d.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const arr = [...(data.weightInfluence ?? [])];
                            arr.splice(idx, 1);
                            update({ weightInfluence: arr });
                          }}
                          style={{
                            padding: "2px 5px",
                            border: "none",
                            background: "transparent",
                            color: "#f87171",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <select
                          style={{ ...selectInput, width: 80 }}
                          value={wi.direction}
                          onChange={(e) => {
                            const arr = [...(data.weightInfluence ?? [])];
                            arr[idx] = { ...arr[idx], direction: e.target.value as "accept" | "reject" };
                            update({ weightInfluence: arr });
                          }}
                        >
                          <option value="accept">Accept</option>
                          <option value="reject">Reject</option>
                        </select>
                        <span style={{ fontSize: 9, color: "rgba(200,210,230,0.4)" }}>str:</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(wi.strength * 100)}
                          onChange={(e) => {
                            const arr = [...(data.weightInfluence ?? [])];
                            arr[idx] = { ...arr[idx], strength: Number(e.target.value) / 100 };
                            update({ weightInfluence: arr });
                          }}
                          style={{ flex: 1, accentColor: dim?.color ?? "#4ea8de" }}
                        />
                        <span style={{ fontSize: 9, color: "#c8d6e8", width: 24, textAlign: "right" }}>
                          {Math.round(wi.strength * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                {(data.weightInfluence ?? []).length === 0 && (
                  <div style={{ fontSize: 10, color: "rgba(200,210,230,0.3)", marginTop: 2 }}>
                    No weight influences. Click + Add to connect this assumption to a weight dimension.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Decision Node Fields ── */}
        {nodeType === "decision" && (
          <>
            <div>
              <div style={fieldLabel}>Condition (human-readable)</div>
              <textarea
                style={textArea}
                value={data.condition ?? ""}
                onChange={(e) => update({ condition: e.target.value })}
                placeholder='e.g. "Is there a database?"'
              />
            </div>
            <div>
              <div style={fieldLabel}>Evaluate Expression</div>
              <input
                style={{ ...textInput, fontFamily: "monospace", fontSize: 11 }}
                value={data.evaluateExpression ?? ""}
                onChange={(e) => update({ evaluateExpression: e.target.value })}
                placeholder='e.g. {{variableName}}'
              />
              <div style={{ fontSize: 9, color: "rgba(200,210,230,0.3)", marginTop: 2 }}>
                Use {"{{var}}"} to reference collected inputs
              </div>
            </div>

            {/* ── Weight Bias (decision nodes) ── */}
            {weightDimensions.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ ...fieldLabel, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Weight Bias</span>
                  <button
                    onClick={() => {
                      const existing = data.weightBias ?? [];
                      update({
                        weightBias: [
                          ...existing,
                          {
                            dimension: weightDimensions[0].id,
                            favorsBranch: outgoingEdgeLabels[0] ?? "",
                            strength: 0.5,
                          },
                        ],
                      });
                    }}
                    style={{
                      padding: "1px 6px",
                      border: "1px solid rgba(100,150,200,0.2)",
                      borderRadius: 3,
                      background: "rgba(20,30,50,0.6)",
                      color: "rgba(70,200,255,0.8)",
                      fontSize: 9,
                      cursor: "pointer",
                    }}
                  >
                    + Add
                  </button>
                </div>
                {(data.weightBias ?? []).map((wb, idx) => {
                  const dim = weightDimensions.find((d) => d.id === wb.dimension);
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        padding: "6px 8px",
                        background: "rgba(20,30,50,0.5)",
                        borderRadius: 4,
                        marginTop: 4,
                        border: `1px solid ${dim?.color ?? "rgba(100,150,200,0.15)"}33`,
                      }}
                    >
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <select
                          style={{ ...selectInput, flex: 1 }}
                          value={wb.dimension}
                          onChange={(e) => {
                            const arr = [...(data.weightBias ?? [])];
                            arr[idx] = { ...arr[idx], dimension: e.target.value };
                            update({ weightBias: arr });
                          }}
                        >
                          {weightDimensions.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.icon ?? ""} {d.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const arr = [...(data.weightBias ?? [])];
                            arr.splice(idx, 1);
                            update({ weightBias: arr });
                          }}
                          style={{
                            padding: "2px 5px",
                            border: "none",
                            background: "transparent",
                            color: "#f87171",
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: "rgba(200,210,230,0.4)", marginBottom: 1 }}>Favors branch:</div>
                          {outgoingEdgeLabels.length > 0 ? (
                            <select
                              style={{ ...selectInput }}
                              value={wb.favorsBranch}
                              onChange={(e) => {
                                const arr = [...(data.weightBias ?? [])];
                                arr[idx] = { ...arr[idx], favorsBranch: e.target.value };
                                update({ weightBias: arr });
                              }}
                            >
                              <option value="">-- Select --</option>
                              {outgoingEdgeLabels.map((lbl) => (
                                <option key={lbl} value={lbl}>
                                  {lbl}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              style={textInput}
                              value={wb.favorsBranch}
                              onChange={(e) => {
                                const arr = [...(data.weightBias ?? [])];
                                arr[idx] = { ...arr[idx], favorsBranch: e.target.value };
                                update({ weightBias: arr });
                              }}
                              placeholder="Edge label or ID"
                            />
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: "rgba(200,210,230,0.4)" }}>str:</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(wb.strength * 100)}
                          onChange={(e) => {
                            const arr = [...(data.weightBias ?? [])];
                            arr[idx] = { ...arr[idx], strength: Number(e.target.value) / 100 };
                            update({ weightBias: arr });
                          }}
                          style={{ flex: 1, accentColor: dim?.color ?? "#4ade80" }}
                        />
                        <span style={{ fontSize: 9, color: "#c8d6e8", width: 24, textAlign: "right" }}>
                          {Math.round(wb.strength * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                {(data.weightBias ?? []).length === 0 && (
                  <div style={{ fontSize: 10, color: "rgba(200,210,230,0.3)", marginTop: 2 }}>
                    No weight biases. Click + Add to influence branching with weight dimensions.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Action Node Fields ── */}
        {nodeType === "action" && (
          <>
            <div>
              <div style={fieldLabel}>Action Type</div>
              <select
                style={selectInput}
                value={data.actionType ?? "respond"}
                onChange={(e) => update({ actionType: e.target.value as any })}
              >
                <option value="respond">Respond (text)</option>
                <option value="generate">Generate (code)</option>
                <option value="copilot_prompt">Copilot Prompt (AI)</option>
                <option value="api_call">API Call</option>
              </select>
            </div>
            <div>
              <div style={fieldLabel}>Template</div>
              <textarea
                style={{ ...textArea, minHeight: 100 }}
                value={data.template ?? ""}
                onChange={(e) => update({ template: e.target.value })}
                placeholder='Use {{variable}} for interpolation'
              />
            </div>
            {data.actionType === "copilot_prompt" && (
              <div>
                <div style={fieldLabel}>System Prompt</div>
                <textarea
                  style={{ ...textArea, minHeight: 80 }}
                  value={data.systemPrompt ?? ""}
                  onChange={(e) => update({ systemPrompt: e.target.value })}
                  placeholder="System prompt for Copilot SDK"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          padding: 12,
          borderTop: "1px solid rgba(100,150,200,0.1)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {!isRoot && (
          <button
            onClick={() => onSetRoot(node.id)}
            style={{
              width: "100%",
              padding: "7px",
              background: "rgba(70,200,255,0.08)",
              border: "1px solid rgba(70,200,255,0.25)",
              borderRadius: 5,
              color: "rgba(70,200,255,0.8)",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            📌 Set as Root Node
          </button>
        )}
        {isRoot && (
          <div
            style={{
              width: "100%",
              padding: "7px",
              background: "rgba(70,200,255,0.05)",
              border: "1px solid rgba(70,200,255,0.15)",
              borderRadius: 5,
              color: "rgba(70,200,255,0.5)",
              fontSize: 11,
              textAlign: "center",
            }}
          >
            📌 This is the root node
          </div>
        )}
        <button
          onClick={() => onDuplicate(node)}
          style={{
            width: "100%",
            padding: "7px",
            background: "rgba(200,200,200,0.05)",
            border: "1px solid rgba(200,200,200,0.15)",
            borderRadius: 5,
            color: "rgba(200,210,230,0.7)",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          📋 Duplicate Node
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete "${data.label}"?`)) {
              onDelete(node.id);
            }
          }}
          style={{
            width: "100%",
            padding: "7px",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 5,
            color: "#f87171",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          🗑 Delete Node
        </button>
      </div>
    </div>
  );
};

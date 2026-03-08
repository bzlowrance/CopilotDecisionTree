/**
 * PipelineRunner — Form-based interface for running decision trees
 * in pipeline mode. Pre-fill all inputs, execute in one shot,
 * view the trace + result. Supports batch execution via CSV paste.
 */

import React, { useState, useEffect, useRef } from "react";
import { WeightsRadar } from "./WeightsRadar";
import type {
  DecisionTree,
  WeightDimension,
  WeightProfile,
  PipelineSchema,
  PipelineField,
  PipelineResult,
  PipelineTraceEntry,
} from "../types";
import * as api from "../api";
import { buildProfiles, getTreeWeights } from "../weight-utils";

interface PipelineRunnerProps {
  tree: DecisionTree;
  onClose: () => void;
}

type Tab = "single" | "batch" | "history";

export const PipelineRunner: React.FC<PipelineRunnerProps> = ({ tree, onClose }) => {
  const treeWeights = getTreeWeights(tree);
  const [weights, setWeights] = useState<WeightDimension[]>(treeWeights);
  const [schema, setSchema] = useState<PipelineSchema | null>(null);
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [history, setHistory] = useState<PipelineResult[]>([]);
  const [tab, setTab] = useState<Tab>("single");
  const [batchCsv, setBatchCsv] = useState("");
  const [batchResults, setBatchResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Load schema on mount
  useEffect(() => {
    api.getPipelineSchema(tree.id).then((s: PipelineSchema) => {
      setSchema(s);
      // Pre-fill defaults
      const defaults: Record<string, unknown> = {};
      for (const f of s.fields) {
        defaults[f.variableName] = f.default;
      }
      setInputs(defaults);
    }).catch((e) => setError(`Failed to load schema: ${e}`));
  }, [tree.id]);

  // Scroll to result on completion
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [result]);

  const handleInputChange = (varName: string, value: unknown) => {
    setInputs((prev) => ({ ...prev, [varName]: value }));
  };

  const handleRun = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.runPipeline(tree.id, inputs, weights);
      setResult(res);
      setHistory((prev) => [res, ...prev].slice(0, 50));
    } catch (err) {
      setError(`Pipeline failed: ${err}`);
    }
    setIsLoading(false);
  };

  const handleBatchRun = async () => {
    if (!batchCsv.trim() || !schema) return;
    setIsLoading(true);
    setError(null);
    setBatchResults(null);
    try {
      const runs = parseCsv(batchCsv, schema.fields);
      const res = await api.runPipelineBatch(tree.id, runs.map((r) => ({ inputs: r })));
      setBatchResults(res);
    } catch (err) {
      setError(`Batch failed: ${err}`);
    }
    setIsLoading(false);
  };

  const generateCsvTemplate = () => {
    if (!schema) return;
    const header = schema.fields.map((f) => f.variableName).join(",");
    const example = schema.fields.map((f) => {
      if (f.choices?.length) return f.choices[0];
      if (f.inputType === "boolean") return "true";
      return f.default ?? "";
    }).join(",");
    setBatchCsv(`${header}\n${example}`);
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(5,5,15,0.97)", zIndex: 1000, display: "flex",
    }}>
      {/* Left: Form + Results */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid rgba(100,150,200,0.15)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: 14, color: "#e0e8f0", margin: 0 }}>
              ⚡ Pipeline: {tree.name}
            </h2>
            <p style={{ fontSize: 10, color: "rgba(200,210,230,0.4)", margin: 0 }}>
              Pre-fill inputs and execute in one shot — no interaction required
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>✕ Close</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 0, borderBottom: "1px solid rgba(100,150,200,0.1)",
          padding: "0 16px",
        }}>
          {(["single", "batch", "history"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 18px", fontSize: 11, fontWeight: 600,
                background: "transparent", border: "none", cursor: "pointer",
                color: tab === t ? "#4ea8de" : "rgba(200,210,230,0.4)",
                borderBottom: tab === t ? "2px solid #4ea8de" : "2px solid transparent",
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}
            >
              {t === "single" ? "Single Run" : t === "batch" ? `Batch` : `History (${history.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {error && (
            <div style={{
              padding: "10px 14px", background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)", borderRadius: 8,
              color: "#f87171", fontSize: 12, marginBottom: 12,
            }}>
              {error}
            </div>
          )}

          {/* ─── Single Run Tab ────────────────────────────── */}
          {tab === "single" && schema && (
            <>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16,
              }}>
                {schema.fields.map((field) => (
                  <FieldInput
                    key={field.variableName}
                    field={field}
                    value={inputs[field.variableName]}
                    onChange={(v) => handleInputChange(field.variableName, v)}
                  />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <button onClick={handleRun} disabled={isLoading} style={runBtnStyle}>
                  {isLoading ? "⏳ Executing..." : "▶ Execute Pipeline"}
                </button>
                <span style={{ fontSize: 10, color: "rgba(200,210,230,0.3)" }}>
                  {schema.fieldCount} inputs · {tree.nodes.length} nodes
                </span>
              </div>

              {result && <PipelineResultView result={result} ref={resultRef} />}
            </>
          )}

          {/* ─── Batch Tab ─────────────────────────────────── */}
          {tab === "batch" && schema && (
            <>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, color: "rgba(200,210,230,0.6)", fontWeight: 600 }}>
                    CSV Data — one row per run
                  </label>
                  <button onClick={generateCsvTemplate} style={smallBtnStyle}>
                    Generate Template
                  </button>
                </div>
                <textarea
                  value={batchCsv}
                  onChange={(e) => setBatchCsv(e.target.value)}
                  placeholder={`${schema.fields.map((f) => f.variableName).join(",")}\nvalue1,value2,...`}
                  rows={10}
                  style={{
                    width: "100%", padding: "10px 12px", fontFamily: "monospace", fontSize: 11,
                    background: "rgba(20,30,50,0.8)", border: "1px solid rgba(100,150,200,0.2)",
                    borderRadius: 8, color: "#e0e8f0", resize: "vertical", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <button onClick={handleBatchRun} disabled={isLoading || !batchCsv.trim()} style={runBtnStyle}>
                  {isLoading ? "⏳ Running Batch..." : "▶▶ Execute Batch"}
                </button>
              </div>

              {batchResults && <BatchResultsView results={batchResults} />}
            </>
          )}

          {/* ─── History Tab ───────────────────────────────── */}
          {tab === "history" && (
            <div>
              {history.length === 0 ? (
                <p style={{ color: "rgba(200,210,230,0.3)", fontSize: 12, textAlign: "center", padding: 32 }}>
                  No pipeline runs yet. Execute a single or batch run to see results here.
                </p>
              ) : (
                history.map((r, i) => (
                  <div key={r.sessionId} style={{
                    marginBottom: 12, padding: "12px 14px",
                    background: "rgba(20,30,50,0.6)", border: "1px solid rgba(100,150,200,0.1)",
                    borderRadius: 8,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "#e0e8f0", fontWeight: 600 }}>
                        Run #{history.length - i}
                      </span>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 4,
                        background: r.status === "completed" ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                        color: r.status === "completed" ? "#4ade80" : "#f87171",
                      }}>
                        {r.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(200,210,230,0.4)", marginBottom: 6 }}>
                      {r.nodeCount} nodes traversed · Session {r.sessionId.slice(0, 8)}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(200,210,230,0.5)" }}>
                      Inputs: {Object.entries(r.context).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ")}
                    </div>
                    {r.finalResult && (
                      <div style={{
                        marginTop: 8, padding: "8px 10px",
                        background: "rgba(10,20,40,0.6)", borderRadius: 6,
                        fontSize: 11, color: "#e0e8f0", maxHeight: 120, overflowY: "auto",
                        whiteSpace: "pre-wrap",
                      }}>
                        {r.finalResult.slice(0, 500)}{r.finalResult.length > 500 ? "..." : ""}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Weights */}
      <div style={{
        width: 380, borderLeft: "1px solid rgba(100,150,200,0.15)", padding: 16,
        display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto",
      }}>
        <h3 style={{ fontSize: 13, color: "#e0e8f0", margin: "0 0 4px 0" }}>⚖️ Decision Weights</h3>
        <p style={{ fontSize: 10, color: "rgba(200,210,230,0.4)", marginBottom: 12, textAlign: "center" }}>
          Weights influence how decision nodes resolve ambiguous branches.
        </p>
        <WeightsRadar
          dimensions={weights}
          onChange={setWeights}
          profiles={buildProfiles(treeWeights)}
          onProfileSelect={(p: WeightProfile) => setWeights(p.dimensions)}
          size={340}
          interactive={true}
        />
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────

/** A single form field for a pipeline input */
const FieldInput: React.FC<{
  field: PipelineField;
  value: unknown;
  onChange: (v: unknown) => void;
}> = ({ field, value, onChange }) => {
  return (
    <div style={{
      padding: "10px 12px", background: "rgba(20,30,50,0.6)",
      border: "1px solid rgba(100,150,200,0.1)", borderRadius: 8,
    }}>
      <label style={{ display: "block", fontSize: 11, color: "#e0e8f0", fontWeight: 600, marginBottom: 2 }}>
        {field.label}
        {field.required && <span style={{ color: "#f87171", marginLeft: 4 }}>*</span>}
      </label>
      <div style={{ fontSize: 9, color: "rgba(200,210,230,0.35)", marginBottom: 6 }}>
        {field.prompt}
      </div>

      {field.inputType === "image" ? (
        <div>
          {value && typeof value === "string" && value.startsWith("data:image/") ? (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <img
                src={value as string}
                alt="Uploaded"
                style={{ maxWidth: "100%", maxHeight: 120, borderRadius: 4, display: "block" }}
              />
              <button
                onClick={() => onChange("")}
                style={{
                  padding: "4px 8px", border: "1px solid rgba(248,113,113,0.3)",
                  background: "rgba(248,113,113,0.1)", borderRadius: 4,
                  color: "#f87171", fontSize: 10, cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <label style={{
              display: "block", padding: "12px 8px", textAlign: "center",
              background: "rgba(70,200,255,0.06)", border: "2px dashed rgba(70,200,255,0.25)",
              borderRadius: 6, color: "#4ea8de", fontSize: 11, cursor: "pointer",
            }}>
              📷 Upload image
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => onChange(reader.result as string);
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      ) : field.inputType === "multiselect" && field.choices ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {field.choices.map((c) => {
            const selected = Array.isArray(value) ? value.includes(c) : false;
            return (
              <button
                key={c}
                onClick={() => {
                  const cur = Array.isArray(value) ? value : [];
                  onChange(selected ? cur.filter((v: string) => v !== c) : [...cur, c]);
                }}
                style={{
                  padding: "5px 12px",
                  background: selected ? "rgba(70,200,255,0.25)" : "rgba(20,30,50,0.6)",
                  border: `1px solid ${selected ? "rgba(70,200,255,0.6)" : "rgba(100,150,200,0.2)"}`,
                  borderRadius: 6,
                  color: selected ? "#4ea8de" : "rgba(200,210,230,0.5)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {selected ? "✓ " : ""}{c}
              </button>
            );
          })}
        </div>
      ) : field.inputType === "choice" && field.choices ? (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          style={selectStyle}
        >
          {field.choices.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      ) : field.inputType === "boolean" ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onChange(true)}
            style={{
              ...toggleBtnStyle,
              background: value === true ? "rgba(74,222,128,0.2)" : "rgba(20,30,50,0.6)",
              borderColor: value === true ? "rgba(74,222,128,0.5)" : "rgba(100,150,200,0.2)",
              color: value === true ? "#4ade80" : "rgba(200,210,230,0.5)",
            }}
          >
            ✓ Accept
          </button>
          <button
            onClick={() => onChange(false)}
            style={{
              ...toggleBtnStyle,
              background: value === false ? "rgba(248,113,113,0.2)" : "rgba(20,30,50,0.6)",
              borderColor: value === false ? "rgba(248,113,113,0.5)" : "rgba(100,150,200,0.2)",
              color: value === false ? "#f87171" : "rgba(200,210,230,0.5)",
            }}
          >
            ✕ Reject
          </button>
        </div>
      ) : field.inputType === "number" ? (
        <input
          type="number"
          value={String(value ?? "")}
          onChange={(e) => onChange(Number(e.target.value))}
          style={inputStyle}
        />
      ) : (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      )}
    </div>
  );
};

/** Execution trace + result display */
const PipelineResultView = React.forwardRef<HTMLDivElement, { result: PipelineResult }>(
  ({ result }, ref) => (
    <div ref={ref} style={{ marginTop: 8 }}>
      {/* Summary bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
        padding: "10px 14px", borderRadius: 8,
        background: result.status === "completed" ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
        border: `1px solid ${result.status === "completed" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
      }}>
        <span style={{
          fontSize: 11, padding: "3px 10px", borderRadius: 4, fontWeight: 600,
          background: result.status === "completed" ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
          color: result.status === "completed" ? "#4ade80" : "#f87171",
        }}>
          {result.status === "completed" ? "✓ Completed" : result.status}
        </span>
        <span style={{ fontSize: 10, color: "rgba(200,210,230,0.4)" }}>
          {result.nodeCount} nodes traversed
        </span>
        <span style={{ fontSize: 10, color: "rgba(200,210,230,0.3)", marginLeft: "auto" }}>
          {result.sessionId.slice(0, 8)}
        </span>
      </div>

      {/* Execution trace */}
      <div style={{ marginBottom: 12 }}>
        <h4 style={{ fontSize: 11, color: "rgba(200,210,230,0.5)", margin: "0 0 8px 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Execution Trace
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {result.trace.map((entry, i) => (
            <TraceNode key={i} entry={entry} index={i} isLast={i === result.trace.length - 1} />
          ))}
        </div>
      </div>

      {/* Final result */}
      {result.finalResult && (
        <div style={{ marginBottom: 12 }}>
          <h4 style={{ fontSize: 11, color: "rgba(200,210,230,0.5)", margin: "0 0 8px 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Result
          </h4>
          <div style={{
            padding: "14px 16px", background: "rgba(20,30,50,0.8)",
            border: "1px solid rgba(74,222,128,0.15)", borderRadius: 8,
            fontSize: 12, color: "#e0e8f0", whiteSpace: "pre-wrap", lineHeight: 1.6,
            maxHeight: 400, overflowY: "auto",
          }}>
            {result.finalResult}
          </div>
        </div>
      )}

      {/* Context dump */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ fontSize: 10, color: "rgba(200,210,230,0.3)", cursor: "pointer" }}>
          Collected Context ({Object.keys(result.context).length} variables)
        </summary>
        <pre style={{
          marginTop: 6, padding: 12, background: "rgba(10,20,40,0.6)", borderRadius: 6,
          fontSize: 10, color: "rgba(200,210,230,0.5)", overflow: "auto",
        }}>
          {JSON.stringify(result.context, null, 2)}
        </pre>
      </details>
    </div>
  )
);

/** A single node in the execution trace */
const TraceNode: React.FC<{ entry: PipelineTraceEntry; index: number; isLast: boolean }> = ({
  entry, index, isLast,
}) => {
  const typeColors: Record<string, string> = {
    input: "#4ea8de",
    assumption: "#fbbf24",
    decision: "#4ade80",
    action: "#f87171",
  };
  const color = typeColors[entry.nodeType] ?? "#888";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      {/* Connector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20 }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
          background: isLast ? color : "transparent",
          border: `2px solid ${color}`,
        }} />
        {!isLast && <div style={{ width: 1, height: 24, background: "rgba(100,150,200,0.15)" }} />}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 8, padding: "1px 5px", borderRadius: 3, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.05em",
            background: `${color}22`, color, border: `1px solid ${color}44`,
          }}>
            {entry.nodeType}
          </span>
          <span style={{ fontSize: 11, color: "#e0e8f0" }}>{entry.label}</span>
        </div>
        {entry.inputUsed !== undefined && (
          <div style={{ fontSize: 10, color: "rgba(200,210,230,0.4)", marginTop: 2 }}>
            → {JSON.stringify(entry.inputUsed)}
          </div>
        )}
      </div>
    </div>
  );
};

/** Batch results summary */
const BatchResultsView: React.FC<{ results: any }> = ({ results }) => (
  <div>
    <div style={{
      display: "flex", gap: 16, marginBottom: 12, padding: "10px 14px",
      background: "rgba(20,30,50,0.6)", borderRadius: 8,
      border: "1px solid rgba(100,150,200,0.1)",
    }}>
      <Stat label="Total" value={results.totalRuns} color="#e0e8f0" />
      <Stat label="Succeeded" value={results.successful} color="#4ade80" />
      <Stat label="Failed" value={results.failed} color="#f87171" />
    </div>

    {results.results.map((r: any, i: number) => (
      <div key={i} style={{
        marginBottom: 8, padding: "10px 12px",
        background: "rgba(20,30,50,0.4)", borderRadius: 6,
        border: `1px solid ${r.error ? "rgba(248,113,113,0.2)" : "rgba(100,150,200,0.08)"}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#e0e8f0", fontWeight: 600 }}>Run #{i + 1}</span>
          {r.error ? (
            <span style={{ fontSize: 10, color: "#f87171" }}>Error: {r.error}</span>
          ) : (
            <span style={{ fontSize: 10, color: "#4ade80" }}>
              ✓ {r.nodeCount} nodes → {r.trace[r.trace.length - 1]?.label ?? "done"}
            </span>
          )}
        </div>
        {r.finalResult && (
          <div style={{
            marginTop: 6, fontSize: 10, color: "rgba(200,210,230,0.5)",
            maxHeight: 60, overflowY: "auto", whiteSpace: "pre-wrap",
          }}>
            {r.finalResult.slice(0, 300)}{r.finalResult.length > 300 ? "..." : ""}
          </div>
        )}
      </div>
    ))}
  </div>
);

const Stat: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 9, color: "rgba(200,210,230,0.4)", textTransform: "uppercase" }}>{label}</div>
  </div>
);

// ─── CSV Parsing ─────────────────────────────────────────────

function parseCsv(csv: string, fields: PipelineField[]): Record<string, unknown>[] {
  const lines = csv.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, unknown>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const field = fields.find((f) => f.variableName === headers[j]);
      let val: unknown = values[j] ?? "";
      if (field?.inputType === "boolean") {
        val = val === "true" || val === "1" || val === "yes";
      } else if (field?.inputType === "number") {
        val = Number(val);
      }
      row[headers[j]] = val;
    }
    rows.push(row);
  }

  return rows;
}

// ─── Shared Styles ───────────────────────────────────────────

const closeBtnStyle: React.CSSProperties = {
  background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.3)",
  color: "#f87171", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 11,
};

const runBtnStyle: React.CSSProperties = {
  padding: "10px 28px",
  background: "linear-gradient(135deg, #1a3a5a, #1e5a80)",
  border: "1px solid rgba(78,168,222,0.5)",
  borderRadius: 8, color: "#4ea8de", fontSize: 13, fontWeight: 600, cursor: "pointer",
  boxShadow: "0 0 20px rgba(78,168,222,0.1)",
};

const smallBtnStyle: React.CSSProperties = {
  padding: "4px 10px", fontSize: 10, background: "rgba(70,200,255,0.08)",
  border: "1px solid rgba(70,200,255,0.2)", borderRadius: 4, color: "#4ea8de",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 10px", background: "rgba(10,20,40,0.8)",
  border: "1px solid rgba(100,150,200,0.2)", borderRadius: 6, color: "#e0e8f0",
  fontSize: 12, outline: "none", boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  width: "100%", padding: "6px 10px", background: "rgba(10,20,40,0.8)",
  border: "1px solid rgba(100,150,200,0.2)", borderRadius: 6, color: "#e0e8f0",
  fontSize: 12, outline: "none", boxSizing: "border-box",
};

const toggleBtnStyle: React.CSSProperties = {
  flex: 1, padding: "5px 10px", border: "1px solid rgba(100,150,200,0.2)",
  borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
};

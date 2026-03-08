/**
 * TreeRunner — Conversational interface for running a decision tree.
 * Shows the chat-like interaction with a right-side panel combining
 * decision weights (collapsible up) and node progress graph (below).
 * When a node uses specific weights, only those weights are shown inline.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { WeightsRadar } from "./WeightsRadar";
import { CollapsiblePanel } from "./CollapsiblePanel";
import { NodeProgressPanel } from "./NodeProgressPanel";
import type { DecisionTree, StepResponse, WeightDimension, WeightProfile } from "../types";
import * as api from "../api";
import { buildProfiles, getTreeWeights } from "../weight-utils";

interface TreeRunnerProps {
  tree: DecisionTree;
  onClose: () => void;
}

interface ChatMessage {
  role: "assistant" | "user" | "system";
  content: string;
  nodeType?: string;
  choices?: string[];
  inputType?: string;
  weightExplanation?: string;
}

export const TreeRunner: React.FC<TreeRunnerProps> = ({ tree, onClose }) => {
  const treeWeights = getTreeWeights(tree);
  const [weights, setWeights] = useState<WeightDimension[]>(treeWeights);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<StepResponse | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [multiSelectChoices, setMultiSelectChoices] = useState<string[]>([]);
  const [visitedNodeIds, setVisitedNodeIds] = useState<Set<string>>(new Set());
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [weightsExpanded, setWeightsExpanded] = useState(true);
  const [expandedWeightId, setExpandedWeightId] = useState<string | null>(null);
  const [scaffoldMarkdown, setScaffoldMarkdown] = useState<string | null>(null);
  const [scaffoldDir, setScaffoldDir] = useState("");
  const [scaffoldSaving, setScaffoldSaving] = useState(false);
  const [scaffoldResult, setScaffoldResult] = useState<{ success: boolean; filesWritten?: string[]; error?: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /** Which weight dimension IDs does the current active node reference? */
  const activeNodeWeightIds = useMemo(() => {
    if (!activeNodeId) return new Set<string>();
    const node = tree.nodes.find((n) => n.id === activeNodeId);
    if (!node) return new Set<string>();
    const ids = new Set<string>();
    node.weightInfluence?.forEach((w) => ids.add(w.dimension));
    node.weightBias?.forEach((w) => ids.add(w.dimension));
    return ids;
  }, [activeNodeId, tree.nodes]);

  /** Auto-collapse weights to "node-relevant" view once a session starts
   *  — triggered from handleStart with a delay so the user sees the slide animation */
  const weightsCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Convert a picked file to a base64 data-URL and stage it */
  const handleImageSelect = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  /** Submit the staged image */
  const handleImageSubmit = useCallback(() => {
    if (!imagePreview) return;
    handleSubmit(imagePreview);
    setImagePreview(null);
  }, [imagePreview]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Start the tree run
  const handleStart = async () => {
    setIsLoading(true);
    try {
      const result = await api.startSession(tree.id, weights);
      setSessionId(result.sessionId);
      setCurrentStep(result.step);
      setActiveNodeId(result.step.nodeId);
      setVisitedNodeIds(new Set([result.step.nodeId]));
      setMessages([
        { role: "system", content: result.narration },
        {
          role: "assistant",
          content: result.step.message,
          nodeType: result.step.nodeType,
          choices: result.step.choices,
          inputType: result.step.inputType,
          weightExplanation: result.step.weightExplanation,
        },
      ]);
      if (result.step.isTerminal) setIsComplete(true);
      // Animate weights panel collapse after a short pause so user sees it slide
      weightsCollapseTimerRef.current = setTimeout(() => setWeightsExpanded(false), 600);
    } catch (err) {
      setMessages([{ role: "system", content: `Error starting tree: ${err}` }]);
    }
    setIsLoading(false);
  };

  // Submit user response
  const handleSubmit = async (value: unknown) => {
    if (!sessionId || isComplete) return;
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: String(value) }]);
    setInputValue("");

    try {
      const result = await api.advanceSession(sessionId, tree.id, value);
      setCurrentStep(result.step);
      setActiveNodeId(result.step.nodeId);
      setVisitedNodeIds((prev) => new Set([...prev, result.step.nodeId]));

      const newMsgs: typeof messages = [];

      // Narration
      if (result.narration && result.narration !== result.step.message) {
        newMsgs.push({ role: "system" as const, content: result.narration });
      }

      // Step message (for action nodes with results, omit choices from the label message)
      newMsgs.push({
        role: "assistant" as const,
        content: result.step.message,
        nodeType: result.step.nodeType,
        choices: result.step.result ? undefined : result.step.choices,
        inputType: result.step.inputType,
        weightExplanation: result.step.weightExplanation,
      });

      // Show result for all action nodes (terminal OR feedback-loop)
      if (result.step.result) {
        newMsgs.push({
          role: "assistant" as const,
          content: result.step.result,
          // Attach feedback choices to the result message so buttons appear under the diagnosis
          choices: result.step.isTerminal ? undefined : result.step.choices,
        });
        // Capture for scaffold save if it contains file annotations
        if (result.step.nodeType === "action" && result.step.result.includes("// file:")) {
          setScaffoldMarkdown(result.step.result);
        }
      }

      setMessages((prev) => [...prev, ...newMsgs]);

      if (result.step.isTerminal && !result.step.isGenerating) {
        setIsComplete(true);
      }

      // If SDK is generating asynchronously, poll for the result
      if (result.step.isGenerating) {
        setMessages((prev) => [
          ...prev,
          { role: "system" as const, content: "⏳ Copilot is generating..." },
        ]);

        const pollForResult = async () => {
          const maxAttempts = 150; // 5 min at 2s intervals
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const pending = await api.getPendingResult(sessionId);
            if (pending.status === "done" || pending.status === "error") {
              const resultText = pending.result ?? "No response from Copilot";
              // Capture for scaffold save if it contains file annotations
              if (resultText.includes("// file:") || resultText.includes("# file:")) {
                setScaffoldMarkdown(resultText);
              }
              // Remove the "generating" message and add the real result
              setMessages((prev) => {
                const filtered = prev.filter((m) => m.content !== "⏳ Copilot is generating...");
                return [
                  ...filtered,
                  {
                    role: "assistant" as const,
                    content: resultText,
                    choices: result.step.isTerminal ? undefined : result.step.choices,
                  },
                ];
              });
              if (result.step.isTerminal) {
                setIsComplete(true);
              }
              return;
            }
          }
          // Timed out
          setMessages((prev) => {
            const filtered = prev.filter((m) => m.content !== "⏳ Copilot is generating...");
            return [...filtered, { role: "system" as const, content: "⚠️ Copilot generation timed out." }];
          });
        };
        pollForResult().finally(() => setIsLoading(false));
        return; // Don't setIsLoading(false) below — polling handles it
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "system", content: `Error: ${err}` }]);
    }
    setIsLoading(false);
  };

  // Handle weight changes mid-session
  const handleWeightChange = async (newWeights: WeightDimension[]) => {
    setWeights(newWeights);
    if (sessionId) {
      try {
        await api.updateSessionWeights(sessionId, newWeights);
      } catch { /* not critical */ }
    }
  };

  const handleProfileSelect = (profile: WeightProfile) => {
    handleWeightChange(profile.dimensions);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(5,5,15,0.95)",
        zIndex: 1000,
        display: "flex",
      }}
    >
      {/* Left: Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header bar */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(100,150,200,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ fontSize: 14, color: "#e0e8f0", margin: 0 }}>
              ▶ Running: {tree.name}
            </h2>
            <p style={{ fontSize: 10, color: "rgba(200,210,230,0.4)", margin: 0 }}>
              {tree.description}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(248,113,113,0.15)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "#f87171",
              padding: "6px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Pre-run: show start button if no session */}
        {!sessionId && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
            <p style={{ color: "rgba(200,210,230,0.6)", fontSize: 13 }}>
              Adjust the decision weights on the right, then start the tree.
            </p>
            <button
              onClick={handleStart}
              disabled={isLoading}
              style={{
                padding: "12px 32px",
                background: "linear-gradient(135deg, #1a4a2a, #1e6a40)",
                border: "1px solid rgba(74,222,128,0.5)",
                borderRadius: 8,
                color: "#4ade80",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 0 20px rgba(74,222,128,0.15)",
              }}
            >
              {isLoading ? "Starting..." : "▶ Start Decision Tree"}
            </button>
          </div>
        )}

        {/* Chat messages */}
        {sessionId && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 12,
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "10px 14px",
                      borderRadius: 10,
                      background:
                        msg.role === "user"
                          ? "rgba(70,200,255,0.15)"
                          : msg.role === "system"
                            ? "rgba(100,100,120,0.1)"
                            : "rgba(30,40,60,0.8)",
                      border:
                        msg.role === "user"
                          ? "1px solid rgba(70,200,255,0.3)"
                          : "1px solid rgba(100,150,200,0.1)",
                      fontSize: 13,
                      color: msg.role === "system" ? "rgba(200,210,230,0.5)" : "#e0e8f0",
                      fontStyle: msg.role === "system" ? "italic" : "normal",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.content.startsWith("data:image/") ? (
                      <img
                        src={msg.content}
                        alt="Uploaded image"
                        style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6, display: "block" }}
                      />
                    ) : (
                      msg.content
                    )}

                    {/* Weight explanation callout */}
                    {msg.weightExplanation && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: "6px 10px",
                          background: "rgba(240,192,64,0.08)",
                          border: "1px solid rgba(240,192,64,0.2)",
                          borderRadius: 6,
                          fontSize: 11,
                          color: "rgba(240,220,160,0.7)",
                        }}
                      >
                        ⚖️ Weight Influence:
                        <br />
                        {msg.weightExplanation}
                      </div>
                    )}

                    {/* Choice / multiselect buttons */}
                    {msg.choices && msg.choices.length > 0 && msg.inputType === "multiselect" && !isComplete && i === messages.length - 1 ? (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {msg.choices.map((c) => {
                            const selected = multiSelectChoices.includes(c);
                            return (
                              <button
                                key={c}
                                onClick={() => setMultiSelectChoices((prev) =>
                                  selected ? prev.filter((v) => v !== c) : [...prev, c]
                                )}
                                disabled={isLoading}
                                style={{
                                  padding: "5px 12px",
                                  background: selected ? "rgba(70,200,255,0.25)" : "rgba(70,200,255,0.05)",
                                  border: `1px solid ${selected ? "rgba(70,200,255,0.6)" : "rgba(70,200,255,0.2)"}`,
                                  borderRadius: 6,
                                  color: selected ? "#4ea8de" : "rgba(78,168,222,0.6)",
                                  fontSize: 11,
                                  cursor: "pointer",
                                }}
                              >
                                {selected ? "✓ " : ""}{c}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => {
                            const val = multiSelectChoices.join(", ");
                            setMultiSelectChoices([]);
                            handleSubmit(val);
                          }}
                          disabled={isLoading || multiSelectChoices.length === 0}
                          style={{
                            marginTop: 8,
                            padding: "6px 18px",
                            background: multiSelectChoices.length > 0 ? "rgba(74,222,128,0.15)" : "rgba(20,30,50,0.6)",
                            border: `1px solid ${multiSelectChoices.length > 0 ? "rgba(74,222,128,0.4)" : "rgba(100,150,200,0.15)"}`,
                            borderRadius: 6,
                            color: multiSelectChoices.length > 0 ? "#4ade80" : "rgba(200,210,230,0.3)",
                            fontSize: 11,
                            cursor: multiSelectChoices.length > 0 ? "pointer" : "default",
                          }}
                        >
                          Confirm {multiSelectChoices.length > 0 ? `(${multiSelectChoices.length})` : ""} →
                        </button>
                      </div>
                    ) : msg.choices && msg.choices.length > 0 ? (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {msg.choices.map((c) => (
                          <button
                            key={c}
                            onClick={() => handleSubmit(c)}
                            disabled={isLoading}
                            style={{
                              padding: "5px 12px",
                              background: "rgba(70,200,255,0.1)",
                              border: "1px solid rgba(70,200,255,0.3)",
                              borderRadius: 6,
                              color: "#4ea8de",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {/* Assumption confirm/reject */}
                    {msg.nodeType === "assumption" && !isComplete && i === messages.length - 1 && (
                      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                        <button
                          onClick={() => handleSubmit(true)}
                          disabled={isLoading}
                          style={{
                            padding: "5px 14px",
                            background: "rgba(74,222,128,0.12)",
                            border: "1px solid rgba(74,222,128,0.3)",
                            borderRadius: 6,
                            color: "#4ade80",
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => handleSubmit(false)}
                          disabled={isLoading}
                          style={{
                            padding: "5px 14px",
                            background: "rgba(248,113,113,0.12)",
                            border: "1px solid rgba(248,113,113,0.3)",
                            borderRadius: 6,
                            color: "#f87171",
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div style={{ color: "rgba(70,200,255,0.5)", fontSize: 12, padding: 8 }}>
                  ● ● ● thinking...
                </div>
              )}

              {isComplete && (
                <div
                  style={{
                    borderTop: "1px solid rgba(100,150,200,0.1)",
                    marginTop: 8,
                    padding: 16,
                  }}
                >
                  <div style={{ textAlign: "center", color: "rgba(74,222,128,0.6)", fontSize: 12, marginBottom: scaffoldMarkdown ? 12 : 0 }}>
                    ✓ Decision tree complete
                  </div>

                  {scaffoldMarkdown && (
                    <div
                      style={{
                        background: "rgba(30,60,90,0.3)",
                        border: "1px solid rgba(70,200,255,0.2)",
                        borderRadius: 8,
                        padding: 14,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#7dd3fc", marginBottom: 10 }}>
                        💾 Save Scaffold to Disk
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="text"
                          value={scaffoldDir}
                          onChange={(e) => setScaffoldDir(e.target.value)}
                          placeholder="Target folder (e.g. C:\projects\deploy-pilot)"
                          style={{
                            flex: 1,
                            background: "rgba(15,25,40,0.8)",
                            border: "1px solid rgba(100,150,200,0.2)",
                            borderRadius: 6,
                            padding: "8px 12px",
                            color: "#e2e8f0",
                            fontSize: 13,
                            outline: "none",
                          }}
                        />
                        <button
                          onClick={async () => {
                            if (!scaffoldDir.trim()) return;
                            setScaffoldSaving(true);
                            setScaffoldResult(null);
                            try {
                              const res = await api.saveScaffold(scaffoldMarkdown, scaffoldDir.trim(), true);
                              setScaffoldResult(res);
                            } catch (err) {
                              setScaffoldResult({ success: false, error: String(err) });
                            }
                            setScaffoldSaving(false);
                          }}
                          disabled={scaffoldSaving || !scaffoldDir.trim()}
                          style={{
                            padding: "8px 16px",
                            background: scaffoldSaving ? "rgba(100,150,200,0.2)" : "rgba(34,197,94,0.2)",
                            border: `1px solid ${scaffoldSaving ? "rgba(100,150,200,0.3)" : "rgba(34,197,94,0.4)"}`,
                            borderRadius: 6,
                            color: scaffoldSaving ? "rgba(200,220,240,0.5)" : "#4ade80",
                            cursor: scaffoldSaving ? "wait" : "pointer",
                            fontSize: 13,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {scaffoldSaving ? "Saving..." : "Save & Open in VS Code"}
                        </button>
                      </div>

                      {scaffoldResult && (
                        <div style={{ marginTop: 10, fontSize: 12 }}>
                          {scaffoldResult.success ? (
                            <div style={{ color: "#4ade80" }}>
                              ✓ {scaffoldResult.filesWritten?.length} files written — opening in VS Code
                              <div style={{ marginTop: 4, color: "rgba(200,220,240,0.5)" }}>
                                {scaffoldResult.filesWritten?.map((f) => (
                                  <div key={f}>📄 {f}</div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: "#f87171" }}>✗ {scaffoldResult.error}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar — text or image upload depending on current step type */}
            {sessionId && !isComplete && currentStep && !currentStep.choices?.length && currentStep.nodeType !== "assumption" && (
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid rgba(100,150,200,0.15)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* Image upload mode */}
                {currentStep.inputType === "image" ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageSelect(file);
                        e.target.value = "";
                      }}
                    />
                    {imagePreview ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                        <div style={{
                          flex: 1, padding: 8, background: "rgba(20,30,50,0.8)",
                          border: "1px solid rgba(100,150,200,0.2)", borderRadius: 6,
                        }}>
                          <img
                            src={imagePreview}
                            alt="Preview"
                            style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 4, display: "block" }}
                          />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <button
                            onClick={handleImageSubmit}
                            disabled={isLoading}
                            style={{
                              padding: "8px 16px",
                              background: "rgba(74,222,128,0.15)",
                              border: "1px solid rgba(74,222,128,0.3)",
                              borderRadius: 6, color: "#4ade80", cursor: "pointer", fontSize: 12,
                            }}
                          >
                            Upload →
                          </button>
                          <button
                            onClick={() => setImagePreview(null)}
                            style={{
                              padding: "8px 16px",
                              background: "rgba(248,113,113,0.1)",
                              border: "1px solid rgba(248,113,113,0.2)",
                              borderRadius: 6, color: "#f87171", cursor: "pointer", fontSize: 11,
                            }}
                          >
                            ✕ Clear
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isLoading}
                          style={{
                            flex: 1, padding: "14px 16px",
                            background: "rgba(70,200,255,0.08)",
                            border: "2px dashed rgba(70,200,255,0.3)",
                            borderRadius: 8, color: "#4ea8de", cursor: "pointer", fontSize: 13,
                            textAlign: "center",
                          }}
                        >
                          📷 Click to upload an image (waveform, screenshot, etc.)
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  /* Standard text input */
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && inputValue.trim() && handleSubmit(inputValue.trim())}
                      placeholder="Type your response..."
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        background: "rgba(20,30,50,0.8)",
                        border: "1px solid rgba(100,150,200,0.2)",
                        borderRadius: 6,
                        color: "#e0e8f0",
                        fontSize: 13,
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={() => inputValue.trim() && handleSubmit(inputValue.trim())}
                      disabled={isLoading || !inputValue.trim()}
                      style={{
                        padding: "8px 16px",
                        background: "rgba(70,200,255,0.15)",
                        border: "1px solid rgba(70,200,255,0.3)",
                        borderRadius: 6,
                        color: "#4ea8de",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Send →
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right: Combined panel — Weights (top, collapsible) + Node Progress (bottom) */}
      <CollapsiblePanel
        title="Workflow"
        icon="🔗"
        side="right"
        defaultWidth={520}
        minWidth={360}
        maxWidth={720}
        defaultCollapsed={false}
        noPadding
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* ── Weights section (collapses up) ────────────── */}
          <div
            style={{
              borderBottom: "1px solid rgba(100,150,200,0.12)",
              flexShrink: 0,
            }}
          >
            {/* Toggle header */}
            <div
              onClick={() => setWeightsExpanded(!weightsExpanded)}
              style={{
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                userSelect: "none",
                background: "rgba(15,20,35,0.4)",
              }}
            >
              <span style={{ fontSize: 12 }}>⚖️</span>
              <span style={{ fontSize: 11, color: "#e0e8f0", fontWeight: 600, flex: 1 }}>
                Decision Weights
              </span>
              <span style={{ fontSize: 10, color: "rgba(200,210,230,0.4)" }}>
                {weightsExpanded ? "▲" : "▼"}
              </span>
            </div>

            {/* Expanded: full radar + all sliders — animated height */}
            <div
              style={{
                maxHeight: weightsExpanded ? 800 : 0,
                overflow: "hidden",
                transition: "max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease",
                opacity: weightsExpanded ? 1 : 0,
              }}
            >
              <div style={{ padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <p style={{ fontSize: 10, color: "rgba(200,210,230,0.4)", marginBottom: 10, textAlign: "center" }}>
                  Adjust weights to influence AI decisions in real-time.
                </p>
                <WeightsRadar
                  dimensions={weights}
                  onChange={handleWeightChange}
                  profiles={buildProfiles(treeWeights)}
                  onProfileSelect={handleProfileSelect}
                  size={Math.min(380, 380)}
                  interactive={true}
                />
              </div>
            </div>

            {/* Collapsed: weight pills — active ones lit, accordion slider */}
            <div
              style={{
                maxHeight: !weightsExpanded ? 600 : 0,
                overflow: "hidden",
                transition: "max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s, opacity 0.4s ease 0.15s",
                opacity: !weightsExpanded ? 1 : 0,
              }}
            >
              <div style={{ padding: "6px 12px 10px" }}>
                {/* Pills row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                  {weights.map((w) => {
                    const isActive = activeNodeWeightIds.has(w.id);
                    const isOpen = expandedWeightId === w.id;
                    return (
                      <div
                        key={w.id}
                        onClick={() => setExpandedWeightId((prev) => prev === w.id ? null : w.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 8px",
                          background: isOpen ? `${w.color}22` : isActive ? `${w.color}18` : "rgba(30,40,60,0.4)",
                          borderRadius: 4,
                          border: `1px solid ${isOpen ? `${w.color}aa` : isActive ? `${w.color}88` : "rgba(100,150,200,0.1)"}`,
                          cursor: "pointer",
                          userSelect: "none",
                          opacity: isActive || isOpen ? 1 : 0.45,
                          transition: "opacity 0.3s ease, border-color 0.3s ease, background 0.3s ease",
                        }}
                      >
                        <span style={{ fontSize: 9 }}>{w.icon || "⚖️"}</span>
                        <span style={{ fontSize: 9, color: isActive || isOpen ? w.color : "rgba(200,210,230,0.5)", fontWeight: 600 }}>
                          {w.label}
                        </span>
                        <span style={{ fontSize: 9, color: isActive || isOpen ? "rgba(200,210,230,0.7)" : "rgba(200,210,230,0.35)" }}>
                          {w.value}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Full-width accordion slider — only one open at a time */}
                {weights.map((w) => {
                  const isOpen = expandedWeightId === w.id;
                  return (
                    <div
                      key={w.id}
                      style={{
                        maxHeight: isOpen ? 60 : 0,
                        overflow: "hidden",
                        transition: "max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    >
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 4px 6px",
                      }}>
                        <span style={{ fontSize: 11, minWidth: 20 }}>{w.icon || "⚖️"}</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={w.value}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            handleWeightChange(
                              weights.map((d) => (d.id === w.id ? { ...d, value: val } : d))
                            );
                          }}
                          style={{ flex: 1, accentColor: w.color, height: 6 }}
                        />
                        <span style={{
                          fontSize: 13,
                          color: w.color,
                          fontWeight: 700,
                          minWidth: 30,
                          textAlign: "right",
                        }}>
                          {w.value}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Node Progress graph (fills remaining space) ── */}
          {sessionId ? (
            <div style={{ flex: 1, minHeight: 0 }}>
              <NodeProgressPanel
                nodes={tree.nodes}
                edges={tree.edges}
                rootNodeId={tree.rootNodeId}
                activeNodeId={activeNodeId}
                visitedNodeIds={visitedNodeIds}
              />
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(200,210,230,0.3)", fontSize: 11 }}>
              Start the tree to see node progress
            </div>
          )}
        </div>
      </CollapsiblePanel>
    </div>
  );
};

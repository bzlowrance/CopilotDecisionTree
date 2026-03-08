/**
 * AuthPanel — Displays current GitHub Copilot SDK credentials,
 * allows switching auth method, and shows available models.
 */

import React, { useState, useEffect, useCallback } from "react";
import type { AuthStatus, ModelInfo } from "../types";
import * as api from "../api";

export const AuthPanel: React.FC = () => {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Config form state
  const [tokenInput, setTokenInput] = useState("");
  const [useLoggedIn, setUseLoggedIn] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await api.getAuthStatus();
      setAuth(status);
      setUseLoggedIn(status.config?.useLoggedInUser ?? true);
      setSelectedModel(status.config?.model ?? "gpt-4o");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check auth");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const m = await api.listModels();
      setModels(m);
    } catch {
      // Models list is optional
    }
  }, []);

  useEffect(() => {
    refresh();
    loadModels();
  }, [refresh, loadModels]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const config: Record<string, unknown> = {
        useLoggedInUser: useLoggedIn,
        model: selectedModel,
      };
      if (tokenInput.trim()) {
        config.githubToken = tokenInput.trim();
        config.useLoggedInUser = false;
      } else if (useLoggedIn) {
        config.githubToken = "";
      }
      const status = await api.configureAuth(config as any);
      setAuth(status);
      setTokenInput("");
      // Refresh models after credential change
      loadModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const statusColor = auth?.isAuthenticated ? "#4ade80" : "#f87171";
  const statusIcon = auth?.isAuthenticated ? "●" : "○";

  return (
    <div
      style={{
        borderTop: "1px solid rgba(100,150,200,0.1)",
        background: "rgba(8,12,20,0.6)",
      }}
    >
      {/* Compact header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "8px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "#c0c8d8",
          fontSize: 11,
        }}
      >
        <span style={{ color: statusColor, fontSize: 10 }}>{statusIcon}</span>
        <span style={{ flex: 1, textAlign: "left" }}>
          {loading
            ? "Checking auth…"
            : auth?.isAuthenticated
              ? `${auth.login ?? "Authenticated"}`
              : "Not authenticated"}
        </span>
        <span style={{ fontSize: 9, color: "rgba(150,160,180,0.5)" }}>
          {auth?.authType ?? ""}
        </span>
        <span style={{ fontSize: 10, transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
          ▾
        </span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ padding: "4px 14px 12px" }}>
          {/* Current status */}
          <div
            style={{
              padding: "8px 10px",
              background: auth?.isAuthenticated ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)",
              border: `1px solid ${auth?.isAuthenticated ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
              borderRadius: 6,
              marginBottom: 10,
              fontSize: 10,
              color: "rgba(200,210,230,0.7)",
            }}
          >
            {auth?.isAuthenticated ? (
              <>
                <div><strong style={{ color: "#4ade80" }}>✓ Authenticated</strong></div>
                {auth.login && <div style={{ marginTop: 2 }}>User: <strong style={{ color: "#e0e8f0" }}>{auth.login}</strong></div>}
                {auth.authType && <div style={{ marginTop: 2 }}>Method: {auth.authType}</div>}
                {auth.host && <div style={{ marginTop: 2 }}>Host: {auth.host}</div>}
              </>
            ) : (
              <>
                <div><strong style={{ color: "#f87171" }}>✗ Not Authenticated</strong></div>
                <div style={{ marginTop: 2 }}>{auth?.statusMessage ?? "Set up credentials below"}</div>
              </>
            )}
          </div>

          {error && (
            <div style={{ fontSize: 10, color: "#f87171", marginBottom: 8 }}>
              {error}
            </div>
          )}

          {/* Auth method toggle */}
          <label style={{ fontSize: 10, color: "rgba(200,210,230,0.5)", display: "block", marginBottom: 4 }}>
            Auth Method
          </label>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            <button
              onClick={() => { setUseLoggedIn(true); setTokenInput(""); }}
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: 10,
                borderRadius: 4,
                border: useLoggedIn ? "1px solid rgba(70,200,255,0.4)" : "1px solid rgba(100,150,200,0.15)",
                background: useLoggedIn ? "rgba(70,200,255,0.1)" : "transparent",
                color: useLoggedIn ? "#7dd3fc" : "rgba(200,210,230,0.4)",
                cursor: "pointer",
              }}
            >
              🔐 Logged-in User
            </button>
            <button
              onClick={() => setUseLoggedIn(false)}
              style={{
                flex: 1,
                padding: "6px 8px",
                fontSize: 10,
                borderRadius: 4,
                border: !useLoggedIn ? "1px solid rgba(70,200,255,0.4)" : "1px solid rgba(100,150,200,0.15)",
                background: !useLoggedIn ? "rgba(70,200,255,0.1)" : "transparent",
                color: !useLoggedIn ? "#7dd3fc" : "rgba(200,210,230,0.4)",
                cursor: "pointer",
              }}
            >
              🔑 Token
            </button>
          </div>

          {/* Token input (only when token mode selected) */}
          {!useLoggedIn && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: "rgba(200,210,230,0.5)", display: "block", marginBottom: 4 }}>
                GitHub Token
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={auth?.config?.hasToken ? "••••••• (token set)" : "ghp_..."}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  background: "rgba(20,30,50,0.6)",
                  border: "1px solid rgba(100,150,200,0.15)",
                  borderRadius: 4,
                  color: "#e0e8f0",
                  fontSize: 10,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* Model selector */}
          <label style={{ fontSize: 10, color: "rgba(200,210,230,0.5)", display: "block", marginBottom: 4 }}>
            Model
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              width: "100%",
              padding: "6px 8px",
              background: "rgba(20,30,50,0.6)",
              border: "1px solid rgba(100,150,200,0.15)",
              borderRadius: 4,
              color: "#e0e8f0",
              fontSize: 10,
              marginBottom: 10,
              outline: "none",
              boxSizing: "border-box",
            }}
          >
            <option value="gpt-4o">gpt-4o</option>
            <option value="gpt-5">gpt-5</option>
            <option value="claude-sonnet-4.5">claude-sonnet-4.5</option>
            {models
              .filter((m) => !["gpt-4o", "gpt-5", "claude-sonnet-4.5"].includes(m.id))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
          </select>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: "100%",
              padding: "7px",
              background: saving ? "rgba(70,200,255,0.05)" : "rgba(70,200,255,0.1)",
              border: "1px solid rgba(70,200,255,0.3)",
              borderRadius: 6,
              color: "#7dd3fc",
              fontSize: 11,
              fontWeight: 600,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Applying…" : "Apply Settings"}
          </button>

          {/* Refresh link */}
          <button
            onClick={refresh}
            style={{
              width: "100%",
              marginTop: 6,
              padding: "4px",
              background: "transparent",
              border: "none",
              color: "rgba(200,210,230,0.3)",
              fontSize: 9,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            ↻ Refresh status
          </button>
        </div>
      )}
    </div>
  );
};

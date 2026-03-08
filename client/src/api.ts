const API_BASE = "/api";

// ─── Auth & Credentials ─────────────────────────────────────

export async function getAuthStatus() {
  const res = await fetch(`${API_BASE}/auth/status`);
  if (!res.ok) throw new Error("Failed to get auth status");
  return res.json();
}

export async function configureAuth(config: {
  githubToken?: string;
  useLoggedInUser?: boolean;
  model?: string;
}) {
  const res = await fetch(`${API_BASE}/auth/configure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to configure auth");
  return res.json();
}

export async function listModels() {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) throw new Error("Failed to list models");
  return res.json();
}

// ─── Trees ──────────────────────────────────────────────────

// ─── Pipeline ───────────────────────────────────────────────

export async function getPipelineSchema(treeId: string) {
  const res = await fetch(`${API_BASE}/pipeline/schema/${treeId}`);
  if (!res.ok) throw new Error("Failed to get pipeline schema");
  return res.json();
}

export async function runPipeline(treeId: string, inputs: Record<string, unknown>, weights?: any[]) {
  const res = await fetch(`${API_BASE}/pipeline/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ treeId, inputs, weights }),
  });
  if (!res.ok) throw new Error("Pipeline execution failed");
  return res.json();
}

export async function runPipelineBatch(treeId: string, runs: { inputs: Record<string, unknown>; weights?: any[] }[], concurrency?: number) {
  const res = await fetch(`${API_BASE}/pipeline/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ treeId, runs, concurrency }),
  });
  if (!res.ok) throw new Error("Batch execution failed");
  return res.json();
}

// ─── Trees (CRUD) ───────────────────────────────────────────

export async function fetchTrees() {
  const res = await fetch(`${API_BASE}/trees`);
  if (!res.ok) throw new Error("Failed to fetch trees");
  return res.json();
}

export async function fetchTree(id: string) {
  const res = await fetch(`${API_BASE}/trees/${id}`);
  if (!res.ok) throw new Error("Failed to fetch tree");
  return res.json();
}

export async function saveTree(tree: any) {
  const res = await fetch(`${API_BASE}/trees/${tree.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tree),
  });
  if (!res.ok) throw new Error("Failed to save tree");
  return res.json();
}

export async function createTree(tree: any) {
  const res = await fetch(`${API_BASE}/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tree),
  });
  if (!res.ok) throw new Error("Failed to create tree");
  return res.json();
}

export async function startSession(treeId: string, weights?: any[], initialContext?: any) {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ treeId, weights, initialContext }),
  });
  if (!res.ok) throw new Error("Failed to start session");
  return res.json();
}

export async function advanceSession(sessionId: string, treeId: string, value: unknown) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/advance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ treeId, value }),
  });
  if (!res.ok) throw new Error("Failed to advance session");
  return res.json();
}

export async function getPendingResult(sessionId: string): Promise<{ status: "generating" | "done" | "error"; result?: string }> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/pending-result`);
  if (!res.ok) return { status: "generating" };
  return res.json();
}

export async function saveScaffold(
  markdown: string,
  targetDir: string,
  openInVSCode: boolean = true
): Promise<{ success: boolean; filesWritten: string[]; fileCount: number; targetDir: string; error?: string }> {
  const res = await fetch(`${API_BASE}/scaffold/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown, targetDir, openInVSCode }),
  });
  return res.json();
}

export async function getSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Failed to get session");
  return res.json();
}

export async function updateSessionWeights(sessionId: string, weights: any[]) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/weights`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ weights }),
  });
  if (!res.ok) throw new Error("Failed to update weights");
  return res.json();
}

export async function fetchDefaultWeights(treeId?: string) {
  const qs = treeId ? `?treeId=${encodeURIComponent(treeId)}` : "";
  const res = await fetch(`${API_BASE}/weights/defaults${qs}`);
  if (!res.ok) throw new Error("Failed to fetch default weights");
  return res.json();
}

export async function fetchWeightProfiles(treeId?: string) {
  const qs = treeId ? `?treeId=${encodeURIComponent(treeId)}` : "";
  const res = await fetch(`${API_BASE}/weights/profiles${qs}`);
  if (!res.ok) throw new Error("Failed to fetch profiles");
  return res.json();
}

export async function saveWeightProfile(profile: any) {
  const res = await fetch(`${API_BASE}/weights/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("Failed to save profile");
  return res.json();
}

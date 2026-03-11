/**
 * api.ts — Unit tests
 *
 * Each exported function is a thin fetch wrapper.
 * We mock `globalThis.fetch` and verify:
 *   1. The correct URL / method / body is used.
 *   2. Successful responses are parsed as JSON.
 *   3. Non-OK responses throw descriptive errors.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  getAuthStatus,
  configureAuth,
  listModels,
  getPipelineSchema,
  runPipeline,
  runPipelineBatch,
  fetchTrees,
  fetchTree,
  saveTree,
  createTree,
  startSession,
  advanceSession,
  getPendingResult,
  saveScaffold,
  getSession,
  updateSessionWeights,
  fetchDefaultWeights,
  fetchWeightProfiles,
  saveWeightProfile,
} from "../api";

// ─── Helpers ────────────────────────────────────────────────

function okResponse(body: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function failResponse(status = 500) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: "server error" }),
  } as unknown as Response;
}

// ─── Setup ──────────────────────────────────────────────────

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock;
});

// ─── Auth ───────────────────────────────────────────────────

describe("getAuthStatus", () => {
  it("should GET /api/auth/status", async () => {
    fetchMock.mockResolvedValue(okResponse({ configured: true }));
    const data = await getAuthStatus();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/status");
    expect(data).toEqual({ configured: true });
  });

  it("should throw on non-OK", async () => {
    fetchMock.mockResolvedValue(failResponse());
    await expect(getAuthStatus()).rejects.toThrow("Failed to get auth status");
  });
});

describe("configureAuth", () => {
  it("should POST token config", async () => {
    fetchMock.mockResolvedValue(okResponse({ ok: true }));
    await configureAuth({ githubToken: "tok_123" });

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/configure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubToken: "tok_123" }),
    });
  });

  it("should throw on failure", async () => {
    fetchMock.mockResolvedValue(failResponse());
    await expect(configureAuth({})).rejects.toThrow("Failed to configure auth");
  });
});

describe("listModels", () => {
  it("should GET /api/models", async () => {
    fetchMock.mockResolvedValue(okResponse([{ id: "gpt-4" }]));
    const data = await listModels();

    expect(fetchMock).toHaveBeenCalledWith("/api/models");
    expect(data).toEqual([{ id: "gpt-4" }]);
  });
});

// ─── Trees ──────────────────────────────────────────────────

describe("fetchTrees", () => {
  it("should GET /api/trees", async () => {
    fetchMock.mockResolvedValue(okResponse([{ id: "t1" }]));
    const data = await fetchTrees();

    expect(fetchMock).toHaveBeenCalledWith("/api/trees");
    expect(data).toEqual([{ id: "t1" }]);
  });

  it("should throw on failure", async () => {
    fetchMock.mockResolvedValue(failResponse());
    await expect(fetchTrees()).rejects.toThrow("Failed to fetch trees");
  });
});

describe("fetchTree", () => {
  it("should GET /api/trees/:id", async () => {
    fetchMock.mockResolvedValue(okResponse({ id: "t1", nodes: [] }));
    await fetchTree("t1");

    expect(fetchMock).toHaveBeenCalledWith("/api/trees/t1");
  });
});

describe("saveTree", () => {
  it("should PUT /api/trees/:id", async () => {
    const tree = { id: "t1", name: "Test" };
    fetchMock.mockResolvedValue(okResponse(tree));
    await saveTree(tree);

    expect(fetchMock).toHaveBeenCalledWith("/api/trees/t1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tree),
    });
  });
});

describe("createTree", () => {
  it("should POST /api/trees", async () => {
    const tree = { id: "new", name: "New Tree" };
    fetchMock.mockResolvedValue(okResponse(tree));
    await createTree(tree);

    expect(fetchMock).toHaveBeenCalledWith("/api/trees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tree),
    });
  });
});

// ─── Sessions ───────────────────────────────────────────────

describe("startSession", () => {
  it("should POST /api/sessions with treeId and optional weights", async () => {
    fetchMock.mockResolvedValue(okResponse({ sessionId: "s1" }));
    await startSession("t1", [{ id: "risk", value: 80 }], { foo: "bar" });

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sessions");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({
      treeId: "t1",
      weights: [{ id: "risk", value: 80 }],
      initialContext: { foo: "bar" },
    });
  });
});

describe("advanceSession", () => {
  it("should POST /api/sessions/:id/advance", async () => {
    fetchMock.mockResolvedValue(okResponse({ step: {} }));
    await advanceSession("s1", "t1", "user answer");

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sessions/s1/advance");
    expect(JSON.parse(opts.body)).toEqual({ treeId: "t1", value: "user answer" });
  });
});

describe("getPendingResult", () => {
  it("should return parsed JSON on success", async () => {
    fetchMock.mockResolvedValue(okResponse({ status: "done", result: "Hello" }));
    const data = await getPendingResult("s1");

    expect(data).toEqual({ status: "done", result: "Hello" });
  });

  it("should return { status: 'generating' } on non-OK", async () => {
    fetchMock.mockResolvedValue(failResponse());
    const data = await getPendingResult("s1");

    expect(data).toEqual({ status: "generating" });
  });
});

describe("getSession", () => {
  it("should GET /api/sessions/:id", async () => {
    fetchMock.mockResolvedValue(okResponse({ state: {} }));
    await getSession("s1");

    expect(fetchMock).toHaveBeenCalledWith("/api/sessions/s1");
  });
});

describe("updateSessionWeights", () => {
  it("should PUT /api/sessions/:id/weights", async () => {
    const weights = [{ id: "risk", value: 60 }];
    fetchMock.mockResolvedValue(okResponse({ ok: true }));
    await updateSessionWeights("s1", weights);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sessions/s1/weights");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({ weights });
  });
});

// ─── Pipeline ───────────────────────────────────────────────

describe("getPipelineSchema", () => {
  it("should GET /api/pipeline/schema/:treeId", async () => {
    fetchMock.mockResolvedValue(okResponse({ inputs: [] }));
    await getPipelineSchema("t1");

    expect(fetchMock).toHaveBeenCalledWith("/api/pipeline/schema/t1");
  });
});

describe("runPipeline", () => {
  it("should POST /api/pipeline/run", async () => {
    fetchMock.mockResolvedValue(okResponse({ steps: [] }));
    await runPipeline("t1", { env: "prod" }, [{ id: "risk", value: 70 }]);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/pipeline/run");
    expect(JSON.parse(opts.body)).toEqual({
      treeId: "t1",
      inputs: { env: "prod" },
      weights: [{ id: "risk", value: 70 }],
    });
  });
});

describe("runPipelineBatch", () => {
  it("should POST /api/pipeline/batch", async () => {
    const runs = [{ inputs: { x: 1 } }, { inputs: { x: 2 } }];
    fetchMock.mockResolvedValue(okResponse({ results: [] }));
    await runPipelineBatch("t1", runs, 4);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.treeId).toBe("t1");
    expect(body.runs).toEqual(runs);
    expect(body.concurrency).toBe(4);
  });
});

// ─── Weights ────────────────────────────────────────────────

describe("fetchDefaultWeights", () => {
  it("should GET /api/weights/defaults without query string", async () => {
    fetchMock.mockResolvedValue(okResponse([]));
    await fetchDefaultWeights();

    expect(fetchMock).toHaveBeenCalledWith("/api/weights/defaults");
  });

  it("should append ?treeId= when provided", async () => {
    fetchMock.mockResolvedValue(okResponse([]));
    await fetchDefaultWeights("my-tree");

    expect(fetchMock).toHaveBeenCalledWith("/api/weights/defaults?treeId=my-tree");
  });
});

describe("fetchWeightProfiles", () => {
  it("should GET /api/weights/profiles", async () => {
    fetchMock.mockResolvedValue(okResponse([]));
    await fetchWeightProfiles();

    expect(fetchMock).toHaveBeenCalledWith("/api/weights/profiles");
  });

  it("should append ?treeId= when provided", async () => {
    fetchMock.mockResolvedValue(okResponse([]));
    await fetchWeightProfiles("t1");

    expect(fetchMock).toHaveBeenCalledWith("/api/weights/profiles?treeId=t1");
  });
});

describe("saveWeightProfile", () => {
  it("should POST /api/weights/profiles", async () => {
    const profile = { id: "p1", name: "Custom" };
    fetchMock.mockResolvedValue(okResponse(profile));
    await saveWeightProfile(profile);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/weights/profiles");
    expect(opts.method).toBe("POST");
  });
});

// ─── Scaffold ───────────────────────────────────────────────

describe("saveScaffold", () => {
  it("should POST /api/scaffold/save and return result regardless of ok", async () => {
    fetchMock.mockResolvedValue(
      okResponse({ success: true, filesWritten: ["a.ts"], fileCount: 1, targetDir: "/out" })
    );
    const data = await saveScaffold("# Hello", "/out");

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/scaffold/save");
    expect(JSON.parse(opts.body)).toEqual({
      markdown: "# Hello",
      targetDir: "/out",
      openInVSCode: true,
    });
    expect(data.success).toBe(true);
  });

  it("should default openInVSCode to true", async () => {
    fetchMock.mockResolvedValue(okResponse({ success: true }));
    await saveScaffold("md", "/dir");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.openInVSCode).toBe(true);
  });

  it("should respect openInVSCode = false", async () => {
    fetchMock.mockResolvedValue(okResponse({ success: true }));
    await saveScaffold("md", "/dir", false);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.openInVSCode).toBe(false);
  });
});

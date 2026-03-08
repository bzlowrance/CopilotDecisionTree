# Changelog

All notable changes to Copilot Decision Tree are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.3.1] — 2026-03-08

### Fixed
- **Auto-zoom no longer fights manual pan/zoom** — the node progress graph now only auto-zooms on actual node transitions. Manually panning or zooming between transitions is no longer immediately overridden.
- **First-node auto-zoom on run start** — the initial zoom is deferred until the Decision Weights panel collapse animation completes, so the viewport correctly centers on the first active node instead of staying at the top.
- **Re-zoom on weights panel toggle** — expanding or collapsing the Decision Weights panel now triggers an automatic re-zoom to the active node after the transition finishes, keeping the node centered regardless of layout changes.

---

## [1.3.0] — 2026-03-07

### Added
- **Async action polling** — action nodes now return immediately with `isGenerating: true` while the Copilot SDK works in the background. The frontend polls `GET /pending-result` every 2 seconds, showing a "⏳ Copilot is generating…" indicator until the result arrives. Eliminates HTTP timeout issues for long-running prompts.
- **Save scaffold to disk** — new "Save & Open in VS Code" button on scaffold output. `POST /api/scaffold/save` parses `// file: path` annotations from the generated markdown and writes each file to the chosen directory. Optionally opens the folder in VS Code.
- **`resultVariable` on action nodes** — action nodes can now store their SDK output into the session context (e.g., `"resultVariable": "weightStrategy"`), making the result available to downstream nodes via `{{variableName}}` template interpolation.
- **SDK-dynamic weight interpretation** — new `action_interpret_weights` node asks the Copilot SDK to analyze the current weight slider values and produce a bullet-point code-generation strategy. The strategy is stored as `weightStrategy` and injected into scaffold/deploy prompts, so weight changes meaningfully alter AI output without hardcoded rules.
- **Hardcoded assumption example** — `assumption_tests` node demonstrates weight-driven assumptions: when Best Practices weight is high (strength 0.9), the tree assumes the user wants a comprehensive test suite. Users see the assumption and can agree or override.

### Changed
- **Tree rewrite** — copilot-extension-planner tree restructured from 8 nodes/8 edges to 11 nodes/11 edges. New flow: ext type → name → purpose → capabilities → **test assumption** → language → hosting decision → [hosting target] → **weight interpretation** → scaffold → deploy guide.
- **Action→action edges** use `"Continue →"` label instead of empty string, so the UI shows a button between action steps instead of a dead text input.
- **SDK timeout** — explicit 300-second (5 min) timeout on `sendAndWait()`, overriding the SDK's 60-second internal default. Express socket timeout raised to match.
- **Scaffold & deploy prompts** now reference `{{weightStrategy}}` and `{{includeTests}}` from context, making output dynamically shaped by both the SDK weight interpretation and the test-suite assumption.

### Fixed
- **Weights not lighting up** — added `weightInfluence` to capabilities, assumption_tests, weight-interpretation, scaffold, and deploy nodes; added `weightBias` to the hosting decision node. The weight panel now correctly highlights active dimensions.
- **Dead text prompt between action nodes** — edges with `label: ""` between action nodes caused a useless text input to appear. Fixed by using `"Continue →"` labels.

---

## [1.2.0] — 2026-03-07

### Added
- **Collapsible panels** — both the Decision Weights radar and a new Node Progress panel are wrapped in resizable, collapsible side panels. Drag the edge to resize; click the strip to collapse/expand.
- **Node Progress panel** — vertical stepper on the left shows all tree nodes in traversal order. Completed nodes turn green with a checkmark, the active node pulses blue and auto-scrolls to center, pending nodes are dimmed.
- **Active-node zoom** — the progress panel automatically scrolls to keep the current node centered vertically, with smooth CSS transitions when advancing to the next node.

---

## [1.1.0] — 2026-03-07

### Added
- **Multiselect input type** — new `multiselect` input for input nodes allowing users to toggle multiple choices (e.g., IaC tools, capabilities). Supported across TreeRunner, PipelineRunner, NodeEditor, and TreeNodes components.
- **IaC tools node** in codex-spec-builder tree — 10 IaC tool options (Terraform, Bicep, Ansible, etc.) with conditional routing from the "Infrastructure / DevOps (IaC)" path.
- **GitHub Copilot Extension Planner** tree — new demo tree showcasing all input types (choice, text, multiselect), decision node branching based on extension type, and two Copilot SDK action nodes (scaffold + deploy guide).
- **Weight-aware Copilot prompts** — weight slider values are now injected into the system prompt sent to the Copilot SDK, so adjusting weights visibly changes AI output.
- **Roadmap** (`ROADMAP.md`) — phased roadmap from current state through VS Code extension, Azure deployment, collaboration, and enterprise features.

### Changed
- **Default model** set to `gpt-5.3-codex` (was `gpt-4o`).
- **"Apply Credentials" button** renamed to **"Apply Settings"** to reflect that it saves model selection alongside auth config.
- **Server startup order** — `app.listen()` now fires before `agent.ensureClient()`. SDK initialization runs in the background so the server accepts requests immediately (session start: 94ms, down from 9.5s).
- **`generateNarration`** made synchronous — returns a local string instead of calling the SDK, eliminating a round-trip on every step.

### Removed
- **airplane-diagnosis.tree.json** — removed from tree library.

### Fixed
- **9.5-second session start delay** — root cause was the SDK subprocess blocking the Node.js event loop before Express could accept connections. Fixed by deferring SDK init to the `app.listen` callback.
- **Missing `variableName`** on input nodes in copilot-extension-planner tree — template variables (e.g., `{{extType}}`) now correctly populate via context.
- **Incorrect conditional branching** in copilot-extension-planner — language node edges were matching against language choice instead of extension type. Replaced with a proper `decision_needs_hosting` node that evaluates `extType`.

---

## [1.0.0] — 2026-03-04

### Added
- Initial release of Copilot Decision Tree.
- **Visual tree builder** with React Flow — drag-and-drop node editor with auto-layout.
- **Four node types**: Input (text, choice, number, boolean, image), Assumption, Decision, Action.
- **Weight system** — configurable sliders that bias decision node branching and are visualized via radar chart.
- **Copilot SDK integration** — action nodes with `copilot_prompt` type send interpolated templates to the GitHub Copilot SDK.
- **Tree runner** — conversational chat UI that walks users through a decision tree step by step.
- **Pipeline runner** — batch execution mode that runs an entire tree with pre-filled inputs.
- **REST API** — Express server with CRUD for trees, session management, model listing, and auth config.
- **10 starter trees**: codex-spec-builder, architecture-guide, app-modernization, tech-stack-selector, incident-response, troubleshoot-deploy, credit-risk-decision, automotive-diagnosis, medical-symptom-diagnosis, airplane-diagnosis.
- **Auth panel** — configure GitHub token, logged-in user mode, and model selection from the UI.

# Roadmap — Copilot Decision Tree

> Living document. Items are ordered by estimated impact for adoption and competition differentiation.
> 
> **Challenge alignment:** Items tagged with 🏆 map to [FY26 SDK Challenge](https://microsoft.sharepoint.com/teams/GithubSales/SitePages/FY26SDKChallenge.aspx) judging criteria.

---

## Phase 0 — SDK Challenge Submission Requirements

Required repo artifacts for the FY26 GitHub Copilot SDK Enterprise Challenge.

- [x] Working solution with code in a GitHub repo *(server/ + client/)*
- [x] README with problem → solution, prereqs, setup, architecture diagram
- [x] 150-word project summary *(in README)*
- [ ] 🏆 **`/docs` folder** — consolidate README content into `/docs/README.md` with explicit sections: problem → solution, prerequisites, setup, deployment, architecture diagram, **Responsible AI (RAI) notes**
- [ ] 🏆 **RAI notes** — document Responsible AI considerations: data handling, bias mitigation in weight system, transparency of assumptions, human-in-the-loop design, content filtering
- [ ] 🏆 **`AGENTS.md`** — custom agent instructions file (required by challenge)
- [ ] 🏆 **`mcp.json`** — MCP server configuration (if applicable, or document why N/A)
- [ ] 🏆 **`/presentations/CopilotDecisionTree.pptx`** — 1–2 slide deck with business value proposition, architecture diagram, and repo link
- [ ] 🏆 **Demo video** — 3-minute video of the solution in action
- [x] Demo recording script *(DEMO-SCRIPT.md)*
- [ ] 🏆 **`/customer` folder** — customer testimonial release or validation document *(bonus: +10 pts)*
- [ ] 🏆 **Copilot SDK product feedback** — post feedback in SDK team channel + screenshot *(bonus: +10 pts)*

---

## Phase 1 — Polish & Ship (Done)

- [x] Fix session start performance (SDK init deferred)
- [x] Multiselect input type across all components
- [x] Weight injection into Copilot prompts (AI output shaped by sliders)
- [x] Demo tree: GitHub Copilot Extension Planner
- [x] Demo recording script

---

## Phase 2 — VS Code Extension

Wrap the tree runner as a native VS Code extension so developers never leave their editor.

- [ ] **Copilot Chat Participant** (`@tree`) — run any decision tree from Copilot Chat
- [ ] **Tree Picker command** — `Ctrl+Shift+P` → "Run Decision Tree" to pick and start a tree
- [ ] **Inline code insertion** — action node output piped directly into the active editor
- [ ] **Workspace-local trees** — load `.tree.json` files from `.copilot-trees/` in any repo
- [ ] **Weight presets** — save named weight configs per workspace (e.g., "Production", "Prototype")

---

## Phase 3 — Azure Deployment & Integration

Deploy the app as a hosted service and integrate with Azure/Microsoft solutions.
> 🏆 *Azure/Microsoft integration = 25 pts; Operational readiness = 15 pts*

- [ ] 🏆 **Azure App Service** deployment via `azd init` + Bicep
- [ ] 🏆 **Azure Static Web Apps** for the React client
- [ ] 🏆 **Azure Key Vault** for token/secret management
- [x] 🏆 **GitHub Actions CI/CD** — build, test, deploy on push *(v1.4.0 — CI pipeline with lint/typecheck/test/build + CD pipeline with staging auto-deploy, approval gate, and production slot swap)*
- [x] 🏆 **Environment config** — staging vs production tree sets *(v1.4.0 — staging deployment slot with smoke tests, manual approval gate before production swap)*
- [x] 🏆 **Codespaces dev container** — `.devcontainer/devcontainer.json` with Node 22, auto-install, port forwarding *(v1.4.0)*
- [x] 🏆 **Comprehensive test suites** — 136 tests (Vitest) across server and client: tree-engine, routes, agent, weight-utils, API wrappers *(v1.4.0)*
- [ ] 🏆 **Azure Application Insights** — observability, telemetry, and monitoring for production runs
- [ ] 🏆 **Azure Monitor** — alerting on tree execution failures, SDK errors, latency
- [ ] 🏆 **Work IQ / Fabric IQ / Foundry IQ integration** — connect decision tree data to Microsoft IQ surfaces *(bonus: +15 pts)*

---

## Phase 4 — Interactive Steering Mode

Let users push back, redirect, and reshape the tree mid-session — then persist the changes.

- [ ] **Intent classifier** — Copilot SDK call on every user response detects: `answer` | `steer` | `skip` | `rephrase` | `insert`
- [ ] **Skip with reason** — user says "this doesn't apply" → node skipped, reason logged in trace
- [ ] **Rephrase** — user says "I don't understand" → Copilot re-explains the node using session context
- [ ] **Steer / reorder** — user says "ask about auth first" → Copilot evaluates and jumps to or reorders upcoming nodes
- [ ] **Insert ephemeral node** — user says "add a question about database" → Copilot generates a temporary input node on the fly
- [ ] **Save back: Update existing tree** — apply session modifications (skips, inserts, reorders) to the original tree definition
- [ ] **Save back: Fork as new version** — create a new versioned copy of the tree with the modifications baked in (e.g., v1.0.0 → v1.1.0)
- [ ] **Diff view** — show what changed between the original tree and the steered session before saving
- [ ] **Steering trace** — all deviations logged in session history for audit ("User skipped node X because…", "User inserted node Y")

---

## Phase 5 — Collaboration & Sharing

Make trees a team-level artifact, not just local files.

- [ ] **GitHub-backed tree storage** — load/save trees from a GitHub repo (tree-as-code)
- [ ] **Tree versioning** — semantic version trees, diff between versions
- [ ] **Import/export** — share trees as single JSON files or GitHub Gists
- [ ] **Team templates** — org-level tree library (e.g., "Contoso Onboarding Trees")
- [ ] **Run history** — persist session traces for audit and replay

---

## Phase 6 — Advanced AI Features

Push the Copilot SDK integration further.

- [ ] **Streaming responses** — show Copilot output token-by-token instead of waiting for completion
- [ ] **Multi-model support** — let users pick the model per action node (GPT-5.3-Codex, Claude, Gemini)
- [ ] **Context augmentation** — action nodes that read files from the workspace before prompting
- [ ] **Chained trees** — one tree's output becomes another tree's input (pipeline of trees)
- [ ] **Adaptive trees** — AI suggests which branch to take based on conversation history
- [ ] **Evaluation mode** — run a tree N times with different weights, compare outputs side-by-side

---

## Phase 7 — Cortana Avatar & Voice Narration

A Cortana Blue digital avatar narrates tree execution with synthesized speech using Azure Speech Service and Cortana's neural voice, making the experience conversational and accessible.

> *IP Note: Cortana branding/voice is first-party Microsoft — cleared for internal use possibly?*

- [ ] **Azure Speech Service TTS backend** — server-side streaming audio generation per node prompt/response
- [ ] **Cortana neural voice** — use Cortana's actual neural voice profile via Azure Custom Neural Voice
- [ ] **Blue holographic avatar component** — animated Cortana-style digital avatar (CSS/WebGL) embedded in the runner panel
- [ ] **Lip-sync / pulse animation** — avatar mouth/glow tied to TTS audio playback timeline via viseme events
- [ ] **Per-node narration** — avatar reads input prompts, explains assumption/decision logic, narrates action outputs
- [ ] **Contextual tone** — adjust speech rate/style based on node type (questioning for inputs, confident for decisions, explanatory for actions)
- [ ] **Mute/unmute toggle** — one-click mute with text-only fallback; persists across sessions
- [ ] **Voice activity indicator** — subtle waveform or ring animation in the node progress panel while speaking
- [ ] **Avatar idle state** — ambient breathing/glow animation when waiting for user input

---

## Phase 8 — Enterprise, Security & Governance

Features for regulated industries and large orgs.
> 🏆 *Security, governance & Responsible AI = 15 pts; Enterprise applicability = 30 pts*

- [ ] 🏆 **RBAC** — control who can edit trees vs. run them
- [ ] 🏆 **Audit trail** — full decision trace with timestamps, user identity, weight snapshots
- [ ] 🏆 **Compliance templates** — pre-built trees for HIPAA, SOC2, FedRAMP onboarding
- [ ] 🏆 **Approval gates** — action nodes that require human approval before executing
- [ ] 🏆 **Telemetry dashboard** — which trees get used, where people drop off, which weights get changed
- [ ] 🏆 **Content filtering** — integrate Azure Content Safety to filter Copilot SDK outputs
- [ ] 🏆 **Secret scanning** — ensure no tokens or secrets are persisted in session traces or tree definitions

---

## Ideas / Backlog

- [ ] Natural language tree creation ("Build me a tree for triaging production incidents")
- [ ] Tree marketplace / community gallery
- [ ] Mobile-responsive runner view
- [ ] Webhook action nodes (call external APIs)
- [ ] Conditional weight presets (weights auto-set based on early answers)
- [ ] Tree analytics — heatmap of most-traversed paths

# Testing, CI/CD & Deployment Guide

> Complete reference for the automated quality gates, continuous integration pipeline, deployment process, and infrastructure configuration for **Copilot Decision Tree**.

---

## Table of Contents

- [Pipeline Overview](#pipeline-overview)
- [CI Workflow — Continuous Integration](#ci-workflow--continuous-integration)
  - [Triggers](#ci-triggers)
  - [Steps](#ci-steps)
  - [Concurrency](#ci-concurrency)
  - [Build Artifacts](#build-artifacts)
- [Deploy Workflow — Continuous Deployment](#deploy-workflow--continuous-deployment)
  - [Triggers](#deploy-triggers)
  - [Stage 1: Deploy to Staging (Automatic)](#stage-1-deploy-to-staging-automatic)
  - [Stage 2: Promote to Production (Gated Approval)](#stage-2-promote-to-production-gated-approval)
  - [Smoke Tests](#smoke-tests)
  - [Slot Swap Strategy](#slot-swap-strategy)
- [Quality Gates](#quality-gates)
  - [Linting](#linting)
  - [Type Checking](#type-checking)
  - [Automated Tests](#automated-tests)
  - [Build Verification](#build-verification)
- [Adding Tests to the Project](#adding-tests-to-the-project)
  - [Server Tests (Vitest)](#server-tests-vitest)
  - [Client Tests (Vitest + React Testing Library)](#client-tests-vitest--react-testing-library)
  - [Adding ESLint](#adding-eslint)
- [Infrastructure Setup](#infrastructure-setup)
  - [Azure App Service](#azure-app-service)
  - [GitHub Secrets](#github-secrets)
  - [GitHub Environments (Approval Gate)](#github-environments-approval-gate)
  - [Customizing Environment Variables](#customizing-environment-variables)
- [Development Environment](#development-environment)
  - [GitHub Codespaces](#github-codespaces)
  - [Local Development](#local-development)
- [Troubleshooting](#troubleshooting)

---

## Pipeline Overview

The project uses a two-workflow GitHub Actions pipeline that separates **quality verification** (CI) from **deployment** (CD), with a manual approval gate before production:

```
 feature/** push ─┐        main push / PR merge ─┐
                  │                               │
                  ▼                               ▼
          ┌──────────────┐               ┌──────────────┐
          │   CI Only    │               │     CI       │
          │ lint/test/   │               │ lint/test/   │
          │ typecheck/   │               │ typecheck/   │
          │ build        │               │ build        │
          └──────────────┘               └──────┬───────┘
                                                │ ✅ pass → artifact upload
                                                ▼
                                        ┌──────────────┐
                                        │ Deploy →     │  automatic
                                        │ Staging Slot │
                                        └──────┬───────┘
                                               │ smoke test ✓
                                               ▼
                                        ┌──────────────┐
                                        │ ⏸ MANUAL    │  approval gate
                                        │   APPROVAL   │
                                        └──────┬───────┘
                                               │ approved ✓
                                               ▼
                                        ┌──────────────┐
                                        │ Slot Swap → │  zero-downtime
                                        │ Production   │
                                        │ + restart    │
                                        └──────────────┘
```

### Workflow Files

| File | Purpose |
|------|---------|
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Continuous Integration — lint, typecheck, test, build |
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | Continuous Deployment — staging deploy, approval gate, production swap |

---

## CI Workflow — Continuous Integration

**File:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

### CI Triggers

| Event | Branches | Description |
|-------|----------|-------------|
| `push` | `main`, `develop`, `feature/**` | Runs on every commit pushed to these branches |
| `pull_request` | `main`, `develop` | Runs on PRs targeting these branches |

### CI Steps

The CI job runs sequentially through four quality gates:

```
1. Checkout + Setup Node 22 + npm ci
        │
2. ── Lint ──────────────────────────────
   │  npm run lint --workspace=server --if-present
   │  npm run lint --workspace=client --if-present
   │
3. ── Type-check ────────────────────────
   │  npx --workspace=server tsc --noEmit
   │  npx --workspace=client tsc --noEmit
   │
4. ── Test ──────────────────────────────
   │  npm test --workspace=server --if-present
   │  npm test --workspace=client --if-present
   │
5. ── Build ─────────────────────────────
   │  npm run build
   │  (server: tsc → dist/  |  client: tsc + vite build → dist/)
   │
6. ── Upload Artifact ───────────────────
      Packages server-dist, client-dist, trees/, package.json
      Uploads as: app-build-<commit-sha>
      Retention: 7 days
```

> **Note:** Steps that use `--if-present` will silently pass if the corresponding script isn't defined yet. This means the CI pipeline works immediately — no tests or linting required to start. As you add test/lint scripts, they'll be picked up automatically.

### CI Concurrency

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

If you push multiple commits to the same branch in quick succession, **only the latest push runs** — earlier runs are cancelled. This saves CI minutes and avoids stale results.

### Build Artifacts

The CI workflow produces a deployment artifact containing:

```
staging-artifact/
├── server-dist/     # Compiled TypeScript (server/dist/)
├── client-dist/     # Vite production bundle (client/dist/)
├── trees/           # Decision tree JSON files
├── package.json     # Root package.json
└── server-package.json  # Server dependencies
```

Artifacts are named `app-build-<git-sha>` and retained for **7 days**. The deploy workflow downloads this artifact by SHA to ensure exact build-to-deploy traceability.

---

## Deploy Workflow — Continuous Deployment

**File:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

### Deploy Triggers

The deploy workflow uses `workflow_run` — it triggers **only** when:
- The **CI** workflow completes
- On the **main** branch
- With a **success** conclusion

```yaml
on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]
```

This means feature branches and develop branches **never** trigger a deploy, even if CI passes.

### Stage 1: Deploy to Staging (Automatic)

When CI passes on `main`, the deploy workflow automatically:

1. **Downloads** the build artifact from the CI run (matched by commit SHA)
2. **Packages** the application for Azure App Service:
   - Assembles `server/dist/`, `client/dist/`, `trees/` into a clean directory
   - Creates a `startup.js` wrapper that mounts the Vite-built client as static files from Express
   - Installs production-only dependencies (`--omit=dev`)
3. **Authenticates** to Azure using the `AZURE_CREDENTIALS` service principal
4. **Deploys** to the **staging** deployment slot via `azure/webapps-deploy@v3`
5. **Restarts** the staging slot with `az webapp restart`
6. **Smoke tests** the staging URL — hits `GET /api/trees` with retries (30 attempts, 10s apart = 5 min timeout)

The staging environment URL is:
```
https://<AZURE_WEBAPP_NAME>-staging.azurewebsites.net
```

### Stage 2: Promote to Production (Gated Approval)

After staging is healthy, the `deploy-production` job runs — but **only after manual approval**:

1. **Approval gate** — The job targets the `production` GitHub Environment, which requires a reviewer to click "Approve" in the GitHub Actions UI
2. **Slot swap** — `az webapp deployment slot swap` performs a **zero-downtime** swap between staging and production
3. **Restart** — Production is restarted to ensure clean state
4. **Smoke test** — Verifies `GET /api/trees` returns HTTP 200 on the production URL (20 attempts, 10s apart)

The production URL is:
```
https://<AZURE_WEBAPP_NAME>.azurewebsites.net
```

### Smoke Tests

Both stages include automated health checks:

| Stage | Endpoint | Retries | Interval | Total Timeout |
|-------|----------|---------|----------|---------------|
| Staging | `GET /api/trees` | 30 | 10s | 5 min |
| Production | `GET /api/trees` | 20 | 10s | ~3.3 min |

The smoke test expects HTTP 200. Any other status (including connection refused while the app boots) triggers a retry. If all retries are exhausted, the job fails — preventing a broken staging from being promoted, or alerting on a failed production swap.

### Slot Swap Strategy

Azure App Service **deployment slots** enable zero-downtime deploys:

```
Before swap:
  Production slot → old code (serving users)
  Staging slot    → new code (verified by smoke test)

Swap:
  Azure atomically redirects traffic from production → staging
  No cold start — the staging slot is already warmed up

After swap:
  Production slot → new code (now serving users)
  Staging slot    → old code (rollback available)
```

**Rollback:** If production breaks after a swap, run another swap to revert instantly — the old code is still warm in the staging slot.

### Deploy Concurrency

```yaml
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false
```

Unlike CI, deploys **do not cancel** in-progress runs. This prevents a half-deployed state. If a new deploy is triggered while one is running, it queues and waits.

---

## Quality Gates

### Linting

**Status:** Not yet configured — CI step passes silently via `--if-present`.

To enable, add ESLint to server and client (see [Adding ESLint](#adding-eslint) below). Once a `lint` script exists in either workspace's `package.json`, CI will enforce it automatically.

### Type Checking

**Status:** Active and enforced.

Both server and client have TypeScript strict mode enabled. CI runs `tsc --noEmit` (type-check without emitting files) on each workspace independently:

| Workspace | Target | Module | Strict |
|-----------|--------|--------|--------|
| Server | ES2022 | NodeNext | ✅ |
| Client | ES2020 | ESNext (bundler) | ✅ |

A type error in either workspace will **fail the CI pipeline**.

### Automated Tests

**Status:** Not yet configured — CI step passes silently via `--if-present`.

To enable, add Vitest and test files (see [Adding Tests](#adding-tests-to-the-project) below). Once a `test` script exists in either workspace's `package.json`, CI will enforce it automatically.

### Build Verification

**Status:** Active and enforced.

`npm run build` runs:
1. **Server:** `tsc` — compiles TypeScript to `server/dist/`
2. **Client:** `tsc && vite build` — type-checks then bundles React app to `client/dist/`

A build failure (compilation error, missing import, Vite build error) will **fail the CI pipeline**.

---

## Adding Tests to the Project

The CI pipeline is pre-wired to run tests — you just need to install a test framework and add test files. Here's the recommended setup:

### Server Tests (Vitest)

```bash
# Install Vitest
cd server
npm install -D vitest
```

Add to `server/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create a test file at `server/src/__tests__/tree-engine.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { TreeEngine } from '../tree-engine.js';

describe('TreeEngine', () => {
  it('should start a session from the root node', () => {
    const engine = new TreeEngine();
    const tree = {
      id: 'test',
      name: 'Test Tree',
      nodes: [{ id: 'root', type: 'input', label: 'Start', inputType: 'text' }],
      edges: [],
      rootNodeId: 'root',
      weightDimensions: [],
    };
    const session = engine.startSession(tree, {});
    expect(session.currentNodeId).toBe('root');
  });
});
```

### Client Tests (Vitest + React Testing Library)

```bash
# Install test dependencies
cd client
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `client/package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create `client/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

Create `client/src/test-setup.ts`:
```typescript
import '@testing-library/jest-dom';
```

Create a test file at `client/src/__tests__/App.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('should render without crashing', () => {
    render(<App />);
    expect(document.body).toBeTruthy();
  });
});
```

### Adding ESLint

```bash
# From the repo root
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

Add lint scripts to each workspace's `package.json`:
```json
{
  "scripts": {
    "lint": "eslint src/ --ext .ts,.tsx"
  }
}
```

Once the `lint` script exists, CI will enforce it automatically — no workflow changes needed.

---

## Infrastructure Setup

### Azure App Service

Create the App Service and staging slot:

```bash
# Create resource group
az group create \
  --name rg-decision-tree \
  --location eastus

# Create App Service plan (B1 minimum for deployment slots)
az appservice plan create \
  --name plan-decision-tree \
  --resource-group rg-decision-tree \
  --sku B1 \
  --is-linux

# Create the web app
az webapp create \
  --name decision-tree-copilot \
  --resource-group rg-decision-tree \
  --plan plan-decision-tree \
  --runtime "NODE:22-lts"

# Create the staging deployment slot
az webapp deployment slot create \
  --name decision-tree-copilot \
  --resource-group rg-decision-tree \
  --slot staging

# Configure the startup command
az webapp config set \
  --name decision-tree-copilot \
  --resource-group rg-decision-tree \
  --startup-file "node server/dist/index.js"
```

> **Important:** Deployment slots require **Basic (B1)** tier or higher. The Free/Shared tiers don't support slots.

### GitHub Secrets

Navigate to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** and add:

| Secret Name | How to Generate | Description |
|-------------|----------------|-------------|
| `AZURE_CREDENTIALS` | See command below | Service principal JSON for Azure login |

Generate the service principal:

```bash
az ad sp create-for-rbac \
  --name "gh-deploy-decision-tree" \
  --role contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>/resourceGroups/rg-decision-tree \
  --sdk-auth
```

Copy the **entire JSON output** and paste it as the `AZURE_CREDENTIALS` secret value. The JSON looks like:

```json
{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "...",
  "tenantId": "...",
  "activeDirectoryEndpointUrl": "...",
  "resourceManagerEndpointUrl": "...",
  "activeDirectoryGraphResourceId": "...",
  "sqlManagementEndpointUrl": "...",
  "galleryEndpointUrl": "...",
  "managementEndpointUrl": "..."
}
```

### GitHub Environments (Approval Gate)

Navigate to your GitHub repo → **Settings** → **Environments**:

1. **Create `staging` environment**
   - No protection rules needed (deploys automatically)
   - Optional: add environment-specific secrets/variables

2. **Create `production` environment**
   - Enable **Required reviewers**
   - Add yourself and/or your team as required approvers
   - Optional: add a **wait timer** (e.g., 5 minutes) for extra safety
   - Optional: restrict to `main` branch only under **Deployment branches**

When a deploy reaches the `deploy-production` job, GitHub will pause the workflow and send a notification to the required reviewers. The deploy proceeds only after approval.

### Customizing Environment Variables

Update these values in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) to match your Azure resources:

```yaml
env:
  AZURE_WEBAPP_NAME: decision-tree-copilot   # Your App Service name
  AZURE_RESOURCE_GROUP: rg-decision-tree      # Your resource group
  SLOT_NAME: staging                          # Staging slot name
```

To add application environment variables (API keys, feature flags, etc.), configure them in the Azure Portal under **App Service** → **Configuration** → **Application settings**, or via CLI:

```bash
az webapp config appsettings set \
  --name decision-tree-copilot \
  --resource-group rg-decision-tree \
  --settings GITHUB_TOKEN=ghp_... NODE_ENV=production PORT=8080
```

---

## Development Environment

### GitHub Codespaces

The repository includes a [`.devcontainer/devcontainer.json`](.devcontainer/devcontainer.json) for one-click cloud development:

- **Image:** Node.js 22 (Microsoft dev container)
- **Post-create:** `npm install` runs automatically
- **Port forwarding:** Client (5173) and API server (3001) are forwarded
- **Launch:** Click **"Code" → "Open with Codespaces"** on the GitHub repo page

```bash
# Inside the Codespace, start both client and server:
npm run dev
```

The client opens automatically in your browser via Codespaces port forwarding.

### Local Development

```bash
# Prerequisites: Node.js 22+, npm 10+

# Clone and install
git clone https://github.com/<org>/decision-tree-copilot.git
cd decision-tree-copilot
npm install

# Configure the server
cp server/.env.example server/.env
# Edit server/.env with your GitHub token

# Start both frontend and backend
npm run dev
# Client: http://localhost:5173
# Server: http://localhost:3001
```

---

## Troubleshooting

### CI fails on type-check but builds locally

- Ensure you're on the same Node.js version (22) as CI
- Run `npx --workspace=server tsc --noEmit` and `npx --workspace=client tsc --noEmit` locally to reproduce
- CI uses `npm ci` (clean install from lockfile) — run `npm ci` locally to match

### Deploy workflow doesn't trigger

- The deploy workflow only runs when CI **succeeds** on `main`. Check:
  - Is the push to `main`? (develop and feature branches skip deploy)
  - Did CI pass? (check the CI workflow run)
  - The `workflow_run` trigger requires the CI workflow name to match exactly: `CI`

### Staging smoke test fails

- The app may take longer to cold-start. The smoke test allows 5 minutes — if your App Service plan is slow to boot, increase the retry count in `deploy.yml`
- Check App Service logs: `az webapp log tail --name decision-tree-copilot --resource-group rg-decision-tree --slot staging`
- Verify the startup command is set: `node server/dist/index.js`

### Production approval is stuck

- Go to **Actions** → find the deploy run → click **Review deployments** → select the `production` environment → **Approve**
- Only users listed as required reviewers on the `production` environment can approve

### Slot swap fails

- Ensure the staging slot is running and healthy before swap
- Check for slot-sticky settings: `az webapp config appsettings list --name decision-tree-copilot --resource-group rg-decision-tree --slot staging`
- Verify the service principal has Contributor access to the App Service

### Rolling back a bad production deploy

The fastest rollback is to swap again — the old code is still warm in the staging slot:

```bash
az webapp deployment slot swap \
  --name decision-tree-copilot \
  --resource-group rg-decision-tree \
  --slot staging \
  --target-slot production
```

This is instantaneous and requires no rebuild.

---

## Reference

| Resource | Link |
|----------|------|
| GitHub Actions — workflow_run trigger | https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run |
| GitHub Environments & approvals | https://docs.github.com/en/actions/deployment/targeting-different-environments/managing-environments-for-deployment |
| Azure App Service deployment slots | https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots |
| Azure Web Apps Deploy action | https://github.com/Azure/webapps-deploy |
| Azure Login action | https://github.com/Azure/login |
| Vitest documentation | https://vitest.dev/ |
| React Testing Library | https://testing-library.com/docs/react-testing-library/intro/ |

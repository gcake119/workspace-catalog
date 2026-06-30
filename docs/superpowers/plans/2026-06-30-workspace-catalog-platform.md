# Workspace Catalog Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase 1-3 of Workspace Catalog: a Codex skill, hook guidance, and reusable scan/status/drift CLI foundation for agent-assisted catalog authoring.

**Architecture:** The MVP separates confirmed semantics from inferred drafts and live status. A repo-local skill defines the human-in-the-loop workflow, Markdown hook guidance defines preflight/drift reminders, and a small Node.js CLI provides deterministic scan/status/drift automation using fixture-friendly collectors.

**Tech Stack:** Markdown skills and docs, Node.js ESM CLI, pnpm, Node `node:test`, `yaml` for catalog parsing and writing, Git/Spectra shell collectors with fail-soft behavior.

---

## File Structure

- Create `skills/workspace-catalog/SKILL.md` for the reusable Codex skill workflow.
- Create `skills/workspace-catalog/templates/workspace.catalog.yaml` as the confirmed catalog template.
- Create `skills/workspace-catalog/templates/workspace.catalog.draft.yaml` as the inferred draft template.
- Create `hooks/workspace-catalog-preflight.md` for hook/reminder behavior.
- Create `cli/package.json` for the CLI package metadata and scripts.
- Create `cli/src/index.js` for command dispatch.
- Create `cli/src/catalog-schema.js` for minimal schema validation.
- Create `cli/src/scanner.js` for deterministic workspace file discovery.
- Create `cli/src/collectors/git.js` for fail-soft Git status collection.
- Create `cli/src/collectors/spectra.js` for fail-soft Spectra change collection.
- Create `cli/src/status.js` for status snapshot creation.
- Create `cli/src/drift.js` for catalog drift checks.
- Create `cli/test/scanner.test.js`, `cli/test/status.test.js`, and `cli/test/drift.test.js` for fixture-driven coverage.
- Create `examples/local-meeting-workspace/workspace.catalog.example.yaml` as the first dogfood example.

## Task 1: Phase 1 Codex Skill

**Files:**
- Create: `skills/workspace-catalog/SKILL.md`
- Create: `skills/workspace-catalog/templates/workspace.catalog.yaml`
- Create: `skills/workspace-catalog/templates/workspace.catalog.draft.yaml`

- [ ] **Step 1: Write the skill file**

Create `skills/workspace-catalog/SKILL.md` with:

```markdown
---
name: workspace-catalog
description: Use when entering, auditing, or initializing a split repo workspace so Codex can infer tool roles, workflows, contracts, and live status without treating unconfirmed guesses as source of truth.
---

# Workspace Catalog

Use this skill to create or refresh a workspace catalog for split repo workspaces.

## Core Rule

Never write inferred product semantics directly to `workspace.catalog.yaml`.

The workflow is:

1. Scan workspace evidence.
2. Generate `workspace.catalog.draft.yaml`.
3. Mark every inferred role, workflow, and contract with `confidence` and `inferred_from`.
4. Ask the user to confirm uncertain semantics.
5. Only after confirmation, write or update `workspace.catalog.yaml`.
6. Collect live status separately.
7. Report drift instead of silently rewriting confirmed semantics.

## Evidence To Read

Read these sources when present:

- Root `AGENTS.md`, `.cursorrules`, `.cursor/rules/`, and equivalent repo guidance.
- Child repo `AGENTS.md`.
- README files.
- `docs/decisions/index.md` and `docs/decisions/ADR-*.md`.
- `openspec/specs`.
- `openspec/changes`.
- `docs/superpowers/specs`.
- `docs/superpowers/plans`.
- `package.json`.
- Git branch, recent commits, and dirty status.
- codebase-memory project list when available.

## Output Files

- `workspace.catalog.draft.yaml`: inferred semantics awaiting user confirmation.
- `workspace.catalog.yaml`: confirmed catalog SSOT.
- `.workspace-catalog/status.json`: live status snapshot.
- `.workspace-catalog/drift-report.md`: drift findings.

## Confirmation Rules

Ask the user one question at a time when semantics are unclear.

Examples:

- "I infer OpenKnowledge is an editor/reference, not a workspace SSOT. Is that correct?"
- "I infer Meeting Agent is a read-only source for LLM-wiki. Is that still correct?"
- "I infer this workspace uses Spectra as change/spec SSOT. Should the catalog enforce that?"

## Forbidden Behavior

- Do not auto-confirm low-confidence inferences.
- Do not let Git status override confirmed tool roles.
- Do not replace Spectra, ADR, Git, or codebase-memory.
- Do not build renderer or local web app during Phase 1-3 work.
```

- [ ] **Step 2: Add the confirmed catalog template**

Create `skills/workspace-catalog/templates/workspace.catalog.yaml` with:

```yaml
schema_version: 1

workspace:
  id: example-workspace
  name: Example Workspace
  purpose: Replace this after user confirmation.
  orientation: Replace this after user confirmation.

workflows: []

tools: []

agent_preflight:
  - Read workspace.catalog.yaml.
  - Read relevant AGENTS.md files.
  - Read active Spectra changes and related ADRs.
  - Use codebase-memory for code discovery before grep.
```

- [ ] **Step 3: Add the draft catalog template**

Create `skills/workspace-catalog/templates/workspace.catalog.draft.yaml` with:

```yaml
schema_version: 1

workspace:
  id:
    value: example-workspace
    confidence: low
    inferred_from: []
  name:
    value: Example Workspace
    confidence: low
    inferred_from: []
  purpose:
    value: Replace with inferred purpose.
    confidence: low
    inferred_from: []

workflows: []

tools: []

questions: []
```

- [ ] **Step 4: Verify skill artifacts**

Run:

```bash
test -f skills/workspace-catalog/SKILL.md
test -f skills/workspace-catalog/templates/workspace.catalog.yaml
test -f skills/workspace-catalog/templates/workspace.catalog.draft.yaml
```

Expected: all commands exit `0`.

- [ ] **Step 5: Commit Phase 1**

Run:

```bash
git add skills/workspace-catalog/SKILL.md skills/workspace-catalog/templates/workspace.catalog.yaml skills/workspace-catalog/templates/workspace.catalog.draft.yaml
git commit -m "feat: 建立 workspace catalog skill"
```

## Task 2: Phase 2 Hook Guidance

**Files:**
- Create: `hooks/workspace-catalog-preflight.md`

- [ ] **Step 1: Write hook guidance**

Create `hooks/workspace-catalog-preflight.md` with:

```markdown
# Workspace Catalog Preflight Hook

This hook guidance describes when Codex should remind the user to read or refresh a workspace catalog.

## Trigger Moments

- A session starts in a directory that contains `workspace.catalog.yaml`.
- A session starts in a split repo workspace that does not contain `workspace.catalog.yaml`.
- Files matching `AGENTS.md`, `README.md`, `docs/decisions/**`, `openspec/changes/**`, or `openspec/specs/**` changed.
- A Spectra archive has just completed.
- The user asks for cross-repo, workflow, architecture, or project-status work.

## Reminder Behavior

When `workspace.catalog.yaml` exists, remind the agent:

```text
Read workspace.catalog.yaml before inferring tool roles, workflow boundaries, or active project direction.
```

When catalog is missing, suggest:

```text
Use the workspace-catalog skill to scan this workspace and produce a draft catalog for user confirmation.
```

When potential drift is detected, report:

```text
Catalog drift may exist because workspace guidance, ADRs, README, or Spectra artifacts changed. Run workspace-catalog drift or refresh the draft before relying on old catalog semantics.
```

## Boundaries

- The hook does not edit files.
- The hook does not confirm inferred semantics.
- The hook does not replace the workspace-catalog skill.
```

- [ ] **Step 2: Verify hook guidance**

Run:

```bash
test -f hooks/workspace-catalog-preflight.md
grep -q "The hook does not edit files" hooks/workspace-catalog-preflight.md
```

Expected: both commands exit `0`.

- [ ] **Step 3: Commit Phase 2**

Run:

```bash
git add hooks/workspace-catalog-preflight.md
git commit -m "docs: 定義 workspace catalog preflight hook"
```

## Task 3: Phase 3 CLI Foundation

**Files:**
- Create: `cli/package.json`
- Create: `cli/src/index.js`
- Create: `cli/src/catalog-schema.js`
- Create: `cli/src/scanner.js`
- Create: `cli/test/scanner.test.js`

- [ ] **Step 1: Create CLI package metadata**

Create `cli/package.json` with:

```json
{
  "name": "@local/workspace-catalog",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "workspace-catalog": "src/index.js"
  },
  "scripts": {
    "test": "node --test test/*.test.js"
  },
  "dependencies": {
    "yaml": "^2.5.1"
  }
}
```

- [ ] **Step 2: Create schema validation module**

Create `cli/src/catalog-schema.js` with:

```js
export function validateCatalog(catalog) {
  const errors = [];

  if (!catalog || typeof catalog !== "object") {
    errors.push("catalog must be an object");
    return errors;
  }

  if (catalog.schema_version !== 1) {
    errors.push("schema_version must be 1");
  }

  if (!catalog.workspace || typeof catalog.workspace !== "object") {
    errors.push("workspace is required");
  } else {
    if (!catalog.workspace.id) errors.push("workspace.id is required");
    if (!catalog.workspace.name) errors.push("workspace.name is required");
    if (!catalog.workspace.purpose) errors.push("workspace.purpose is required");
  }

  if (!Array.isArray(catalog.workflows)) {
    errors.push("workflows must be an array");
  }

  if (!Array.isArray(catalog.tools)) {
    errors.push("tools must be an array");
  }

  return errors;
}
```

- [ ] **Step 3: Write scanner tests**

Create `cli/test/scanner.test.js` with:

```js
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { scanWorkspace } from "../src/scanner.js";

test("scanWorkspace finds root and child repo guidance files", async (t) => {
  const root = join(t.mock.tmpdir(), "workspace");
  await mkdir(join(root, "tool-a", "docs", "decisions"), { recursive: true });
  await writeFile(join(root, "AGENTS.md"), "# Root rules\n");
  await writeFile(join(root, "README.md"), "# Workspace\n");
  await writeFile(join(root, "tool-a", "AGENTS.md"), "# Tool rules\n");
  await writeFile(join(root, "tool-a", "README.md"), "# Tool A\n");
  await writeFile(join(root, "tool-a", "docs", "decisions", "index.md"), "# Decisions\n");

  const result = await scanWorkspace(root);

  assert.deepEqual(result.root.guidance.sort(), ["AGENTS.md", "README.md"]);
  assert.equal(result.tools.length, 1);
  assert.equal(result.tools[0].path, "tool-a");
  assert.deepEqual(result.tools[0].guidance.sort(), [
    "tool-a/AGENTS.md",
    "tool-a/README.md",
    "tool-a/docs/decisions/index.md"
  ]);
});
```

- [ ] **Step 4: Implement scanner**

Create `cli/src/scanner.js` with:

```js
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT_GUIDANCE = ["AGENTS.md", "README.md"];
const TOOL_GUIDANCE = [
  "AGENTS.md",
  "README.md",
  "docs/decisions/index.md",
  "openspec/config.yaml"
];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function listChildDirs(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

async function collectExisting(root, base, files) {
  const found = [];
  for (const file of files) {
    const absolute = join(root, base, file);
    if (await exists(absolute)) {
      found.push(relative(root, absolute));
    }
  }
  return found;
}

export async function scanWorkspace(root) {
  const rootGuidance = await collectExisting(root, "", ROOT_GUIDANCE);
  const childDirs = await listChildDirs(root);
  const tools = [];

  for (const dir of childDirs) {
    const guidance = await collectExisting(root, dir, TOOL_GUIDANCE);
    if (guidance.length > 0) {
      tools.push({
        path: dir,
        guidance
      });
    }
  }

  return {
    root: {
      path: ".",
      guidance: rootGuidance
    },
    tools
  };
}
```

- [ ] **Step 5: Create CLI command dispatch**

Create `cli/src/index.js` with:

```js
#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { scanWorkspace } from "./scanner.js";

async function main() {
  const command = process.argv[2];
  const workspace = resolve(process.argv[3] ?? process.cwd());

  if (command === "scan") {
    const scan = await scanWorkspace(workspace);
    const draft = {
      schema_version: 1,
      workspace: {
        id: {
          value: workspace.split("/").filter(Boolean).at(-1),
          confidence: "medium",
          inferred_from: scan.root.guidance
        },
        name: {
          value: workspace.split("/").filter(Boolean).at(-1),
          confidence: "medium",
          inferred_from: scan.root.guidance
        },
        purpose: {
          value: "Review workspace docs to confirm purpose.",
          confidence: "low",
          inferred_from: scan.root.guidance
        }
      },
      workflows: [],
      tools: scan.tools.map((tool) => ({
        id: tool.path,
        path: `./${tool.path}`,
        role: {
          value: "unknown",
          confidence: "low",
          inferred_from: tool.guidance
        },
        primary_docs: tool.guidance
      })),
      questions: scan.tools.map((tool) => `What role does ${tool.path} play in this workspace?`)
    };

    await writeFile(resolve(workspace, "workspace.catalog.draft.yaml"), stringify(draft));
    console.log(`Wrote ${resolve(workspace, "workspace.catalog.draft.yaml")}`);
    return;
  }

  console.error("Usage: workspace-catalog scan [workspace]");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
```

- [ ] **Step 6: Run scanner tests**

Run:

```bash
pnpm --dir cli install
pnpm --dir cli test
```

Expected: scanner test passes.

- [ ] **Step 7: Commit CLI foundation**

Run:

```bash
git add cli/package.json cli/src/index.js cli/src/catalog-schema.js cli/src/scanner.js cli/test/scanner.test.js
git commit -m "feat: 建立 workspace catalog scan CLI"
```

## Task 4: Status And Drift Commands

**Files:**
- Create: `cli/src/collectors/git.js`
- Create: `cli/src/collectors/spectra.js`
- Create: `cli/src/status.js`
- Create: `cli/src/drift.js`
- Modify: `cli/src/index.js`
- Create: `cli/test/status.test.js`
- Create: `cli/test/drift.test.js`

- [ ] **Step 1: Create fail-soft Git collector**

Create `cli/src/collectors/git.js` with:

```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function collectGitStatus(cwd) {
  try {
    const branch = await execFileAsync("git", ["-C", cwd, "branch", "--show-current"]);
    const status = await execFileAsync("git", ["-C", cwd, "status", "--short"]);
    const latest = await execFileAsync("git", ["-C", cwd, "log", "--oneline", "-1"]);

    return {
      ok: true,
      branch: branch.stdout.trim(),
      dirty_files: status.stdout.trim().split("\n").filter(Boolean),
      latest_commit: latest.stdout.trim()
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

- [ ] **Step 2: Create fail-soft Spectra collector**

Create `cli/src/collectors/spectra.js` with:

```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function collectSpectraStatus(cwd) {
  try {
    const result = await execFileAsync("spectra", ["list", "--json"], { cwd });
    return {
      ok: true,
      raw: JSON.parse(result.stdout)
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
```

- [ ] **Step 3: Write status tests**

Create `cli/test/status.test.js` with:

```js
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { createStatusSnapshot } from "../src/status.js";

test("createStatusSnapshot keeps status separate from confirmed semantics", async (t) => {
  const root = join(t.mock.tmpdir(), "workspace");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "workspace.catalog.yaml"), `
schema_version: 1
workspace:
  id: sample
  name: Sample
  purpose: Confirmed purpose
workflows: []
tools:
  - id: tool-a
    path: ./tool-a
    role: source-tool
`);

  const status = await createStatusSnapshot(root, {
    gitCollector: async () => ({ ok: false, error: "not a git repo" }),
    spectraCollector: async () => ({ ok: false, error: "spectra unavailable" })
  });

  assert.equal(status.workspace.id, "sample");
  assert.equal(status.tools[0].id, "tool-a");
  assert.equal(status.tools[0].role, "source-tool");
  assert.equal(status.git.ok, false);
  assert.equal(status.spectra.ok, false);
});
```

- [ ] **Step 4: Implement status snapshot**

Create `cli/src/status.js` with:

```js
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parse, stringify } from "yaml";
import { collectGitStatus } from "./collectors/git.js";
import { collectSpectraStatus } from "./collectors/spectra.js";
import { validateCatalog } from "./catalog-schema.js";

export async function createStatusSnapshot(root, options = {}) {
  const catalogPath = resolve(root, "workspace.catalog.yaml");
  const catalog = parse(await readFile(catalogPath, "utf8"));
  const errors = validateCatalog(catalog);
  if (errors.length > 0) {
    throw new Error(`Invalid catalog: ${errors.join(", ")}`);
  }

  const gitCollector = options.gitCollector ?? collectGitStatus;
  const spectraCollector = options.spectraCollector ?? collectSpectraStatus;

  return {
    generated_at: new Date().toISOString(),
    workspace: catalog.workspace,
    tools: catalog.tools.map((tool) => ({
      id: tool.id,
      path: tool.path,
      role: tool.role
    })),
    git: await gitCollector(root),
    spectra: await spectraCollector(root)
  };
}

export async function writeStatusSnapshot(root, snapshot) {
  const dir = resolve(root, ".workspace-catalog");
  await mkdir(dir, { recursive: true });
  const outputPath = resolve(dir, "status.json");
  await writeFile(outputPath, JSON.stringify(snapshot, null, 2));
  return outputPath;
}
```

- [ ] **Step 5: Write drift tests**

Create `cli/test/drift.test.js` with:

```js
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { detectCatalogDrift } from "../src/drift.js";

test("detectCatalogDrift reports tool paths missing from current scan", async (t) => {
  const root = join(t.mock.tmpdir(), "workspace");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "workspace.catalog.yaml"), `
schema_version: 1
workspace:
  id: sample
  name: Sample
  purpose: Confirmed purpose
workflows: []
tools:
  - id: missing-tool
    path: ./missing-tool
    role: source-tool
`);

  const report = await detectCatalogDrift(root);

  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].code, "CATALOG_TOOL_PATH_MISSING");
});
```

- [ ] **Step 6: Implement drift detection**

Create `cli/src/drift.js` with:

```js
import { stat, writeFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

export async function detectCatalogDrift(root) {
  const catalog = parse(await readFile(resolve(root, "workspace.catalog.yaml"), "utf8"));
  const items = [];

  for (const tool of catalog.tools ?? []) {
    const normalizedPath = String(tool.path ?? "").replace(/^\.\//, "");
    if (!normalizedPath || !(await exists(resolve(root, normalizedPath)))) {
      items.push({
        code: "CATALOG_TOOL_PATH_MISSING",
        message: `Catalog tool path is missing: ${tool.path}`,
        tool_id: tool.id
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    items
  };
}

export async function writeDriftReport(root, report) {
  const dir = resolve(root, ".workspace-catalog");
  await mkdir(dir, { recursive: true });
  const outputPath = resolve(dir, "drift-report.md");
  const lines = [
    "# Workspace Catalog Drift Report",
    "",
    `Generated: ${report.generated_at}`,
    "",
    ...report.items.map((item) => `- ${item.code}: ${item.message}`)
  ];
  await writeFile(outputPath, `${lines.join("\n")}\n`);
  return outputPath;
}
```

- [ ] **Step 7: Extend command dispatch**

Modify `cli/src/index.js` to:

```js
#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { detectCatalogDrift, writeDriftReport } from "./drift.js";
import { scanWorkspace } from "./scanner.js";
import { createStatusSnapshot, writeStatusSnapshot } from "./status.js";

async function runScan(workspace) {
  const scan = await scanWorkspace(workspace);
  const draft = {
    schema_version: 1,
    workspace: {
      id: {
        value: workspace.split("/").filter(Boolean).at(-1),
        confidence: "medium",
        inferred_from: scan.root.guidance
      },
      name: {
        value: workspace.split("/").filter(Boolean).at(-1),
        confidence: "medium",
        inferred_from: scan.root.guidance
      },
      purpose: {
        value: "Review workspace docs to confirm purpose.",
        confidence: "low",
        inferred_from: scan.root.guidance
      }
    },
    workflows: [],
    tools: scan.tools.map((tool) => ({
      id: tool.path,
      path: `./${tool.path}`,
      role: {
        value: "unknown",
        confidence: "low",
        inferred_from: tool.guidance
      },
      primary_docs: tool.guidance
    })),
    questions: scan.tools.map((tool) => `What role does ${tool.path} play in this workspace?`)
  };

  const output = resolve(workspace, "workspace.catalog.draft.yaml");
  await writeFile(output, stringify(draft));
  console.log(`Wrote ${output}`);
}

async function main() {
  const command = process.argv[2];
  const workspace = resolve(process.argv[3] ?? process.cwd());

  if (command === "scan") {
    await runScan(workspace);
    return;
  }

  if (command === "status") {
    const snapshot = await createStatusSnapshot(workspace);
    const output = await writeStatusSnapshot(workspace, snapshot);
    console.log(`Wrote ${output}`);
    return;
  }

  if (command === "drift") {
    const report = await detectCatalogDrift(workspace);
    const output = await writeDriftReport(workspace, report);
    console.log(`Wrote ${output}`);
    return;
  }

  console.error("Usage: workspace-catalog <scan|status|drift> [workspace]");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
```

- [ ] **Step 8: Run CLI tests**

Run:

```bash
pnpm --dir cli test
```

Expected: scanner, status, and drift tests pass.

- [ ] **Step 9: Commit status and drift commands**

Run:

```bash
git add cli/src/index.js cli/src/collectors/git.js cli/src/collectors/spectra.js cli/src/status.js cli/src/drift.js cli/test/status.test.js cli/test/drift.test.js
git commit -m "feat: 加入 catalog status 與 drift CLI"
```

## Task 5: Dogfood Example And Closeout

**Files:**
- Create: `examples/local-meeting-workspace/workspace.catalog.example.yaml`
- Modify: `README.md`

- [ ] **Step 1: Add local-meeting-workspace example**

Create `examples/local-meeting-workspace/workspace.catalog.example.yaml` with:

```yaml
schema_version: 1

workspace:
  id: local-meeting-workspace
  name: Local Meeting Workspace
  purpose: 個人知識管理工作流工具開發 workspace
  orientation: >
    Meeting Agent produces transcript-ready meeting artifacts.
    Hermes Wiki Engine manages workspace-first knowledge review and publish boundaries.
    OpenKnowledge is an editor/reference or future publish/editing target, not the current workspace SSOT.

workflows:
  - id: meeting-to-knowledge
    name: Meeting to Knowledge
    summary: 會議錄音轉成 transcript-ready output，再進入 knowledge workspace review。
    stages:
      - source
      - draft
      - review
      - knowledge
      - publish
    contracts:
      - Meeting Agent does not own summary, approval, or writeback.
      - Approve and publish are separate.

tools:
  - id: meeting-agent
    name: Meeting Agent
    path: ./meeting-agent
    role: source-tool
    purpose: Produces transcript-ready meeting artifacts.
    participates_in:
      - meeting-to-knowledge
    confirmed_contracts:
      - Emits manifest.json and transcript.md.
      - Does not own LLM-wiki summary, approval, or writeback.
    primary_docs:
      - meeting-agent/README.md
      - meeting-agent/docs/llm-wiki-handoff.md

  - id: hermes-wiki-engine
    name: Hermes Wiki Engine
    path: ./hermes-wiki-engine
    role: knowledge-engine
    purpose: Workspace-first knowledge engine and Workbench.
    participates_in:
      - meeting-to-knowledge
    confirmed_contracts:
      - Workspace knowledge is the organized knowledge SSOT.
      - Approve and publish are separate.
      - CLI, Workbench, Hermes, and LaunchDaemon share single core runtime.
    primary_docs:
      - hermes-wiki-engine/README.md
      - hermes-wiki-engine/docs/decisions/ADR-0002-single-core-runtime-and-web-workbench.md
      - hermes-wiki-engine/docs/decisions/ADR-0003-workspace-first-knowledge-architecture.md

  - id: open-knowledge
    name: OpenKnowledge
    path: ./open-knowledge
    role: editor-reference
    purpose: Markdown knowledge editor reference and possible future editing or publish target.
    participates_in: []
    confirmed_contracts:
      - Treat as an external mirror/reference unless a later catalog confirms workflow integration.
    primary_docs:
      - open-knowledge/README.md
      - open-knowledge/AGENTS.md

agent_preflight:
  - Read workspace.catalog.yaml before inferring project direction.
  - Read tool AGENTS.md and primary docs before code changes.
  - Use Spectra for active requirements and archive context.
  - Use codebase-memory for structural code discovery.
```

- [ ] **Step 2: Update README with usage**

Replace `README.md` with:

```markdown
# Workspace Catalog

Workspace Catalog is a local-first toolchain for helping Codex and other agents understand split repo workspaces before touching implementation details.

## Phase 1-3 MVP

- Phase 1: Codex skill for agent-assisted catalog authoring.
- Phase 2: preflight and drift reminder guidance.
- Phase 3: reusable scan/status/drift CLI foundation.

Phase 4 static rendering and Phase 5 local web app are deferred.

## Workflow

```text
Scan workspace
  -> Generate inferred catalog draft
  -> Ask user to confirm uncertain semantics
  -> Write confirmed workspace.catalog.yaml
  -> Collect live status
  -> Report drift
```

## CLI

```bash
pnpm --dir cli install
node cli/src/index.js scan /path/to/workspace
node cli/src/index.js status /path/to/workspace
node cli/src/index.js drift /path/to/workspace
```

`scan` writes `workspace.catalog.draft.yaml`.

`status` writes `.workspace-catalog/status.json`.

`drift` writes `.workspace-catalog/drift-report.md`.

Confirmed catalog semantics are never overwritten by collectors.
```

- [ ] **Step 3: Run all tests**

Run:

```bash
pnpm --dir cli test
```

Expected: all tests pass.

- [ ] **Step 4: Run a local scan smoke on example workspace**

Run:

```bash
node cli/src/index.js scan /Users/caiyijun/project/local-meeting-workspace
```

Expected: writes `/Users/caiyijun/project/local-meeting-workspace/workspace.catalog.draft.yaml`. Review the generated file manually; do not commit it unless the user confirms.

- [ ] **Step 5: Commit closeout docs**

Run:

```bash
git add README.md examples/local-meeting-workspace/workspace.catalog.example.yaml
git commit -m "docs: 加入 local meeting workspace catalog 範例"
```

## Self-Review Checklist

- Phase 1-3 are implemented without renderer or local web app.
- `workspace.catalog.yaml` is treated as confirmed SSOT.
- `workspace.catalog.draft.yaml` preserves inference confidence and sources.
- Live status writes to `.workspace-catalog/status.json`.
- Drift report does not mutate confirmed catalog.
- Tests use fixtures and fail-soft collectors rather than requiring a specific live workspace.

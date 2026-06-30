# Workspace Catalog

Workspace Catalog 是給 split repo workspace 使用的 agent 協作工具。它幫助 agent 在改程式前，先知道這個 workspace 有哪些 repo、各自負責什麼、重要決策文件在哪裡。

Workspace Catalog is an agent collaboration tool for split repo workspaces. It helps agents understand which repos exist, what each repo owns, and where important decision docs live before changing code.

## 適用情境／Use Case

```text
project-workspace/
  frontend/
  backend/
  tools/
  workspace.catalog.yaml
```

這類 workspace 裡，agent 需要先理解 UI、後端契約、工具、工作流邊界、必讀文件與可用 skill。

In this kind of workspace, an agent needs to understand UI ownership, backend contracts, tools, workflow boundaries, required docs, and available skills.

## 它提供什麼／What It Provides

- **Skill**：引導 agent 掃描 workspace、產生 draft，並請使用者確認推論。
  **Skill**: guides agents to scan the workspace, create a draft, and ask the user to confirm inferred meaning.
- **Hook**：在 agent 開工前提醒要讀 catalog、檢查 drift、補齊缺少的決策文件。
  **Hook**: reminds agents to read the catalog, check drift, and add missing decision docs before work starts.
- **CLI**：提供 `scan`、`status`、`drift`、`preflight`。
  **CLI**: provides `scan`, `status`, `drift`, and `preflight`.

它不取代 Git、Spectra、ADR 或 codebase-memory。它只是 agent 協作前的 workspace 導航層。

It does not replace Git, Spectra, ADRs, or codebase-memory. It is only an orientation layer for agent collaboration.

## 資料分層／Data Layers

- `workspace.catalog.yaml`：使用者確認過的 workspace 意義，例如 repo 角色、工作流、契約、skill routing。
  User-confirmed workspace meaning, such as repo roles, workflows, contracts, and skill routing.
- `workspace.catalog.draft.yaml`：agent 掃描後產生的草稿，包含 `confidence` 和 `inferred_from`，等待使用者確認。
  Agent-generated draft with `confidence` and `inferred_from`, waiting for user confirmation.
- `.workspace-catalog/status.json`：即時狀態快照，例如 Git、Spectra、ADR index、package scripts、可用測試指令。
  Live status snapshot, such as Git, Spectra, ADR index, package scripts, and available test commands.

Scanner 和 collector 不會覆蓋 confirmed catalog。

Scanners and collectors never overwrite confirmed catalog semantics.

## 基本流程／Workflow

```text
preflight
  -> scan workspace
  -> write draft catalog
  -> ask user to confirm uncertain semantics
  -> write confirmed catalog
  -> collect status
  -> report drift
```

## 指令／Commands

Install dependencies:

```bash
pnpm --dir cli install
```

Run:

```bash
node cli/src/index.js preflight /path/to/workspace
node cli/src/index.js scan /path/to/workspace
node cli/src/index.js status /path/to/workspace
node cli/src/index.js drift /path/to/workspace
```

Outputs:

- `scan` writes `workspace.catalog.draft.yaml`
- `status` writes `.workspace-catalog/status.json`
- `drift` writes `.workspace-catalog/drift-report.md`
- `preflight` prints reminders only

## Hook

```bash
hooks/workspace-catalog-preflight.js /path/to/workspace
hooks/workspace-catalog-preflight.js /path/to/workspace --changed AGENTS.md
hooks/workspace-catalog-preflight.js /path/to/workspace --event spectra-archive
```

Hook 只提醒，不會改檔案。

The hook only prints reminders. It does not edit files.

## 主要檔案／Main Files

```text
skills/workspace-catalog/SKILL.md
hooks/workspace-catalog-preflight.js
cli/src/index.js
examples/local-meeting-workspace/workspace.catalog.example.yaml
```

## 邊界／Boundaries

Phase 1-3 只包含 skill、hook、CLI。

Phase 1-3 includes skill, hook, and CLI only.

Not included yet:

- renderer
- HTML dashboard
- local web app
- database
- remote sync

## 開發／Development

```bash
pnpm --dir cli test
```

## 社群／Community

- License: MIT
- Contributions: see `CONTRIBUTING.md`
- Security: see `SECURITY.md`
- Conduct: see `CODE_OF_CONDUCT.md`

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
  **CLI**: provides `scan`, `status`, `drift`, `preflight`, and `confirm`.

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

## 架構記憶更新／Architecture Memory Updates

當 skill 透過 `scan` 或 `drift` 發現 workspace 實作、文件、repo 角色、工作流或 skill routing 可能已改變時，它會先產生 draft 或 drift report，並請使用者用白話確認是否要更新架構記憶。

When the skill detects possible changes in implementation, docs, repo roles, workflows, or skill routing through `scan` or `drift`, it first creates a draft or drift report and asks the user to confirm whether the architecture memory should be updated.

使用者確認前，這些發現只算候選變更，不會寫進 `workspace.catalog.yaml`。

Before user confirmation, these findings are only proposed changes and are not written to `workspace.catalog.yaml`.

## 基本流程／Workflow

```text
preflight
  -> scan workspace
  -> write draft catalog
  -> ask user to confirm uncertain semantics
  -> confirm and write confirmed catalog
  -> collect status
  -> report drift
```

`scan` 和 `drift` 只提出候選變更。使用者確認後，agent 要先把 draft 改成 confirmed catalog 形狀，再執行 `confirm` 寫入長期記憶。

`scan` and `drift` only propose changes. After user confirmation, the agent must rewrite the draft into confirmed catalog shape before running `confirm` to write durable memory.

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
node cli/src/index.js confirm /path/to/workspace --yes
```

Outputs:

- `scan` writes `workspace.catalog.draft.yaml`
- `status` writes `.workspace-catalog/status.json`
- `drift` writes `.workspace-catalog/drift-report.md`
- `confirm --yes` writes `workspace.catalog.yaml` from a reviewed draft
- `preflight` prints reminders only

`confirm` 會拒絕仍含 `confidence` 和 `inferred_from` 的未確認推論。

`confirm` rejects drafts that still contain unconfirmed `confidence` and `inferred_from` wrappers.

## Hook

```bash
hooks/workspace-catalog-preflight.js /path/to/workspace
hooks/workspace-catalog-preflight.js /path/to/workspace --changed AGENTS.md
hooks/workspace-catalog-preflight.js /path/to/workspace --event spectra-archive
```

手動 hook 會檢查指定 workspace。Session hook 採 strict mode：只有目前路徑往上找得到 `workspace.catalog.yaml`，才會執行提醒；找不到就安靜跳過。

The manual hook checks a specific workspace. The session hook uses strict mode: it only runs when it can find `workspace.catalog.yaml` by walking up from the current path; otherwise it stays quiet.

```bash
hooks/workspace-catalog-session-preflight.js /path/inside/initialized/workspace
```

Hook 只提醒，不會改檔案，也不會自動修改 `~/.codex/hooks.json`。

Hooks only print reminders. They do not edit files or automatically modify `~/.codex/hooks.json`.

Example Codex `SessionStart` hook:

```json
{
  "type": "command",
  "command": "'/path/to/workspace-catalog/hooks/workspace-catalog-session-preflight.js'",
  "timeout": 5
}
```

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

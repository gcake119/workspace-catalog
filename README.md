# Workspace Catalog

Workspace Catalog 是給 split repo workspace 使用的本機 agent 架構記憶工具。

Workspace Catalog is a local agent architecture memory tool for split repo workspaces.

## 使用情境／Use Case

當一個 workspace 裡有多個子 repo，例如：

When a workspace has multiple child repos, for example:

```text
project-workspace/
  frontend/
  backend/
  tools/
```

agent 需要先知道：

Agents need to know:

- 哪個 repo 負責什麼。
  Which repo owns what.
- 工作流和 repo 邊界在哪裡。
  Where workflow and repo boundaries are.
- 各 repo 適合使用哪些 skill。
  Which skills fit each repo.

Workspace Catalog 會把這些資訊存在本機：

Workspace Catalog stores this as local memory:

```text
.workspace-catalog/catalog.yaml
```

這跟 codebase-memory 類似，是本機記憶，不需要版本控制。

Like codebase-memory, this is local memory and does not need to be version-controlled.

This project references the architecture direction of [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp): a local binary writes local memory/index files, and agents read that local memory before doing expensive exploration. Workspace Catalog applies the same idea to split repo workflow memory instead of source-code call graphs.

## 安裝與使用／Install And Use

Install from source:

```bash
git clone https://github.com/gcake119/workspace-catalog.git
cd workspace-catalog
./scripts/install.sh
```

The installer builds the Rust CLI and installs:

安裝腳本會建置 Rust CLI，並安裝：

- `workspace-catalog`
- `workspace-catalog-preflight`
- `workspace-catalog-session-preflight`
- Codex skill：`workspace-catalog`

Initialize or refresh a workspace:

```bash
workspace-catalog scan /path/to/workspace
```

Ask one review question at a time:

```bash
workspace-catalog next-question /path/to/workspace
```

Record the user's answer, then ask the next question:

```bash
workspace-catalog answer-question /path/to/workspace tools.frontend.role --answer "frontend owns the user-facing UI."
workspace-catalog next-question /path/to/workspace
```

After the user confirms the meaning, write local memory:

```bash
workspace-catalog confirm /path/to/workspace --yes
```

Useful commands:

```bash
workspace-catalog preflight /path/to/workspace
workspace-catalog status /path/to/workspace
workspace-catalog drift /path/to/workspace
```

Uninstall:

```bash
./scripts/uninstall.sh
```

解除安裝只會移除這個 repo 安裝出去的 symlink，不會刪掉任何 workspace 裡的 `.workspace-catalog/` 記憶。

Uninstall only removes symlinks installed from this repo. It does not delete `.workspace-catalog/` memory in your workspaces.

## 記憶如何更新／How Memory Updates

`scan` 會重新讀 workspace 文件和子 repo，產生候選記憶與逐題確認佇列：

`scan` rereads workspace docs and child repos, then writes candidate memory and a one-question-at-a-time review queue:

```text
.workspace-catalog/catalog.draft.yaml
.workspace-catalog/review.md
.workspace-catalog/review-questions.json
```

`drift` 會比對目前 workspace 和已確認記憶：

`drift` compares the current workspace with confirmed memory:

```text
.workspace-catalog/drift-report.md
```

如果 agent 發現工作流、子 repo 關係、邊界或 skill routing 有變，它會請使用者確認。

If the agent sees changes in workflows, child repo relationships, boundaries, or skill routing, it asks the user to confirm.

使用者確認後，`confirm --yes` 才會更新：

After user confirmation, `confirm --yes` updates:

```text
.workspace-catalog/catalog.yaml
```

`confirm` 會拒絕仍含 `confidence` 和 `inferred_from` 的未確認推論，避免把猜測寫進記憶。

`confirm` rejects drafts that still contain `confidence` and `inferred_from`, so guesses do not become memory.

## Development

```bash
cargo build --release
cargo fmt
cargo test
```

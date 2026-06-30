# Workspace Catalog Platform Design

日期：2026-06-30

狀態：已討論，待使用者 review

## 背景

這個 workspace 是個人知識管理工作流工具的 split repo 開發環境。它同時包含 Meeting Agent、Hermes Wiki Engine、OpenKnowledge 等不同角色的工具。真正困難不只是知道每個 repo 目前有沒有變更，而是讓 agent 或第一次進場的人能先理解：

- workspace 的產品目的。
- 各工具在工作流中的角色。
- 工具之間的 handoff contract。
- 哪些設計邊界不能踩。
- 目前 active work 應該如何接在既有決策上。

這個問題屬於成熟的 developer portal、service catalog、Architecture Decision Records、spec-driven delivery、data lineage／provenance、code intelligence 領域。成熟做法通常不會只靠一個 dashboard，而是把 catalog、ADR、change/spec、workflow map、status collectors 分層。本設計採個人化、local-first 的輕量版本。

## 目標

建立一套可跨 split repo workspace 共用的 Workspace Catalog Platform，讓 Codex／agent 可以用同一套流程在不同 workspace 產生、確認、維護 catalog。

第一版要解決：

- agent-assisted catalog authoring：由 agent 掃描 workspace 並產生 draft，不要求使用者從空白手寫 YAML。
- skill routing catalog：明確記錄 workspace／tool／task 應使用、應先使用、或應避免使用的 skills。
- confirmed catalog SSOT：使用者確認後才寫入 `workspace.catalog.yaml`。
- preflight discipline：後續 agent 進 workspace 時先讀 catalog，再讀特定 repo。
- drift reminder：當 AGENTS、README、ADR、Spectra archive 或相關文件變動時，提醒 catalog 可能需要更新。
- reusable scan/status/drift 能力：之後可跨 workspace 重複使用。

## 非目標

Phase 1-3 不實作正式 HTML dashboard、本機 web app、資料庫、登入、遠端同步、多使用者權限、hosted portal、自動 commit 或自動改寫 confirmed catalog。

靜態 HTML mockup 只作為 Phase 4 renderer 的設計參考：

- `.superpowers/brainstorm/static-mockups/workspace-catalog-dashboard-v2.html`
- `.superpowers/brainstorm/static-mockups/workspace-catalog-dashboard-v3.html`

## 核心原則

1. schema 是 catalog 的穩定 contract，renderer 只是呈現層。
2. scanner 和 collector 可以自動讀取 repo 狀態，但不能未經確認就改變產品語意。
3. confirmed catalog 只保存使用者確認過的語意，例如工具角色、工作流、contract、設計優先順序。
4. inferred draft 必須標示 `confidence` 與 `inferred_from`。
5. low confidence 推論不可直接寫入 confirmed catalog。
6. live status 每次可重新收集，但只能補充 branch、dirty files、active Spectra、recent commits、ADR index、test commands 等狀態。
7. drift report 只提醒差異，不偷偷改 catalog。

## 平台工作流

```text
Scan workspace
  -> Generate inferred catalog draft
  -> Ask user to confirm uncertain semantics
  -> Write confirmed workspace.catalog.yaml
  -> Collect live status
  -> Render or summarize orientation/detail views
```

使用者的角色是 catalog reviewer／approver，而不是手動填表維護者。agent 的角色是掃描、推論、提出問題、在確認後寫入。

## 資料權威性

### Confirmed Catalog

`workspace.catalog.yaml` 是 repo-local catalog SSOT。它保存使用者確認過的語意：

- workspace purpose。
- tools／repos。
- tool roles。
- workflows。
- handoff contracts。
- design priorities。
- agent preflight。
- skill routing。
- forbidden shortcuts。

collector 不得覆蓋這些欄位。

### Inferred Draft

`workspace.catalog.draft.yaml` 是 agent 掃描後產生的推論稿。每個重要推論都應包含：

```yaml
confidence: high
inferred_from:
  - hermes-wiki-engine/README.md
  - hermes-wiki-engine/docs/decisions/ADR-0003-workspace-first-knowledge-architecture.md
```

draft 可以包含需要使用者確認的問題，例如：

```text
OpenKnowledge 目前是否只作為 editor/reference，而不是正式 knowledge SSOT？
```

### Live Status

`.workspace-catalog/status.json` 是可重建的狀態 snapshot，不是 SSOT。它可以包含：

- Git branch。
- dirty files。
- recent commits。
- active Spectra changes。
- archived change hints。
- ADR index path。
- package scripts。
- verification commands。
- codebase-memory project presence。

## Schema 草案

```yaml
schema_version: 1

workspace:
  id: local-meeting-workspace
  name: Local Meeting Workspace
  purpose: 個人知識管理工作流工具開發 workspace
  orientation: >
    這個 workspace 用來開發 Meeting Agent、Hermes Wiki Engine
    與相關 knowledge workflow tooling。

agent_routing:
  default_skills:
    - decision-context
    - codebase-memory
  task_routes:
    - task_type: requirements_or_spec
      use_skills:
        - spectra-propose
        - spectra-ask
    - task_type: implementation
      use_skills:
        - spectra-apply
    - task_type: debugging
      use_skills:
        - superpowers:systematic-debugging
    - task_type: security_review
      use_skills:
        - codex-security:security-scan
  rules:
    - Spectra remains the requirements, specs, tasks, and archive SSOT.
    - codebase-memory should be used before code discovery when available.

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
    purpose: 產生 transcript-ready meeting artifacts。
    participates_in:
      - meeting-to-knowledge
    confirmed_contracts:
      - Emits manifest.json and transcript.md.
      - Does not own LLM-wiki summary, approval, or writeback.
    primary_docs:
      - meeting-agent/README.md
      - meeting-agent/docs/llm-wiki-handoff.md
    recommended_skills:
      - spectra-ask
      - spectra-apply
      - decision-context
    required_preflight_skills:
      - decision-context
    skill_rules:
      - Preserve transcript-ready as the primary completion boundary.
      - Treat Hermes connector as optional and read-only.
    disabled_skills: []
    status_sources:
      git: true
      spectra: true

  - id: hermes-wiki-engine
    name: Hermes Wiki Engine
    path: ./hermes-wiki-engine
    role: knowledge-engine
    purpose: workspace-first knowledge engine and Workbench。
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
    recommended_skills:
      - spectra-ask
      - spectra-apply
      - spectra-archive
      - decision-context
      - codebase-memory
    required_preflight_skills:
      - decision-context
      - codebase-memory
    skill_rules:
      - Use Spectra for requirements, specs, apply work, and archives.
      - Use codebase-memory before code discovery.
      - Preserve workspace-first and single-core-runtime boundaries.
    disabled_skills: []
    status_sources:
      git: true
      spectra: true
      adr_index: hermes-wiki-engine/docs/decisions/index.md
```

## 頁面與摘要結構

Phase 1-3 不必實作 renderer，但輸出應能支援未來三種頁面：

### Orientation Page

給第一次進 workspace 的人或 agent：

- workspace purpose。
- main workflows。
- tool role cards。
- design priorities。
- agent preflight。

### Tool Detail Page

點工具卡進入：

- tool purpose。
- confirmed role。
- confirmed contracts。
- related workflows。
- primary docs。
- live development status。
- recommended and required skills。
- skill rules and disabled skills。
- suggested next reads。
- suggested verification commands。

頁面上半部永遠是 confirmed semantics，下半部才是 live status。

### Workflow Detail Page

點 workflow 節點進入：

- workflow summary。
- stages。
- participating tools。
- handoff contracts。
- allowed transitions。
- forbidden shortcuts。
- related specs／ADRs。
- current active work。

## Phase 1：Codex Skill

新增或規劃 `workspace-catalog` Codex skill。它的責任是固定 agent-assisted catalog authoring 流程。

Skill 行為：

1. 掃描 workspace 結構。
2. 讀取 root AGENTS、子 repo AGENTS、README、Spectra、ADR、docs、codebase-memory project list。
3. 產生 `workspace.catalog.draft.yaml`。
4. 推論 workspace-level `agent_routing` 與 tool-level skill rules。
5. 每個推論標示 `confidence` 與 `inferred_from`。
6. 列出需要使用者確認的語意問題。
7. 使用者確認後才寫入 `workspace.catalog.yaml`。
8. 若 workspace 已有 confirmed catalog，優先讀取並只產生 drift／update draft。

Phase 1 成功條件：

- 可在任一 split repo workspace 中指導 agent 產生 catalog draft。
- 不要求使用者從空白手寫 YAML。
- 不把未確認推論寫入 confirmed catalog。
- skill routing 能回答 workspace／tool／task 應優先使用哪些 skills。

## Phase 2：Hook／提醒規則

新增 hook 或等價提醒規則。它不負責完整推論，只負責觸發 preflight 與 drift awareness。

提醒場景：

- 進入 workspace 時提醒先讀 `workspace.catalog.yaml`。
- AGENTS、README、ADR、Spectra proposal/design/tasks、archive 變動後提醒 catalog 可能 drift。
- Spectra archive 後提醒檢查 catalog 是否需要更新。
- `workspace.catalog.yaml` 缺失時提醒可使用 `workspace-catalog` skill 產生 draft。

Phase 2 成功條件：

- hook 不改檔。
- hook 不取代 skill。
- hook 只提醒，不自動確認語意。

## Phase 3：Reusable CLI／Catalog Agent

抽出可重複執行的 CLI 或 catalog agent 能力。

第一版命令：

```bash
workspace-catalog scan
workspace-catalog status
workspace-catalog drift
```

`scan`：

- 掃描 workspace。
- 產生或更新 `workspace.catalog.draft.yaml`。
- 輸出需要使用者確認的問題。

`status`：

- 讀 confirmed catalog。
- 收集 Git、Spectra、ADR、package scripts、codebase-memory 狀態。
- 寫入 `.workspace-catalog/status.json`。

`drift`：

- 重新掃描 workspace。
- 比對 confirmed catalog 與目前 repo docs/specs 的可能差異。
- 產生 drift report，不自動改 catalog。

Phase 3 成功條件：

- 可跨多個 workspace 使用同一套命令。
- collectors 失敗時 fail soft，報告缺失來源，不阻斷整體 catalog。
- status 不覆蓋 confirmed semantics。

## Implementation Slices

後續實作應分成三個獨立 slice，避免第一版過度平台化：

### Slice 1：Skill-only authoring workflow

只建立 `workspace-catalog` skill 與必要模板。完成後，agent 可以依 skill 掃描 workspace、產生 draft、提出確認問題，並在使用者確認後寫入 catalog。這個 slice 不需要 CLI、不需要 hook、不需要 renderer。

### Slice 2：Preflight and drift reminders

建立 hook 或 repo／global agent rule，讓 agent 在進入 workspace、Spectra archive 後、或 AGENTS／README／ADR／Spectra 變動後提醒 catalog 可能需要檢查。這個 slice 不做推論，也不改檔。

### Slice 3：Reusable scan/status/drift automation

把 Slice 1 中重複的掃描與狀態收集抽出為 CLI 或 catalog agent。這個 slice 可以支援多 workspace，但仍不得自動覆蓋 confirmed catalog。

## Phase 4：Renderer（留規格）

未來可實作靜態 HTML／Markdown renderer。

Renderer 可輸出：

```text
docs/workspace-catalog/index.html
docs/workspace-catalog/index.md
docs/workspace-catalog/tools/<tool-id>.html
docs/workspace-catalog/workflows/<workflow-id>.html
```

Phase 4 應使用 v2／v3 mockup 作為視覺參考，但不把 mockup 視為 current product code。

## Phase 5：Local Web App（留規格）

未來若多 workspace 管理需求變重，可建立本機 web app：

- 切換 workspace。
- 顯示 confirmed catalog。
- 顯示 live status。
- 顯示 drift report。
- 開啟 tool／workflow detail。

Phase 5 不應引入 hosted backend 或 cloud sync 作為預設。

## 風險與緩解

- 風險：agent 過度相信推論。緩解：所有推論必須帶 `confidence` 與 `inferred_from`，未確認不可進 confirmed catalog。
- 風險：catalog 變成另一套任務系統。緩解：Spectra 仍是 requirements/spec/archive SSOT，catalog 只做導覽與邊界彙整。
- 風險：live status 覆蓋產品語意。緩解：status snapshot 與 confirmed catalog 分檔，collector 不寫 confirmed semantics。
- 風險：不同 workspace 結構差異太大。緩解：schema 只定核心語意，collector fail soft。
- 風險：太早做 dashboard。緩解：Phase 1-3 不做正式 renderer，Phase 4-5 僅留規格。

## 驗收標準

- 有清楚的 Phase 1-3 實作範圍。
- Phase 4-5 明確留規格，不進 MVP。
- 文件說明 confirmed catalog、inferred draft、live status 的權威性差異。
- 文件說明 skill、hook、CLI／agent 的分工。
- 文件把 skill routing 納入 catalog schema，而不是只放在 prose guidance。
- 文件沒有要求使用者手動從空白填寫 catalog。
- 文件保留成熟領域映射：developer portal、service catalog、ADR、Spectra、lineage、code intelligence。

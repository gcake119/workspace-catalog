---
name: workspace-catalog
description: Use when entering, auditing, or initializing a split repo workspace so Codex can remember workflow boundaries, child repo relationships, and repo-specific skills as local architecture memory.
---

# Workspace Catalog

Use this skill to create or refresh local workspace architecture memory for split repo workspaces.

## Core Rule

`.workspace-catalog/catalog.yaml` is local agent memory, similar to codebase-memory. It does not need to be version-controlled.

The workflow is:

1. Read `.workspace-catalog/catalog.yaml` when it exists.
2. Scan workspace evidence.
3. Generate `.workspace-catalog/catalog.draft.yaml`.
4. Mark every inferred role, workflow, and contract with `confidence` and `inferred_from`.
5. Explain changes in plain language.
6. Ask the user to confirm whether to update architecture memory.
7. After confirmation, rewrite the draft into confirmed catalog shape.
8. Run `workspace-catalog confirm <workspace> --yes`.

## Memory Update Workflow

When workspace evidence changes:

1. Run `workspace-catalog scan` or `workspace-catalog drift`.
2. Review `.workspace-catalog/catalog.draft.yaml` or `.workspace-catalog/drift-report.md`.
3. Tell the user what changed: workflow, child repo relationship, boundary, or skill routing.
4. Ask whether to update local architecture memory.
5. Confirm only after the user approves.

Never run `confirm` before the user has explicitly approved the catalog semantics.

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
- Existing skill references in AGENTS, docs, and local workflow rules.

## Output Files

- `.workspace-catalog/catalog.draft.yaml`: inferred candidate memory awaiting user confirmation.
- `.workspace-catalog/catalog.yaml`: confirmed local architecture memory.
- `.workspace-catalog/status.json`: live status snapshot.
- `.workspace-catalog/drift-report.md`: drift findings.

## Skill Routing To Capture

Catalogs may include workspace-level routing and tool-level routing:

```yaml
agent_routing:
  default_skills: []
  task_routes: []
  rules: []

tools:
  - id: example-tool
    recommended_skills: []
    required_preflight_skills: []
    skill_rules: []
    disabled_skills: []
```

Skill routing is confirmed memory. Inferred routing must stay in draft until the user confirms it.

## Confirmation Rules

Ask the user one question at a time when semantics are unclear.

Examples:

- "I infer frontend owns the user-facing UI and should use Playwright for browser checks. Should I update the local catalog?"
- "I infer backend now owns both API and worker responsibilities. Is that correct?"
- "I infer this workspace uses Spectra as change/spec context. Should the catalog remember that?"

## Forbidden Behavior

- Do not auto-confirm low-confidence inferences.
- Do not run `workspace-catalog confirm --yes` until the user has approved the draft semantics.
- Do not let Git status override confirmed tool roles.
- Do not let generic skill defaults override repo-local skill routing.
- Do not replace Spectra, ADR, Git, or codebase-memory.
- Do not build renderer or local web app during Phase 1-3 work.

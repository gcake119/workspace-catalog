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
- Existing skill references in AGENTS, docs, and local workflow rules.

## Output Files

- `workspace.catalog.draft.yaml`: inferred semantics awaiting user confirmation.
- `workspace.catalog.yaml`: confirmed catalog SSOT.
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

Skill routing is confirmed semantics. Inferred routing must stay in draft until the user confirms it.

## Confirmation Rules

Ask the user one question at a time when semantics are unclear.

Examples:

- "I infer OpenKnowledge is an editor/reference, not a workspace SSOT. Is that correct?"
- "I infer Meeting Agent is a read-only source for LLM-wiki. Is that still correct?"
- "I infer this workspace uses Spectra as change/spec SSOT. Should the catalog enforce that?"

## Forbidden Behavior

- Do not auto-confirm low-confidence inferences.
- Do not let Git status override confirmed tool roles.
- Do not let generic skill defaults override repo-local skill routing.
- Do not replace Spectra, ADR, Git, or codebase-memory.
- Do not build renderer or local web app during Phase 1-3 work.

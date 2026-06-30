# Workspace Catalog

Workspace Catalog helps agents understand a split repo workspace before they change code.

It is for workspaces like this:

```text
project-workspace/
  frontend/
  backend/
  tools/
  workspace.catalog.yaml
```

In this kind of workspace, an agent needs to know which repo owns the UI, backend contracts, support tools, workflow boundaries, and required docs or skills.

## What It Does

Workspace Catalog provides three things:

- **Skill**：guides an agent through catalog authoring and user confirmation.
- **Hook**：prints preflight reminders before the agent assumes workspace context.
- **CLI**：scans, collects live status, and reports drift.

It does not replace Git, Spectra, ADRs, or codebase-memory. It is an orientation layer for agent collaboration.

## Data Layers

- `workspace.catalog.yaml`：confirmed workspace meaning，such as tool roles, workflows, contracts, and skill routing.
- `workspace.catalog.draft.yaml`：agent-generated guesses with `confidence` and `inferred_from`，waiting for user confirmation.
- `.workspace-catalog/status.json`：live status snapshot，such as Git, Spectra, ADR index, package scripts, and verification commands.

Collectors never rewrite confirmed catalog semantics.

## Workflow

```text
preflight
  -> scan workspace
  -> write draft catalog
  -> ask user to confirm uncertain semantics
  -> write confirmed catalog
  -> collect status
  -> report drift
```

## Commands

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

The hook only prints reminders. It does not edit files.

## Files

```text
skills/workspace-catalog/SKILL.md
hooks/workspace-catalog-preflight.js
cli/src/index.js
examples/local-meeting-workspace/workspace.catalog.example.yaml
```

## Boundaries

Phase 1-3 includes skill, hook, and CLI only.

Not included yet:

- renderer
- HTML dashboard
- local web app
- database
- remote sync

## Development

```bash
pnpm --dir cli test
```

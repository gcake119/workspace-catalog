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

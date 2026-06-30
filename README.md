# Workspace Catalog

Workspace Catalog is a local-first toolchain for helping Codex and other agents understand split repo workspaces before touching implementation details.

## Phase 1-3 MVP

- Phase 1: Codex skill for agent-assisted catalog authoring.
- Phase 2: executable preflight hook and drift reminder guidance.
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
node cli/src/index.js preflight /path/to/workspace
node cli/src/index.js status /path/to/workspace
node cli/src/index.js drift /path/to/workspace
```

`scan` writes `workspace.catalog.draft.yaml`.

`preflight` prints catalog read, missing catalog, or possible drift reminders without editing files.

`status` writes `.workspace-catalog/status.json`.

`drift` writes `.workspace-catalog/drift-report.md`.

Confirmed catalog semantics are never overwritten by collectors.

## Hook

Use the executable wrapper from a local hook system:

```bash
hooks/workspace-catalog-preflight.js /path/to/workspace
hooks/workspace-catalog-preflight.js /path/to/workspace --changed AGENTS.md
hooks/workspace-catalog-preflight.js /path/to/workspace --event spectra-archive
```

The hook only prints reminders. It does not write catalog files or confirm inferred semantics.

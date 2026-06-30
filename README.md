# Workspace Catalog

Workspace Catalog is a local-first toolchain for helping Codex and other agents understand split repo workspaces before touching implementation details.

It is designed for agent-assisted catalog authoring:

1. Scan a workspace.
2. Generate an inferred catalog draft with confidence and sources.
3. Ask the user to confirm uncertain semantics.
4. Write a confirmed `workspace.catalog.yaml`.
5. Collect live status without overwriting confirmed semantics.
6. Report drift when repo docs, specs, or decisions move away from the catalog.

The first implementation target is Phase 1-3:

- Phase 1: Codex skill for workspace catalog authoring.
- Phase 2: preflight and drift reminder hook guidance.
- Phase 3: reusable scan/status/drift CLI or catalog agent.

Phase 4 static rendering and Phase 5 local web app are intentionally deferred.


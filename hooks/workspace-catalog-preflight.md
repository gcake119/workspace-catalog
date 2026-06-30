# Workspace Catalog Preflight Hook

This hook guidance describes when Codex should remind the user to read or refresh a workspace catalog.

## Trigger Moments

- A session starts in a directory that contains `workspace.catalog.yaml`.
- A session starts in a split repo workspace that does not contain `workspace.catalog.yaml`.
- Files matching `AGENTS.md`, `README.md`, `docs/decisions/**`, `openspec/changes/**`, or `openspec/specs/**` changed.
- A Spectra archive has just completed.
- The user asks for cross-repo, workflow, architecture, or project-status work.

## Reminder Behavior

When `workspace.catalog.yaml` exists, remind the agent:

```text
Read workspace.catalog.yaml before inferring tool roles, workflow boundaries, or active project direction.
```

When catalog is missing, suggest:

```text
Use the workspace-catalog skill to scan this workspace and produce a draft catalog for user confirmation.
```

When potential drift is detected, report:

```text
Catalog drift may exist because workspace guidance, ADRs, README, or Spectra artifacts changed. Run workspace-catalog drift or refresh the draft before relying on old catalog semantics.
```

## Boundaries

- The hook does not edit files.
- The hook does not confirm inferred semantics.
- The hook does not replace the workspace-catalog skill.

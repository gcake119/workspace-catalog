# Workspace Catalog Preflight Hook

The Rust binary supports hook usage through symlinks.

## Commands

```bash
workspace-catalog-preflight /path/to/workspace
workspace-catalog-preflight /path/to/workspace --changed AGENTS.md
workspace-catalog-preflight /path/to/workspace --event spectra-archive
workspace-catalog-session-preflight /path/inside/initialized/workspace
```

## Strict Session Mode

`workspace-catalog-session-preflight` walks upward from the current path.

- If it finds `.workspace-catalog/catalog.yaml`, it prints preflight reminders.
- If it does not find `.workspace-catalog/catalog.yaml`, it exits quietly.

This keeps global hooks quiet outside initialized workspaces.

## Reminder Behavior

When local catalog memory exists, remind the agent:

```text
Read .workspace-catalog/catalog.yaml before inferring tool roles, workflow boundaries, or active project direction.
```

When potential drift is detected, report:

```text
Catalog drift may exist because workspace guidance, ADRs, README, or Spectra artifacts changed. Run workspace-catalog drift or refresh the draft before relying on old catalog semantics.
```

## Boundaries

- The hook does not edit files.
- The hook does not confirm inferred semantics.
- The hook does not replace the workspace-catalog skill.
- The hook does not modify global Codex hook settings.

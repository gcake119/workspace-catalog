# Contributing

Thanks for helping improve Workspace Catalog.

## Scope

This project is currently focused on Phase 1-3:

- Codex skill
- preflight hook
- scan/status/drift CLI

Please do not add a renderer, dashboard, local web app, database, or remote sync unless there is an accepted design change first.

## Development

Install dependencies:

```bash
pnpm --dir cli install
```

Run tests:

```bash
pnpm --dir cli test
```

## Pull Requests

Keep changes small and focused. Include:

- what changed
- why it changed
- tests or checks run
- any remaining limitations

For catalog behavior, preserve the boundary between:

- confirmed catalog semantics
- inferred draft semantics
- live status snapshots

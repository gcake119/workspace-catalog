# Workspace Catalog Agent Instructions

This repo builds a reusable Workspace Catalog toolchain for split repo workspaces.

## Product Boundary

Workspace Catalog is not a replacement for Spectra, ADRs, Git, or codebase-memory.

- Spectra remains the requirements, specs, changes, tasks, and archive SSOT.
- ADR files remain the durable decision record.
- Git remains the source control and history layer.
- codebase-memory remains the code structure lookup layer.
- `workspace.catalog.yaml` is only the confirmed workspace orientation and contract catalog.

## Implementation Rules

- Keep Phase 1-3 focused: skill, hook guidance, CLI/catalog-agent automation.
- Do not build the HTML renderer or local web app in the MVP.
- Do not let scanners or collectors overwrite confirmed catalog semantics.
- Every inferred role, workflow, or contract must preserve `confidence` and `inferred_from`.
- Low-confidence inferred semantics must become review questions, not confirmed catalog fields.
- Status snapshots are cache/output, not source of truth.

## Package Management

Use `pnpm` for JavaScript or TypeScript work unless a later repo decision changes this.

## Verification

Run the smallest relevant test for each change. For CLI behavior, prefer deterministic fixture-based tests over live workspace assumptions.


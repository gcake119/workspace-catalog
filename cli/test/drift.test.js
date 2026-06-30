import assert from "node:assert/strict";
import { mkdtemp, mkdir, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { detectCatalogDrift } from "../src/drift.js";

test("detectCatalogDrift classifies invalid, missing, and existing tool paths", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(join(root, "tool-a"), { recursive: true });
  await writeFile(join(root, "workspace.catalog.yaml"), `
schema_version: 1
workspace:
  id: sample
  name: Sample
  purpose: Confirmed purpose
workflows: []
tools:
  - id: empty-tool
    path: ""
    role: source-tool
  - id: absolute-tool
    path: ${JSON.stringify(resolve(root, "outside-tool"))}
    role: source-tool
  - id: outside-tool
    path: ../outside
    role: source-tool
  - id: existing-tool
    path: ./tool-a
    role: source-tool
  - id: missing-tool
    path: ./missing-tool
    role: source-tool
`);

  const report = await detectCatalogDrift(root);

  assert.deepEqual(
    report.items.map((item) => [item.tool_id, item.code]),
    [
      ["empty-tool", "CATALOG_TOOL_PATH_INVALID"],
      ["absolute-tool", "CATALOG_TOOL_PATH_INVALID"],
      ["outside-tool", "CATALOG_TOOL_PATH_INVALID"],
      ["missing-tool", "CATALOG_TOOL_PATH_MISSING"]
    ]
  );
});

test("detectCatalogDrift reports new or newer docs and specs evidence", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(join(root, "tool-a", "docs", "decisions"), { recursive: true });
  await mkdir(join(root, "tool-a", "openspec", "specs", "catalog"), { recursive: true });
  await writeFile(join(root, "tool-a", "README.md"), "# Tool A\n");
  await writeFile(join(root, "workspace.catalog.yaml"), `
schema_version: 1
workspace:
  id: sample
  name: Sample
  purpose: Confirmed purpose
workflows: []
tools:
  - id: tool-a
    path: ./tool-a
    role: source-tool
    primary_docs:
      - tool-a/README.md
`);

  const adrPath = join(root, "tool-a", "docs", "decisions", "ADR-0001-new.md");
  const specPath = join(root, "tool-a", "openspec", "specs", "catalog", "spec.md");
  await writeFile(adrPath, "# New ADR\n");
  await writeFile(specPath, "# Updated spec\n");
  const future = new Date(Date.now() + 10_000);
  await utimes(adrPath, future, future);
  await utimes(specPath, future, future);

  const report = await detectCatalogDrift(root);

  assert.deepEqual(
    report.items
      .filter((item) => item.code === "CATALOG_EVIDENCE_SOURCE_NEW")
      .map((item) => item.source)
      .sort(),
    [
      "tool-a/docs/decisions/ADR-0001-new.md",
      "tool-a/openspec/specs/catalog/spec.md"
    ]
  );
  assert.deepEqual(
    report.items
      .filter((item) => item.code === "CATALOG_EVIDENCE_NEWER_THAN_CATALOG")
      .map((item) => item.source)
      .sort(),
    [
      "tool-a/docs/decisions/ADR-0001-new.md",
      "tool-a/openspec/specs/catalog/spec.md"
    ]
  );
});

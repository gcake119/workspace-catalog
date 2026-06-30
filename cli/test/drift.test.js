import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { detectCatalogDrift } from "../src/drift.js";

test("detectCatalogDrift reports tool paths missing from current scan", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "workspace.catalog.yaml"), `
schema_version: 1
workspace:
  id: sample
  name: Sample
  purpose: Confirmed purpose
workflows: []
tools:
  - id: missing-tool
    path: ./missing-tool
    role: source-tool
`);

  const report = await detectCatalogDrift(root);

  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].code, "CATALOG_TOOL_PATH_MISSING");
});

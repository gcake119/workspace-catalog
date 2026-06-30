import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
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

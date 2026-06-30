import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createStatusSnapshot } from "../src/status.js";

test("createStatusSnapshot keeps status separate from confirmed semantics", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "workspace.catalog.yaml"), `
schema_version: 1
workspace:
  id: sample
  name: Sample
  purpose: Confirmed purpose
workflows: []
agent_routing:
  default_skills:
    - decision-context
  task_routes: []
  rules: []
tools:
  - id: tool-a
    path: ./tool-a
    role: source-tool
`);

  const status = await createStatusSnapshot(root, {
    gitCollector: async () => ({ ok: false, reason: "git_unavailable", code: null }),
    spectraCollector: async () => ({ ok: false, reason: "spectra_unavailable", code: null })
  });

  assert.deepEqual(status.catalog_ref, {
    path: "workspace.catalog.yaml",
    schema_version: 1,
    workspace_id: "sample",
    tool_ids: ["tool-a"]
  });
  assert.equal(Object.hasOwn(status, "workspace"), false);
  assert.equal(Object.hasOwn(status, "agent_routing"), false);
  assert.equal(Object.hasOwn(status, "tools"), false);
  assert.equal(status.live_status.git.ok, false);
  assert.equal(status.live_status.spectra.ok, false);
});

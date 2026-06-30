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

  assert.equal(status.workspace.id, "sample");
  assert.equal(status.tools[0].id, "tool-a");
  assert.equal(status.tools[0].role, "source-tool");
  assert.deepEqual(status.agent_routing.default_skills, ["decision-context"]);
  assert.equal(status.git.ok, false);
  assert.equal(status.spectra.ok, false);
});

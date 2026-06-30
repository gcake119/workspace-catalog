import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createStatusSnapshot } from "../src/status.js";

test("createStatusSnapshot keeps status separate from confirmed semantics", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(join(root, "docs", "decisions"), { recursive: true });
  await mkdir(join(root, "tool-a"), { recursive: true });
  await writeFile(join(root, "docs", "decisions", "index.md"), "# Decisions\n");
  await writeFile(join(root, "package.json"), JSON.stringify({
    scripts: {
      test: "node --test",
      lint: "eslint ."
    }
  }));
  await writeFile(join(root, "tool-a", "package.json"), JSON.stringify({
    scripts: {
      build: "vite build"
    }
  }));
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
    spectraCollector: async () => ({ ok: false, reason: "spectra_unavailable", code: null }),
    codebaseMemoryCollector: async () => ({ ok: true, project: "sample" })
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
  assert.deepEqual(status.live_status.adr_index, {
    ok: true,
    path: "docs/decisions/index.md"
  });
  assert.deepEqual(
    status.live_status.package_scripts.map((item) => [item.path, item.ok, Object.keys(item.scripts ?? {})]),
    [
      ["package.json", true, ["test", "lint"]],
      ["tool-a/package.json", true, ["build"]]
    ]
  );
  assert.deepEqual(status.live_status.suggested_verification_commands, [
    { script: "test", command: "pnpm test" },
    { script: "lint", command: "pnpm lint" },
    { script: "build", command: "pnpm --dir tool-a build" }
  ]);
  assert.deepEqual(status.live_status.codebase_memory, {
    ok: true,
    project: "sample"
  });
});

test("createStatusSnapshot does not read package scripts outside the workspace", async () => {
  const parent = await mkdtemp(join(tmpdir(), "workspace-catalog-"));
  const root = join(parent, "workspace");
  const outside = join(parent, "outside");
  await mkdir(join(root, "tool-a"), { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({
    scripts: {
      test: "node --test"
    }
  }));
  await writeFile(join(root, "tool-a", "package.json"), JSON.stringify({
    scripts: {
      build: "vite build"
    }
  }));
  await writeFile(join(outside, "package.json"), JSON.stringify({
    scripts: {
      secret: "do-not-read"
    }
  }));
  await writeFile(join(root, "workspace.catalog.yaml"), `
schema_version: 1
workspace:
  id: sample
  name: Sample
  purpose: Confirmed purpose
workflows: []
tools:
  - id: valid-tool
    path: ./tool-a
    role: source-tool
  - id: empty-tool
    path: ""
    role: source-tool
  - id: absolute-tool
    path: ${JSON.stringify(resolve(outside))}
    role: source-tool
  - id: outside-tool
    path: ../outside
    role: source-tool
`);

  const status = await createStatusSnapshot(root, {
    gitCollector: async () => ({ ok: false, reason: "git_unavailable", code: null }),
    spectraCollector: async () => ({ ok: false, reason: "spectra_unavailable", code: null })
  });

  assert.equal(Object.hasOwn(status, "workspace"), false);
  assert.equal(Object.hasOwn(status, "agent_routing"), false);
  assert.equal(Object.hasOwn(status, "tools"), false);
  assert.deepEqual(
    status.live_status.package_scripts.map((item) => [
      item.path,
      item.tool_id ?? null,
      item.ok,
      item.reason ?? null,
      Object.keys(item.scripts ?? {})
    ]),
    [
      ["package.json", null, true, null, ["test"]],
      ["tool-a/package.json", null, true, null, ["build"]],
      ["", "empty-tool", false, "catalog_tool_path_invalid", []],
      [resolve(outside), "absolute-tool", false, "catalog_tool_path_invalid", []],
      ["../outside", "outside-tool", false, "catalog_tool_path_invalid", []]
    ]
  );
  assert.equal(
    status.live_status.package_scripts.some((item) => Object.hasOwn(item.scripts ?? {}, "secret")),
    false
  );
  assert.deepEqual(status.live_status.suggested_verification_commands, [
    { script: "test", command: "pnpm test" },
    { script: "build", command: "pnpm --dir tool-a build" }
  ]);
});

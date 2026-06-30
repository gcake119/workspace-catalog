import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createPreflightReport, formatPreflightReport, isDriftRelevantPath } from "../src/preflight.js";

const execFileAsync = promisify(execFile);
const hookPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks", "workspace-catalog-preflight.js");
const sessionHookPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks", "workspace-catalog-session-preflight.js");

test("createPreflightReport reminds agents to read an existing catalog", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "workspace.catalog.yaml"), "schema_version: 1\n");

  const report = await createPreflightReport(root);

  assert.deepEqual(report.reminders.map((reminder) => reminder.code), [
    "WORKSPACE_CATALOG_READ_REQUIRED"
  ]);
});

test("createPreflightReport suggests catalog authoring for split workspaces without a catalog", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(join(root, "tool-a"), { recursive: true });
  await writeFile(join(root, "tool-a", "README.md"), "# Tool A\n");

  const report = await createPreflightReport(root);

  assert.deepEqual(report.reminders.map((reminder) => reminder.code), [
    "WORKSPACE_CATALOG_MISSING"
  ]);
});

test("formatPreflightReport explains missing docs in plain language", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(join(root, "tool-a"), { recursive: true });
  await writeFile(join(root, "tool-a", "README.md"), "# Tool A\n");

  const report = await createPreflightReport(root);
  const formatted = formatPreflightReport(report);

  assert.match(formatted, /WORKSPACE_CATALOG_MISSING/);
  assert.match(formatted, /少了一些基本決策文件/);
  assert.match(formatted, /AGENTS\.md: 新增 AGENTS\.md/);
  assert.match(formatted, /docs\/decisions\/index\.md: 新增 docs\/decisions\/index\.md/);
});

test("createPreflightReport reminds users when a workspace has no basic docs yet", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(root, { recursive: true });

  const report = await createPreflightReport(root);
  const formatted = formatPreflightReport(report);

  assert.deepEqual(report.reminders.map((reminder) => reminder.code), [
    "WORKSPACE_DOCUMENTATION_MISSING"
  ]);
  assert.match(formatted, /缺少基本文件/);
  assert.match(formatted, /README\.md: 新增 README\.md/);
});

test("createPreflightReport reports possible drift for changed guidance files", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "workspace.catalog.yaml"), "schema_version: 1\n");

  const report = await createPreflightReport(root, {
    changed_files: [
      "src/index.js",
      "docs/decisions/ADR-0001.md",
      "openspec/specs/catalog/spec.md"
    ]
  });

  assert.deepEqual(report.reminders.map((reminder) => reminder.code), [
    "WORKSPACE_CATALOG_READ_REQUIRED",
    "WORKSPACE_CATALOG_DRIFT_POSSIBLE"
  ]);
  assert.deepEqual(report.reminders[1].changed_files, [
    "docs/decisions/ADR-0001.md",
    "openspec/specs/catalog/spec.md"
  ]);
});

test("workspace catalog hook wrapper prints preflight reminders", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "workspace.catalog.yaml"), "schema_version: 1\n");

  const result = await execFileAsync(process.execPath, [hookPath, root, "--event", "spectra-archive"]);

  assert.match(result.stdout, /WORKSPACE_CATALOG_READ_REQUIRED/);
  assert.match(result.stdout, /WORKSPACE_CATALOG_DRIFT_POSSIBLE/);
});

test("workspace catalog session hook is quiet outside initialized workspaces", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(root, { recursive: true });

  const result = await execFileAsync(process.execPath, [sessionHookPath, root]);

  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("workspace catalog session hook runs only after finding a confirmed catalog", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  const child = join(root, "tool-a", "src");
  await mkdir(child, { recursive: true });
  await writeFile(join(root, "workspace.catalog.yaml"), "schema_version: 1\n");

  const result = await execFileAsync(process.execPath, [sessionHookPath, child]);

  assert.match(result.stdout, /WORKSPACE_CATALOG_READ_REQUIRED/);
  assert.equal(result.stderr, "");
});

test("isDriftRelevantPath matches workspace guidance and spec paths", () => {
  assert.equal(isDriftRelevantPath("AGENTS.md"), true);
  assert.equal(isDriftRelevantPath("tool-a/README.md"), true);
  assert.equal(isDriftRelevantPath("tool-a/docs/decisions/ADR-0001.md"), true);
  assert.equal(isDriftRelevantPath("tool-a/openspec/changes/add-flow/proposal.md"), true);
  assert.equal(isDriftRelevantPath("tool-a/docs/superpowers/plans/plan.md"), true);
  assert.equal(isDriftRelevantPath("tool-a/src/index.js"), false);
});

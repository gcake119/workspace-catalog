import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { scanWorkspace } from "../src/scanner.js";

test("scanWorkspace finds root and child repo guidance files", async (t) => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(join(root, ".cursor", "rules"), { recursive: true });
  await mkdir(join(root, "docs", "superpowers", "specs"), { recursive: true });
  await mkdir(join(root, "tool-a", "docs", "decisions"), { recursive: true });
  await mkdir(join(root, "tool-a", "openspec", "specs", "catalog"), { recursive: true });
  await mkdir(join(root, "tool-a", "openspec", "changes", "add-flow"), { recursive: true });
  await mkdir(join(root, "tool-a", "docs", "superpowers", "plans"), { recursive: true });
  await writeFile(join(root, "AGENTS.md"), "# Root rules\n");
  await writeFile(join(root, "README.md"), "# Workspace\n");
  await writeFile(join(root, ".cursorrules"), "# Cursor rules\n");
  await writeFile(join(root, ".cursor", "rules", "workspace.md"), "# Cursor workspace rules\n");
  await writeFile(join(root, "docs", "superpowers", "specs", "catalog.md"), "# Catalog spec\n");
  await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }));
  await writeFile(join(root, "tool-a", "AGENTS.md"), "# Tool rules\n");
  await writeFile(join(root, "tool-a", "README.md"), "# Tool A\n");
  await writeFile(join(root, "tool-a", "docs", "decisions", "index.md"), "# Decisions\n");
  await writeFile(join(root, "tool-a", "docs", "decisions", "ADR-0001.md"), "# ADR\n");
  await writeFile(join(root, "tool-a", "openspec", "specs", "catalog", "spec.md"), "# Spec\n");
  await writeFile(join(root, "tool-a", "openspec", "changes", "add-flow", "proposal.md"), "# Proposal\n");
  await writeFile(join(root, "tool-a", "docs", "superpowers", "plans", "plan.md"), "# Plan\n");
  await writeFile(join(root, "tool-a", "package.json"), JSON.stringify({ scripts: { build: "vite build" } }));

  const result = await scanWorkspace(root);

  assert.deepEqual(result.root.guidance.sort(), [
    ".cursor/rules/workspace.md",
    ".cursorrules",
    "AGENTS.md",
    "README.md",
    "docs/superpowers/specs/catalog.md",
    "package.json"
  ]);
  assert.equal(result.tools.length, 1);
  assert.equal(result.tools[0].path, "tool-a");
  assert.deepEqual(result.tools[0].guidance.sort(), [
    "tool-a/AGENTS.md",
    "tool-a/README.md",
    "tool-a/docs/decisions/ADR-0001.md",
    "tool-a/docs/decisions/index.md",
    "tool-a/docs/superpowers/plans/plan.md",
    "tool-a/openspec/changes/add-flow/proposal.md",
    "tool-a/openspec/specs/catalog/spec.md",
    "tool-a/package.json"
  ]);
  assert.deepEqual(result.codebase_memory, {
    ok: false,
    reason: "codebase_memory_unavailable"
  });
});

import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { scanWorkspace } from "../src/scanner.js";

test("scanWorkspace finds root and child repo guidance files", async (t) => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(join(root, "tool-a", "docs", "decisions"), { recursive: true });
  await writeFile(join(root, "AGENTS.md"), "# Root rules\n");
  await writeFile(join(root, "README.md"), "# Workspace\n");
  await writeFile(join(root, "tool-a", "AGENTS.md"), "# Tool rules\n");
  await writeFile(join(root, "tool-a", "README.md"), "# Tool A\n");
  await writeFile(join(root, "tool-a", "docs", "decisions", "index.md"), "# Decisions\n");

  const result = await scanWorkspace(root);

  assert.deepEqual(result.root.guidance.sort(), ["AGENTS.md", "README.md"]);
  assert.equal(result.tools.length, 1);
  assert.equal(result.tools[0].path, "tool-a");
  assert.deepEqual(result.tools[0].guidance.sort(), [
    "tool-a/AGENTS.md",
    "tool-a/README.md",
    "tool-a/docs/decisions/index.md"
  ]);
});

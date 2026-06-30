import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parse } from "yaml";

const execFileAsync = promisify(execFile);
const cliPath = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "index.js");

test("scan writes a draft with inferred orientation and agent routing shape", async () => {
  const workspace = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  await mkdir(join(workspace, "tool-a"), { recursive: true });
  await writeFile(join(workspace, "AGENTS.md"), "# Root rules\n");
  await writeFile(join(workspace, "README.md"), "# Workspace\n");
  await writeFile(join(workspace, "tool-a", "README.md"), "# Tool A\n");

  await execFileAsync(process.execPath, [cliPath, "scan", workspace]);

  const draft = parse(await readFile(join(workspace, "workspace.catalog.draft.yaml"), "utf8"));
  const inferredFrom = ["AGENTS.md", "README.md"];

  assert.deepEqual(draft.workspace.orientation, {
    value: "Review workspace docs to confirm orientation.",
    confidence: "low",
    inferred_from: inferredFrom
  });
  assert.deepEqual(draft.agent_routing, {
    default_skills: {
      value: [],
      confidence: "low",
      inferred_from: inferredFrom
    },
    task_routes: {
      value: [],
      confidence: "low",
      inferred_from: inferredFrom
    },
    rules: {
      value: [],
      confidence: "low",
      inferred_from: inferredFrom
    }
  });
});

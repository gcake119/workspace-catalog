#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { scanWorkspace } from "./scanner.js";

async function main() {
  const command = process.argv[2];
  const workspace = resolve(process.argv[3] ?? process.cwd());

  if (command === "scan") {
    const scan = await scanWorkspace(workspace);
    const draft = {
      schema_version: 1,
      workspace: {
        id: {
          value: workspace.split("/").filter(Boolean).at(-1),
          confidence: "medium",
          inferred_from: scan.root.guidance
        },
        name: {
          value: workspace.split("/").filter(Boolean).at(-1),
          confidence: "medium",
          inferred_from: scan.root.guidance
        },
        purpose: {
          value: "Review workspace docs to confirm purpose.",
          confidence: "low",
          inferred_from: scan.root.guidance
        }
      },
      workflows: [],
      tools: scan.tools.map((tool) => ({
        id: tool.path,
        path: `./${tool.path}`,
        role: {
          value: "unknown",
          confidence: "low",
          inferred_from: tool.guidance
        },
        primary_docs: tool.guidance
      })),
      questions: scan.tools.map((tool) => `What role does ${tool.path} play in this workspace?`)
    };

    await writeFile(resolve(workspace, "workspace.catalog.draft.yaml"), stringify(draft));
    console.log(`Wrote ${resolve(workspace, "workspace.catalog.draft.yaml")}`);
    return;
  }

  console.error("Usage: workspace-catalog scan [workspace]");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

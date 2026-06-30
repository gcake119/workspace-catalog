#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stringify } from "yaml";
import { detectCatalogDrift, writeDriftReport } from "./drift.js";
import { createPreflightReport, formatPreflightReport, parsePreflightArgs } from "./preflight.js";
import { evidenceSummary, scanWorkspace } from "./scanner.js";
import { createStatusSnapshot, writeStatusSnapshot } from "./status.js";

async function runScan(workspace) {
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
      },
      orientation: {
        value: "Review workspace docs to confirm orientation.",
        confidence: "low",
        inferred_from: scan.root.guidance
      }
    },
    agent_routing: {
      default_skills: {
        value: [],
        confidence: "low",
        inferred_from: scan.root.guidance
      },
      task_routes: {
        value: [],
        confidence: "low",
        inferred_from: scan.root.guidance
      },
      rules: {
        value: [],
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
      primary_docs: tool.guidance,
      recommended_skills: {
        value: [],
        confidence: "low",
        inferred_from: tool.guidance
      },
      required_preflight_skills: {
        value: [],
        confidence: "low",
        inferred_from: tool.guidance
      },
      skill_rules: {
        value: [],
        confidence: "low",
        inferred_from: tool.guidance
      },
      disabled_skills: {
        value: [],
        confidence: "low",
        inferred_from: tool.guidance
      }
    })),
    questions: scan.tools.flatMap((tool) => [
      `What role does ${tool.path} play in this workspace?`,
      `Which skills should agents use or avoid when working on ${tool.path}?`
    ]),
    recommended_next_steps: scan.documentation_guidance,
    evidence: evidenceSummary(scan)
  };

  const output = resolve(workspace, "workspace.catalog.draft.yaml");
  await writeFile(output, stringify(draft));
  console.log(`Wrote ${output}`);
}

async function main() {
  const command = process.argv[2];
  const workspace = resolve(process.argv[3] ?? process.cwd());

  if (command === "scan") {
    await runScan(workspace);
    return;
  }

  if (command === "status") {
    const snapshot = await createStatusSnapshot(workspace);
    const output = await writeStatusSnapshot(workspace, snapshot);
    console.log(`Wrote ${output}`);
    return;
  }

  if (command === "drift") {
    const report = await detectCatalogDrift(workspace);
    const output = await writeDriftReport(workspace, report);
    console.log(`Wrote ${output}`);
    return;
  }

  if (command === "preflight") {
    const options = parsePreflightArgs(process.argv.slice(4));
    const report = await createPreflightReport(workspace, options);
    console.log(formatPreflightReport(report));
    return;
  }

  console.error("Usage: workspace-catalog <scan|status|drift|preflight> [workspace]");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

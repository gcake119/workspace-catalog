#!/usr/bin/env node
import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createPreflightReport,
  formatPreflightReport,
  parsePreflightArgs
} from "../cli/src/preflight.js";

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function findInitializedWorkspace(start) {
  let current = resolve(start);

  while (true) {
    if (await exists(resolve(current, "workspace.catalog.yaml"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function main() {
  const start = resolve(process.argv[2] ?? process.cwd());
  const workspace = await findInitializedWorkspace(start);
  if (!workspace) return;

  const options = parsePreflightArgs(process.argv.slice(3));
  const report = await createPreflightReport(workspace, options);
  const formatted = formatPreflightReport(report);

  if (formatted !== "No workspace catalog preflight reminders.") {
    console.log(formatted);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

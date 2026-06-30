#!/usr/bin/env node
import { resolve } from "node:path";
import {
  createPreflightReport,
  formatPreflightReport,
  parsePreflightArgs
} from "../cli/src/preflight.js";

async function main() {
  const workspace = resolve(process.argv[2] ?? process.cwd());
  const options = parsePreflightArgs(process.argv.slice(3));
  const report = await createPreflightReport(workspace, options);
  console.log(formatPreflightReport(report));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { scanWorkspace } from "./scanner.js";

const READ_CATALOG_MESSAGE = "Read workspace.catalog.yaml before inferring tool roles, workflow boundaries, or active project direction.";
const MISSING_CATALOG_MESSAGE = "Use the workspace-catalog skill to scan this workspace and produce a draft catalog for user confirmation.";
const DRIFT_MESSAGE = "Catalog drift may exist because workspace guidance, ADRs, README, or Spectra artifacts changed. Run workspace-catalog drift or refresh the draft before relying on old catalog semantics.";

const DRIFT_EXACT_FILES = new Set([
  "AGENTS.md",
  "README.md",
  ".cursorrules"
]);

const DRIFT_PATH_SEGMENTS = [
  ".cursor/rules/",
  "docs/decisions/",
  "openspec/changes/",
  "openspec/specs/",
  "docs/superpowers/specs/",
  "docs/superpowers/plans/"
];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

function normalizeChangedPath(path) {
  return String(path ?? "").replace(/^\.\//, "");
}

export function isDriftRelevantPath(path) {
  const normalized = normalizeChangedPath(path);
  const basename = normalized.split("/").at(-1);
  return DRIFT_EXACT_FILES.has(basename) ||
    DRIFT_PATH_SEGMENTS.some((segment) => normalized.includes(segment) || normalized.startsWith(segment));
}

export function parsePreflightArgs(args) {
  const parsed = {
    changed_files: [],
    event: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--changed" || arg === "--changed-file") {
      const value = args[index + 1];
      if (value) parsed.changed_files.push(value);
      index += 1;
      continue;
    }

    if (arg === "--event") {
      parsed.event = args[index + 1] ?? null;
      index += 1;
    }
  }

  return parsed;
}

export async function createPreflightReport(root, options = {}) {
  const catalogPath = resolve(root, "workspace.catalog.yaml");
  const catalogExists = await exists(catalogPath);
  const changedFiles = options.changed_files ?? [];
  const event = options.event ?? null;
  const reminders = [];

  if (catalogExists) {
    reminders.push({
      code: "WORKSPACE_CATALOG_READ_REQUIRED",
      message: READ_CATALOG_MESSAGE
    });
  } else {
    const scan = await scanWorkspace(root);
    if (scan.tools.length > 0) {
      reminders.push({
        code: "WORKSPACE_CATALOG_MISSING",
        message: MISSING_CATALOG_MESSAGE
      });
    }
  }

  const driftRelevantFiles = changedFiles
    .map(normalizeChangedPath)
    .filter(isDriftRelevantPath);
  const driftEvent = event === "spectra-archive";

  if (catalogExists && (driftEvent || driftRelevantFiles.length > 0)) {
    reminders.push({
      code: "WORKSPACE_CATALOG_DRIFT_POSSIBLE",
      message: DRIFT_MESSAGE,
      changed_files: driftRelevantFiles,
      event
    });
  }

  return {
    generated_at: new Date().toISOString(),
    workspace: root,
    catalog: {
      exists: catalogExists,
      path: "workspace.catalog.yaml"
    },
    trigger: {
      event,
      changed_files: changedFiles
    },
    reminders
  };
}

export function formatPreflightReport(report) {
  if (report.reminders.length === 0) {
    return "No workspace catalog preflight reminders.";
  }

  return report.reminders
    .map((reminder) => `${reminder.code}: ${reminder.message}`)
    .join("\n");
}

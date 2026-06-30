import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { collectGitStatus } from "./collectors/git.js";
import { collectSpectraStatus } from "./collectors/spectra.js";
import { validateCatalog } from "./catalog-schema.js";

export async function createStatusSnapshot(root, options = {}) {
  const catalogPath = resolve(root, "workspace.catalog.yaml");
  const catalog = parse(await readFile(catalogPath, "utf8"));
  const errors = validateCatalog(catalog);
  if (errors.length > 0) {
    throw new Error(`Invalid catalog: ${errors.join(", ")}`);
  }

  const gitCollector = options.gitCollector ?? collectGitStatus;
  const spectraCollector = options.spectraCollector ?? collectSpectraStatus;

  return {
    generated_at: new Date().toISOString(),
    catalog_ref: {
      path: "workspace.catalog.yaml",
      schema_version: catalog.schema_version,
      workspace_id: catalog.workspace.id,
      tool_ids: catalog.tools.map((tool) => tool.id)
    },
    live_status: {
      git: await gitCollector(root),
      spectra: await spectraCollector(root)
    }
  };
}

export async function writeStatusSnapshot(root, snapshot) {
  const dir = resolve(root, ".workspace-catalog");
  await mkdir(dir, { recursive: true });
  const outputPath = resolve(dir, "status.json");
  await writeFile(outputPath, JSON.stringify(snapshot, null, 2));
  return outputPath;
}

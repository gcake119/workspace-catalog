import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { collectGitStatus } from "./collectors/git.js";
import { collectSpectraStatus } from "./collectors/spectra.js";
import { validateCatalog } from "./catalog-schema.js";
import { collectCodebaseMemoryPresence } from "./scanner.js";
import { resolveWorkspacePath } from "./workspace-path.js";

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function readPackageScripts(path) {
  try {
    const manifest = JSON.parse(await readFile(path, "utf8"));
    return {
      ok: true,
      path,
      scripts: manifest.scripts ?? {}
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: false, path, reason: "package_json_missing" };
    }
    return { ok: false, path, reason: "package_json_unreadable" };
  }
}

function verificationCommandsForPackage(packageInfo) {
  if (!packageInfo.ok) return [];
  const preferredScripts = ["test", "vitest", "test:e2e", "e2e", "lint", "build"];
  return preferredScripts
    .filter((script) => Object.hasOwn(packageInfo.scripts, script))
    .map((script) => ({
      script,
      command: packageInfo.path === "package.json"
        ? `pnpm ${script}`
        : `pnpm --dir ${packageInfo.path.replace(/\/package\.json$/, "")} ${script}`
    }));
}

async function collectAdrIndex(root) {
  const relativePath = "docs/decisions/index.md";
  return {
    ok: await exists(resolve(root, relativePath)),
    path: relativePath
  };
}

async function collectPackageScripts(root, catalog) {
  const packagePaths = new Set(["package.json"]);
  const invalidToolPackages = [];
  for (const tool of catalog.tools ?? []) {
    const resolved = resolveWorkspacePath(root, tool.path);
    if (!resolved.ok) {
      invalidToolPackages.push({
        ok: false,
        path: String(tool.path ?? ""),
        tool_id: tool.id,
        reason: "catalog_tool_path_invalid"
      });
      continue;
    }

    packagePaths.add(`${resolved.relative_path}/package.json`);
  }

  const packages = [];
  for (const packagePath of [...packagePaths].sort()) {
    const result = await readPackageScripts(resolve(root, packagePath));
    packages.push({
      ...result,
      path: packagePath
    });
  }

  return [...packages, ...invalidToolPackages];
}

export async function createStatusSnapshot(root, options = {}) {
  const catalogPath = resolve(root, "workspace.catalog.yaml");
  const catalog = parse(await readFile(catalogPath, "utf8"));
  const errors = validateCatalog(catalog);
  if (errors.length > 0) {
    throw new Error(`Invalid catalog: ${errors.join(", ")}`);
  }

  const gitCollector = options.gitCollector ?? collectGitStatus;
  const spectraCollector = options.spectraCollector ?? collectSpectraStatus;
  const adrIndex = await collectAdrIndex(root);
  const package_scripts = await collectPackageScripts(root, catalog);

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
      spectra: await spectraCollector(root),
      adr_index: adrIndex,
      package_scripts,
      suggested_verification_commands: package_scripts.flatMap(verificationCommandsForPackage),
      codebase_memory: await collectCodebaseMemoryPresence(root, {
        codebaseMemoryCollector: options.codebaseMemoryCollector
      })
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

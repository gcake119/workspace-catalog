import { stat, writeFile, mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { flattenEvidence, scanWorkspace } from "./scanner.js";
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

async function getMtimeMs(path) {
  try {
    return (await stat(path)).mtimeMs;
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function catalogEvidenceSources(catalog) {
  return new Set([
    ...(catalog.evidence_sources ?? []),
    ...(catalog.primary_docs ?? []),
    ...(catalog.tools ?? []).flatMap((tool) => tool.primary_docs ?? []),
    ...(catalog.workflows ?? []).flatMap((workflow) => workflow.primary_docs ?? [])
  ]);
}

function isDocsOrSpecSource(source) {
  return [
    "AGENTS.md",
    "README.md",
    ".cursorrules",
    ".cursor/rules/",
    "docs/decisions/",
    "openspec/specs/",
    "openspec/changes/",
    "docs/superpowers/specs/",
    "docs/superpowers/plans/",
    "package.json"
  ].some((pattern) => source === pattern || source.includes(`/${pattern}`) || source.startsWith(pattern));
}

export async function detectCatalogDrift(root) {
  const catalogPath = resolve(root, "workspace.catalog.yaml");
  const catalog = parse(await readFile(catalogPath, "utf8"));
  const catalogMtime = await getMtimeMs(catalogPath);
  const scan = await scanWorkspace(root);
  const currentEvidence = flattenEvidence(scan);
  const catalogSources = catalogEvidenceSources(catalog);
  const items = [];

  for (const tool of catalog.tools ?? []) {
    const resolved = resolveWorkspacePath(root, tool.path);
    if (!resolved.ok) {
      items.push({
        code: "CATALOG_TOOL_PATH_INVALID",
        message: `Catalog tool path is invalid: ${tool.path ?? ""}`,
        tool_id: tool.id
      });
      continue;
    }

    if (!(await exists(resolved.path))) {
      items.push({
        code: "CATALOG_TOOL_PATH_MISSING",
        message: `Catalog tool path is missing: ${tool.path}`,
        tool_id: tool.id
      });
    }
  }

  for (const source of currentEvidence) {
    if (!catalogSources.has(source)) {
      items.push({
        code: "CATALOG_EVIDENCE_SOURCE_NEW",
        message: `Workspace evidence source is not referenced by the confirmed catalog: ${source}`,
        source
      });
    }

    if (isDocsOrSpecSource(source)) {
      const sourceMtime = await getMtimeMs(join(root, source));
      if (catalogMtime !== null && sourceMtime !== null && sourceMtime > catalogMtime) {
        items.push({
          code: "CATALOG_EVIDENCE_NEWER_THAN_CATALOG",
          message: `Workspace evidence changed after the confirmed catalog: ${source}`,
          source
        });
      }
    }
  }

  return {
    generated_at: new Date().toISOString(),
    evidence: {
      scanned_sources: currentEvidence,
      codebase_memory: scan.codebase_memory
    },
    items
  };
}

export async function writeDriftReport(root, report) {
  const dir = resolve(root, ".workspace-catalog");
  await mkdir(dir, { recursive: true });
  const outputPath = resolve(dir, "drift-report.md");
  const lines = [
    "# Workspace Catalog Drift Report",
    "",
    `Generated: ${report.generated_at}`,
    "",
    "## Scanned Evidence",
    "",
    ...(report.evidence?.scanned_sources ?? []).map((source) => `- ${source}`),
    "",
    "## Findings",
    "",
    ...(report.items.length > 0
      ? report.items.map((item) => `- ${item.code}: ${item.message}`)
      : ["- No drift items detected."])
  ];
  await writeFile(outputPath, `${lines.join("\n")}\n`);
  return outputPath;
}

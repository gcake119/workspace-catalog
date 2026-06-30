import { stat, writeFile, mkdir, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { parse } from "yaml";

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

function resolveWorkspacePath(root, path) {
  const rawPath = String(path ?? "").trim();
  if (!rawPath || isAbsolute(rawPath)) return { ok: false };

  const rootPath = resolve(root);
  const candidate = resolve(rootPath, rawPath.replace(/^\.\//, ""));
  const rel = relative(rootPath, candidate);

  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return { ok: false };
  return { ok: true, path: candidate };
}

export async function detectCatalogDrift(root) {
  const catalog = parse(await readFile(resolve(root, "workspace.catalog.yaml"), "utf8"));
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

  return {
    generated_at: new Date().toISOString(),
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
    ...report.items.map((item) => `- ${item.code}: ${item.message}`)
  ];
  await writeFile(outputPath, `${lines.join("\n")}\n`);
  return outputPath;
}

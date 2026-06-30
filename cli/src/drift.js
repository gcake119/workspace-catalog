import { stat, writeFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
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

export async function detectCatalogDrift(root) {
  const catalog = parse(await readFile(resolve(root, "workspace.catalog.yaml"), "utf8"));
  const items = [];

  for (const tool of catalog.tools ?? []) {
    const normalizedPath = String(tool.path ?? "").replace(/^\.\//, "");
    if (!normalizedPath || !(await exists(resolve(root, normalizedPath)))) {
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

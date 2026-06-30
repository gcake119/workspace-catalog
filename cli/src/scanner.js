import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT_GUIDANCE = ["AGENTS.md", "README.md"];
const TOOL_GUIDANCE = [
  "AGENTS.md",
  "README.md",
  "docs/decisions/index.md",
  "openspec/config.yaml"
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

async function listChildDirs(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

async function collectExisting(root, base, files) {
  const found = [];
  for (const file of files) {
    const absolute = join(root, base, file);
    if (await exists(absolute)) {
      found.push(relative(root, absolute));
    }
  }
  return found;
}

export async function scanWorkspace(root) {
  const rootGuidance = await collectExisting(root, "", ROOT_GUIDANCE);
  const childDirs = await listChildDirs(root);
  const tools = [];

  for (const dir of childDirs) {
    const guidance = await collectExisting(root, dir, TOOL_GUIDANCE);
    if (guidance.length > 0) {
      tools.push({
        path: dir,
        guidance
      });
    }
  }

  return {
    root: {
      path: ".",
      guidance: rootGuidance
    },
    tools
  };
}

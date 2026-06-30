import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT_GUIDANCE_FILES = ["AGENTS.md", "README.md", ".cursorrules", "package.json"];
const GUIDANCE_FILES = [
  "AGENTS.md",
  "README.md",
  ".cursorrules",
  "docs/decisions/index.md",
  "package.json"
];
const GUIDANCE_GLOBS = [
  { dir: ".cursor/rules", files: "all" },
  { dir: "docs/decisions", files: /^ADR-.*\.md$/ },
  { dir: "openspec/specs", files: "all" },
  { dir: "openspec/changes", files: "all" },
  { dir: "docs/superpowers/specs", files: "all" },
  { dir: "docs/superpowers/plans", files: "all" }
];
const IGNORED_CHILD_DIRS = new Set([
  "node_modules",
  ".git",
  ".workspace-catalog",
  ".cursor"
]);
const IGNORED_RECURSIVE_DIRS = new Set([
  "node_modules",
  ".git",
  ".workspace-catalog"
]);

function unavailable(reason) {
  return { ok: false, reason };
}

export async function collectCodebaseMemoryPresence(root, options = {}) {
  const collector = options.codebaseMemoryCollector;
  if (!collector) {
    return unavailable("codebase_memory_unavailable");
  }

  try {
    return await collector(root);
  } catch {
    return unavailable("codebase_memory_unavailable");
  }
}

function sortPaths(paths) {
  return [...paths].sort((a, b) => a.localeCompare(b));
}

function isAllowedFile(fileName, rule) {
  if (rule === "all") return true;
  return rule.test(fileName);
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function listFilesRecursively(root, dir, rule) {
  const base = join(root, dir);
  if (!(await isDirectory(base))) return [];

  const found = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_RECURSIVE_DIRS.has(entry.name)) {
          await walk(absolute);
        }
        continue;
      }

      if (entry.isFile() && isAllowedFile(entry.name, rule)) {
        found.push(relative(root, absolute));
      }
    }
  }

  await walk(base);
  return sortPaths(found);
}

async function collectGuidance(root, base, files) {
  const exact = await collectExisting(root, base, files);
  const recursive = [];
  for (const glob of GUIDANCE_GLOBS) {
    recursive.push(...(await listFilesRecursively(root, join(base, glob.dir), glob.files)));
  }
  return sortPaths([...exact, ...recursive]);
}

export function flattenEvidence(scan) {
  return sortPaths([
    ...(scan.root?.guidance ?? []),
    ...(scan.tools ?? []).flatMap((tool) => tool.guidance ?? [])
  ]);
}

export function evidenceByToolPath(scan) {
  return new Map((scan.tools ?? []).map((tool) => [`./${tool.path}`, tool.guidance ?? []]));
}

export function evidenceSet(scan) {
  return new Set(flattenEvidence(scan));
}

export function evidenceSummary(scan) {
  return {
    root: scan.root?.guidance ?? [],
    tools: (scan.tools ?? []).map((tool) => ({
      path: tool.path,
      guidance: tool.guidance ?? []
    })),
    codebase_memory: scan.codebase_memory
  };
}

export const evidenceSourcePatterns = {
  root_files: ROOT_GUIDANCE_FILES,
  guidance_files: GUIDANCE_FILES,
  guidance_dirs: GUIDANCE_GLOBS.map((item) => item.dir)
};

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
    .filter((entry) => !IGNORED_CHILD_DIRS.has(entry.name))
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
  const rootGuidance = await collectGuidance(root, "", ROOT_GUIDANCE_FILES);
  const childDirs = await listChildDirs(root);
  const tools = [];

  for (const dir of childDirs) {
    const guidance = await collectGuidance(root, dir, GUIDANCE_FILES);
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
    tools,
    codebase_memory: await collectCodebaseMemoryPresence(root)
  };
}

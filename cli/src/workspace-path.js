import { isAbsolute, relative, resolve } from "node:path";

export function resolveWorkspacePath(root, path) {
  const rawPath = String(path ?? "").trim();
  if (!rawPath || isAbsolute(rawPath)) return { ok: false };

  const rootPath = resolve(root);
  const candidate = resolve(rootPath, rawPath.replace(/^\.\//, ""));
  const rel = relative(rootPath, candidate);

  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return { ok: false };
  return { ok: true, path: candidate, relative_path: rel };
}

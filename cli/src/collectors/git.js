import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function collectGitStatus(cwd) {
  try {
    const branch = await execFileAsync("git", ["-C", cwd, "branch", "--show-current"]);
    const status = await execFileAsync("git", ["-C", cwd, "status", "--short"]);
    const latest = await execFileAsync("git", ["-C", cwd, "log", "--oneline", "-1"]);

    return {
      ok: true,
      branch: branch.stdout.trim(),
      dirty_files: status.stdout.trim().split("\n").filter(Boolean),
      latest_commit: latest.stdout.trim()
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

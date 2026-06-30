import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function collectSpectraStatus(cwd) {
  try {
    const result = await execFileAsync("spectra", ["list", "--json"], { cwd });
    return {
      ok: true,
      raw: JSON.parse(result.stdout)
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

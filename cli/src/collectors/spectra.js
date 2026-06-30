import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function getErrorCode(error) {
  if (error && typeof error === "object" && "code" in error) {
    return error.code ?? null;
  }
  return null;
}

export async function collectSpectraStatus(cwd) {
  try {
    const result = await execFileAsync("spectra", ["list", "--json"], { cwd });
    try {
      return {
        ok: true,
        raw: JSON.parse(result.stdout)
      };
    } catch {
      return {
        ok: false,
        reason: "spectra_output_invalid",
        code: null
      };
    }
  } catch (error) {
    return {
      ok: false,
      reason: "spectra_unavailable",
      code: getErrorCode(error)
    };
  }
}

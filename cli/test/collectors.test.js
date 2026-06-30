import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { collectGitStatus } from "../src/collectors/git.js";
import { collectSpectraStatus } from "../src/collectors/spectra.js";

test("collectGitStatus fails soft without raw error messages", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");

  const status = await collectGitStatus(root);

  assert.equal(status.ok, false);
  assert.equal(status.reason, "git_unavailable");
  assert.equal(Object.hasOwn(status, "error"), false);
});

test("collectSpectraStatus fails soft when spectra output is invalid JSON", async () => {
  const root = join(await mkdtemp(join(tmpdir(), "workspace-catalog-")), "workspace");
  const bin = join(root, "bin");
  await mkdir(bin, { recursive: true });

  const spectraPath = join(bin, "spectra");
  await writeFile(spectraPath, "#!/bin/sh\nprintf 'not json'\n");
  await chmod(spectraPath, 0o755);

  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath ?? ""}`;
  try {
    const status = await collectSpectraStatus(root);

    assert.deepEqual(status, {
      ok: false,
      reason: "spectra_output_invalid",
      code: null
    });
    assert.equal(Object.hasOwn(status, "error"), false);
  } finally {
    process.env.PATH = originalPath;
  }
});

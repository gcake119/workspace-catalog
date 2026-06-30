import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse, stringify } from "yaml";
import { validateCatalog } from "./catalog-schema.js";

const METADATA_KEYS = new Set([
  "questions",
  "evidence",
  "recommended_next_steps"
]);

function isInferenceWrapper(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.hasOwn(value, "value") &&
    Object.hasOwn(value, "confidence") &&
    Object.hasOwn(value, "inferred_from")
  );
}

function findInferenceWrappers(value, path = []) {
  if (isInferenceWrapper(value)) {
    return [path.join(".") || "<root>"];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findInferenceWrappers(item, [...path, String(index)]));
  }

  return Object.entries(value).flatMap(([key, item]) => findInferenceWrappers(item, [...path, key]));
}

export function createConfirmedCatalogFromDraft(draft) {
  const inferencePaths = findInferenceWrappers(draft);
  if (inferencePaths.length > 0) {
    return {
      ok: false,
      errors: inferencePaths.map((path) => `unconfirmed inference remains at ${path}`)
    };
  }

  const catalog = Object.fromEntries(
    Object.entries(draft ?? {}).filter(([key]) => !METADATA_KEYS.has(key))
  );
  const errors = validateCatalog(catalog);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, catalog };
}

export async function confirmCatalog(workspace, options = {}) {
  if (!options.yes) {
    return {
      ok: false,
      errors: ["confirm requires --yes after the user has reviewed and approved the draft"]
    };
  }

  const draftPath = resolve(workspace, "workspace.catalog.draft.yaml");
  const draft = parse(await readFile(draftPath, "utf8"));
  const result = createConfirmedCatalogFromDraft(draft);
  if (!result.ok) return result;

  const output = resolve(workspace, "workspace.catalog.yaml");
  await writeFile(output, stringify(result.catalog));
  return { ok: true, output };
}

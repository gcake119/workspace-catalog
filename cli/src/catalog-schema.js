export function validateCatalog(catalog) {
  const errors = [];

  if (!catalog || typeof catalog !== "object") {
    errors.push("catalog must be an object");
    return errors;
  }

  if (catalog.schema_version !== 1) {
    errors.push("schema_version must be 1");
  }

  if (!catalog.workspace || typeof catalog.workspace !== "object") {
    errors.push("workspace is required");
  } else {
    if (!catalog.workspace.id) errors.push("workspace.id is required");
    if (!catalog.workspace.name) errors.push("workspace.name is required");
    if (!catalog.workspace.purpose) errors.push("workspace.purpose is required");
  }

  if (!Array.isArray(catalog.workflows)) {
    errors.push("workflows must be an array");
  }

  if (!Array.isArray(catalog.tools)) {
    errors.push("tools must be an array");
  }

  return errors;
}

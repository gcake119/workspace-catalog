# Security Policy

Workspace Catalog is a local-first developer tool. It scans workspace files and writes local catalog outputs.

## Reporting

Please report security issues privately by opening a GitHub security advisory for this repository.

Do not disclose vulnerabilities publicly before there is a fix or mitigation.

## Sensitive Data

Do not include secrets, tokens, private keys, production credentials, or personal data in:

- `workspace.catalog.yaml`
- `workspace.catalog.draft.yaml`
- `.workspace-catalog/status.json`
- `.workspace-catalog/drift-report.md`

Collectors should fail soft and avoid exposing raw error messages when possible.

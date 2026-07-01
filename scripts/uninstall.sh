#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bin_dir="${WORKSPACE_CATALOG_BIN_DIR:-"$HOME/.local/bin"}"
codex_home="${CODEX_HOME:-"$HOME/.codex"}"
skill_dir="$codex_home/skills"

remove_repo_symlink() {
  local target="$1"
  local expected_prefix="$2"

  if [[ ! -L "$target" ]]; then
    echo "Skipping non-symlink or missing path: $target"
    return
  fi

  local resolved
  resolved="$(readlink "$target")"
  if [[ "$resolved" == "$expected_prefix"* ]]; then
    rm "$target"
    echo "Removed $target"
  else
    echo "Skipping symlink not owned by this checkout: $target -> $resolved"
  fi
}

remove_repo_symlink "$bin_dir/workspace-catalog" "$repo_root/"
remove_repo_symlink "$bin_dir/workspace-catalog-preflight" "$repo_root/"
remove_repo_symlink "$bin_dir/workspace-catalog-session-preflight" "$repo_root/"
remove_repo_symlink "$skill_dir/workspace-catalog" "$repo_root/"

echo "Uninstall complete. Workspace memories under .workspace-catalog/ were not touched."

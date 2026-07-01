#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bin_dir="${WORKSPACE_CATALOG_BIN_DIR:-"$HOME/.local/bin"}"
codex_home="${CODEX_HOME:-"$HOME/.codex"}"
skill_dir="$codex_home/skills"
binary="$repo_root/target/release/workspace-catalog"
install_hook=false

for arg in "$@"; do
  case "$arg" in
    --with-hook)
      install_hook=true
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: ./scripts/install.sh [--with-hook]" >&2
      exit 1
      ;;
  esac
done

link_file() {
  local source="$1"
  local target="$2"

  if [[ -e "$target" && ! -L "$target" ]]; then
    echo "Refusing to replace non-symlink: $target" >&2
    echo "Move it away first, then rerun this installer." >&2
    exit 1
  fi

  ln -sfn "$source" "$target"
}

echo "Building workspace-catalog..."
cargo build --release --manifest-path "$repo_root/Cargo.toml"

mkdir -p "$bin_dir" "$skill_dir"

link_file "$binary" "$bin_dir/workspace-catalog"
link_file "$binary" "$bin_dir/workspace-catalog-preflight"
link_file "$binary" "$bin_dir/workspace-catalog-session-preflight"
link_file "$repo_root/skills/workspace-catalog" "$skill_dir/workspace-catalog"

echo "Installed Workspace Catalog:"
echo "  $bin_dir/workspace-catalog"
echo "  $bin_dir/workspace-catalog-preflight"
echo "  $bin_dir/workspace-catalog-session-preflight"
echo "  $skill_dir/workspace-catalog"

if [[ "$install_hook" == true ]]; then
  "$bin_dir/workspace-catalog" install-hook
else
  echo "Global hook not enabled. To enable strict session hook:"
  echo "  workspace-catalog install-hook"
fi

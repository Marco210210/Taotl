#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
security_dir="${XDG_DATA_HOME:-$HOME/.local/share}/taotl-security"
strix_bin="$security_dir/strix-cli/strix-1.6.2-linux-arm64"
if [[ ! -x "$strix_bin" ]]; then
  printf 'Strix CLI non trovata: %s\n' "$strix_bin" >&2
  exit 1
fi
docker info >/dev/null

# An explicit API configuration may override the subscription model.
export STRIX_LLM="${STRIX_LLM:-chatgpt/gpt-6-sol}"
export STRIX_TELEMETRY=false
if [[ "$STRIX_LLM" == chatgpt/* ]] && ! "$strix_bin" auth status >/dev/null; then
  printf 'Completa prima il login: ~/.local/bin/strix auth login chatgpt --manual\n' >&2
  exit 1
fi
export STRIX_SANDBOX_CPUS=2
export STRIX_SANDBOX_MEM_LIMIT=4g
export STRIX_SANDBOX_PIDS_LIMIT=512
export STRIX_SANDBOX_SHM_SIZE=512m

mkdir -p "$security_dir/targets" "$security_dir/runs"
snapshot_dir="$(mktemp -d "$security_dir/targets/taotl-XXXXXXXX")"
# Only committed files: no .env, wallet, caches, .git history or local credentials.
git -C "$project_dir" archive HEAD | tar -x -C "$snapshot_dir"
printf 'Snapshot isolato: %s\n' "$snapshot_dir"
cd "$security_dir/runs"
exec "$strix_bin" --non-interactive --target "$snapshot_dir" \
  --scope-mode full --scan-mode standard --max-turns 60 \
  --instruction-file "$project_dir/server/security/strix-scope.md"

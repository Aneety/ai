#!/usr/bin/env bash
set -euo pipefail

log() { printf '[codex-cloud-submit] %s\n' "$*"; }
fail() { printf '[codex-cloud-submit] %s\n' "$*" >&2; exit 1; }

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

: "${CODEX_CLOUD_ENV_ID:?Set CODEX_CLOUD_ENV_ID to the target Codex Cloud environment id.}"
branch="${CODEX_CLOUD_BRANCH:-main}"
attempts="${CODEX_CLOUD_ATTEMPTS:-1}"
prompt_file="${CODEX_CLOUD_PROMPT_FILE:-.codex/cloud/controller-prompt.md}"

[ -f "$prompt_file" ] || fail "prompt file not found: $prompt_file"
command -v codex >/dev/null 2>&1 || fail "codex CLI not found in PATH"

if ! codex cloud exec --help >/tmp/codex-cloud-exec-help 2>&1; then
  fail "codex CLI does not expose 'codex cloud exec'; install or invoke a newer Codex CLI before scheduling"
fi

log "submitting controller task"
log "env=${CODEX_CLOUD_ENV_ID} branch=${branch} attempts=${attempts} prompt=${prompt_file}"

codex cloud exec \
  --env "$CODEX_CLOUD_ENV_ID" \
  --branch "$branch" \
  --attempts "$attempts" \
  "$(cat "$prompt_file")"

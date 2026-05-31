#!/usr/bin/env bash
set -euo pipefail

log() { printf '[codex-cloud-submit] %s\n' "$*"; }
fail() { printf '[codex-cloud-submit] %s\n' "$*" >&2; exit 1; }
run_codex() {
  local quoted_args arg
  printf -v quoted_args '%q ' "$@"
  eval "$codex_cli $quoted_args"
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$repo_root"

: "${CODEX_CLOUD_ENV_ID:?Set CODEX_CLOUD_ENV_ID to the target Codex Cloud environment id.}"
branch="${CODEX_CLOUD_BRANCH:-main}"
attempts="${CODEX_CLOUD_ATTEMPTS:-1}"
prompt_file="${CODEX_CLOUD_PROMPT_FILE:-}"
if [ -n "${CODEX_CLOUD_CLI:-}" ]; then
  codex_cli="$CODEX_CLOUD_CLI"
elif [ -x /opt/homebrew/bin/codex ]; then
  codex_cli="/opt/homebrew/bin/codex"
else
  codex_cli="codex"
fi

cleanup_prompt_file="0"
if [ -z "$prompt_file" ]; then
  prompt_file="$(mktemp -t aneety-controller-prompt.XXXXXX.md)"
  cleanup_prompt_file="1"
  node .codex/cloud/build-controller-prompt.mjs --output "$prompt_file"
fi
trap 'if [ "$cleanup_prompt_file" = "1" ]; then rm -f "$prompt_file"; fi' EXIT

[ -f "$prompt_file" ] || fail "prompt file not found: $prompt_file"

if ! run_codex cloud exec --help >/tmp/codex-cloud-exec-help 2>&1; then
  fail "configured Codex CLI does not expose 'cloud exec'; set CODEX_CLOUD_CLI to a newer CLI command before scheduling"
fi

log "submitting controller task"
log "env_id=present branch=${branch} attempts=${attempts} prompt=${prompt_file} cli=${codex_cli} target_cycle=${CODEX_CLOUD_TARGET_CYCLE:-auto} target_responsibility=${CODEX_CLOUD_TARGET_RESPONSIBILITY:-auto}"

run_codex cloud exec \
  --env "$CODEX_CLOUD_ENV_ID" \
  --branch "$branch" \
  --attempts "$attempts" \
  "$(cat "$prompt_file")"

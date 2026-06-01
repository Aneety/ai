#!/usr/bin/env bash
set -euo pipefail

log() { printf '[codex-cloud-secrets] %s\n' "$*"; }
fail() { printf '[codex-cloud-secrets] %s\n' "$*" >&2; exit 1; }

repo="${CODEX_CLOUD_GITHUB_REPO:-Aneety/ai}"

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    fail "required_env_missing=${name}"
  fi
}

set_secret() {
  local name="$1"
  local value="$2"
  printf '%s' "$value" | gh secret set "$name" --repo "$repo" --body-file - >/dev/null
  log "secret_set=${name}"
}

command -v gh >/dev/null 2>&1 || fail "gh_not_found"
gh auth status --hostname github.com >/dev/null 2>&1 || fail "gh_auth_missing"

require_env GH_TOKEN
require_env CLOUDFLARE_API_TOKEN
require_env CLOUDFLARE_ACCOUNT_ID

set_secret CLOUDFLARE_API_TOKEN "${CLOUDFLARE_API_TOKEN}"
set_secret CLOUDFLARE_ACCOUNT_ID "${CLOUDFLARE_ACCOUNT_ID}"

if [ -n "${CLOUDFLARE_EMAIL:-}" ]; then
  set_secret CLOUDFLARE_EMAIL "${CLOUDFLARE_EMAIL}"
fi

log "mirror_complete repo=${repo}"

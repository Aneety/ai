#!/usr/bin/env bash
set -euo pipefail

log() { printf '[codex-cloud-setup] %s\n' "$*"; }
need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[codex-cloud-setup] missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

need git
need gh
need node
need ruby

log "tool versions"
git --version
gh --version | sed -n '1p'
node --version
ruby --version

if [ -n "${GH_TOKEN:-}" ]; then
  log "GH_TOKEN present; validating GitHub CLI authentication without printing token"
  gh auth status >/tmp/gh-auth-status 2>&1 || {
    cat /tmp/gh-auth-status >&2
    exit 1
  }
  sed -n '1,20p' /tmp/gh-auth-status | sed -E 's/(Token: ).*/\1*** redacted ***/'
else
  log "GH_TOKEN not present; GitHub CLI write/API operations may be unavailable during agent phase"
fi

log "setup complete"

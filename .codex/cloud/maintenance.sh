#!/usr/bin/env bash
set -euo pipefail

log() { printf '[codex-cloud-maintenance] %s\n' "$*"; }

prepend_local_bin() {
  local local_bin="${HOME:-/tmp}/.local/bin"
  case ":$PATH:" in
    *":$local_bin:"*) ;;
    *) export PATH="$local_bin:$PATH" ;;
  esac
}

ensure_origin() {
  if ! git remote get-url origin >/dev/null 2>&1; then
    log "origin remote missing; adding read-only canonical origin"
    git remote add origin https://github.com/Aneety/ai.git
  fi
}

prepend_local_bin
ensure_origin

log "repo status"
git status --short
log "branch: $(git branch --show-current 2>/dev/null || true)"
log "head: $(git rev-parse --short HEAD)"
log "origin: $(git remote get-url origin 2>/dev/null || echo unavailable)"

git fetch --all --prune

log "workflow YAML parse"
ruby -e 'require "yaml"; Dir[".github/workflows/*.yml"].sort.each { |f| YAML.load_file(f); puts "yaml ok: #{f}" }'

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  log "open PRs"
  gh pr list --repo Aneety/ai --state open --limit 20 || true
  log "recent runs"
  gh run list --repo Aneety/ai --limit 10 || true
else
  log "gh is unavailable or unauthenticated; skipping PR/check listing"
fi

log "maintenance complete"

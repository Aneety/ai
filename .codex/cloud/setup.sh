#!/usr/bin/env bash
set -euo pipefail

log() { printf '[codex-cloud-setup] %s\n' "$*"; }
fail() { printf '[codex-cloud-setup] %s\n' "$*" >&2; exit 1; }
need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "missing required command: $1"
  fi
}

prepend_local_bin() {
  local local_bin="${HOME:-/tmp}/.local/bin"
  mkdir -p "$local_bin"
  case ":$PATH:" in
    *":$local_bin:"*) ;;
    *) export PATH="$local_bin:$PATH" ;;
  esac
}

install_gh_from_github_release() {
  command -v gh >/dev/null 2>&1 && return 0

  prepend_local_bin
  command -v gh >/dev/null 2>&1 && return 0

  need curl
  need tar

  local os arch gh_arch version tmpdir url archive root local_bin
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "$os" in
    linux) ;;
    *) fail "gh is missing and automatic bootstrap is supported only on linux; current os=$os" ;;
  esac
  case "$arch" in
    x86_64|amd64) gh_arch="amd64" ;;
    aarch64|arm64) gh_arch="arm64" ;;
    *) fail "gh is missing and current architecture is unsupported for bootstrap: $arch" ;;
  esac

  version="${GH_CLI_VERSION:-2.82.1}"
  version="${version#v}"
  url="https://github.com/cli/cli/releases/download/v${version}/gh_${version}_${os}_${gh_arch}.tar.gz"
  tmpdir="$(mktemp -d)"
  archive="$tmpdir/gh.tar.gz"
  local_bin="${HOME:-/tmp}/.local/bin"

  log "gh missing; installing GitHub CLI v${version} into user-local bin"
  curl --fail --location --silent --show-error "$url" --output "$archive"
  tar -xzf "$archive" -C "$tmpdir"
  root="$tmpdir/gh_${version}_${os}_${gh_arch}"
  install -m 0755 "$root/bin/gh" "$local_bin/gh"
  rm -rf "$tmpdir"
}

prepend_local_bin
need git
install_gh_from_github_release
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

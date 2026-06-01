#!/usr/bin/env bash
set -euo pipefail

log() { printf '[codex-cloud-operational-publish] %s\n' "$*"; }
fail() { printf '[codex-cloud-operational-publish] %s\n' "$*" >&2; exit 1; }
run_gh() {
  if [ "${CODEX_CLOUD_PUBLISH_USE_ENV_GH_TOKEN:-0}" = "1" ]; then
    gh "$@"
  else
    env -u GH_TOKEN gh "$@"
  fi
}
run_git_write() {
  if [ "${CODEX_CLOUD_PUBLISH_USE_ENV_GH_TOKEN:-0}" = "1" ]; then
    git "$@"
  else
    env -u GH_TOKEN git "$@"
  fi
}

extract_pr_number() {
  local url="$1"
  printf '%s' "$url" | sed -E 's#.*/pull/([0-9]+).*#\1#'
}

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "not inside a git repository"
cd "$repo_root"

repo_real="$(cd "$repo_root" && pwd -P)"
default_publish_worktree="$HOME/.codex/automations/aneety-project-hourly-controller/scheduler-worktree/ai"
publish_worktree="${CODEX_CLOUD_PUBLISH_WORKTREE_DIR:-${CODEX_CLOUD_WORKTREE_DIR:-$default_publish_worktree}}"
publish_worktree_real="$(cd "$publish_worktree" 2>/dev/null && pwd -P || true)"
if [ "${CODEX_CLOUD_ALLOW_CANONICAL_PUBLISH:-0}" != "1" ] && [ "$repo_real" != "$publish_worktree_real" ]; then
  fail "refusing to publish outside configured isolated worktree: $repo_root"
fi

command -v git >/dev/null 2>&1 || fail "git not found"
command -v gh >/dev/null 2>&1 || fail "gh not found"
run_gh auth status --hostname github.com >/tmp/gh-auth-status 2>&1 || fail "gh auth is missing or insufficient"
run_gh auth setup-git --hostname github.com >/tmp/gh-auth-setup-git 2>&1 || fail "gh could not configure git credentials"

repo="${CODEX_CLOUD_GITHUB_REPO:-Aneety/ai}"
base_branch="${CODEX_CLOUD_BRANCH:-main}"
target_cycle="${CODEX_CLOUD_TARGET_CYCLE:-}"
target_responsibility="${CODEX_CLOUD_TARGET_RESPONSIBILITY:-}"
title="${CODEX_CLOUD_OPERATIONAL_PR_TITLE:-}"
body_file="${CODEX_CLOUD_OPERATIONAL_PR_BODY_FILE:-}"

[ -n "$target_cycle" ] || fail "CODEX_CLOUD_TARGET_CYCLE is required"
[ -n "$target_responsibility" ] || fail "CODEX_CLOUD_TARGET_RESPONSIBILITY is required"
[ -n "$title" ] || fail "CODEX_CLOUD_OPERATIONAL_PR_TITLE is required"
[ -f "$body_file" ] || fail "CODEX_CLOUD_OPERATIONAL_PR_BODY_FILE is required"

if [ -z "$(git status --short)" ]; then
  log "pr_state=no_diff"
  exit 0
fi

branch="codex/${target_cycle}-${target_responsibility}-$(date +%F)"
existing_prefix_url="$(
  run_gh pr list --repo "$repo" --state open --limit 100 --json number,headRefName,url |
    node -e '
      const prefix = process.argv[1];
      const payload = JSON.parse(require("fs").readFileSync(0, "utf8") || "[]");
      const match = payload.find((pr) => String(pr.headRefName ?? "").startsWith(prefix));
      if (match) {
        process.stdout.write(`${match.number} ${match.headRefName} ${match.url}`);
      }
    ' "codex/${target_cycle}-${target_responsibility}" || true
)"
if [ -n "$existing_prefix_url" ]; then
  pr_number="${existing_prefix_url%% *}"
  rest="${existing_prefix_url#* }"
  pr_branch="${rest%% *}"
  pr_url="${rest#* }"
  log "pr_state=existing"
  log "pr_branch=${pr_branch}"
  log "pr_number=${pr_number}"
  log "pr_url=${pr_url}"
  exit 0
fi

if git ls-remote --exit-code --heads origin "refs/heads/${branch}" >/dev/null 2>&1; then
  branch="${branch}-$(date +%H%M%S)"
fi
if git show-ref --verify --quiet "refs/heads/${branch}"; then
  branch="${branch}-$(date +%H%M%S)"
fi

git switch -c "$branch" >/dev/null
git add -A
git commit -m "$title" >/dev/null
commit_sha="$(git rev-parse --short HEAD)"
run_git_write push -u origin "$branch" >/dev/null

pr_url="$(run_gh pr create --repo "$repo" --base "$base_branch" --head "$branch" --title "$title" --body-file "$body_file")"
pr_number="$(extract_pr_number "$pr_url")"

log "pr_state=created"
log "pr_branch=${branch}"
log "pr_number=${pr_number}"
log "pr_url=${pr_url}"
log "commit=${commit_sha}"

#!/usr/bin/env bash
set -euo pipefail

log() { printf '[codex-cloud-publish] %s\n' "$*"; }
fail() { printf '[codex-cloud-publish] %s\n' "$*" >&2; exit 1; }
run_codex() {
  local quoted_args
  printf -v quoted_args '%q ' "$@"
  eval "$codex_cli $quoted_args"
}
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

infer_responsibility_from_patch() {
  local patch_file="$1"
  local from_apps from_project
  from_apps="$(sed -nE 's#^diff --git a/aneety-platform/apps/([^/]+)/.*#\1#p' "$patch_file" | head -1)"
  if [ -n "$from_apps" ]; then
    printf '%s' "$from_apps"
    return
  fi
  from_project="$(sed -nE 's#^diff --git a/docs/project/([^./]+)\.md.*#\1#p' "$patch_file" | head -1)"
  printf '%s' "$from_project"
}

[ "$#" -eq 1 ] || fail "usage: $0 <task_id>"

task_id="$1"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "not inside a git repository"
cd "$repo_root"

repo_real="$(cd "$repo_root" && pwd -P)"
default_publish_worktree="$HOME/.codex/automations/aneety-project-hourly-controller/scheduler-worktree/ai"
publish_worktree="${CODEX_CLOUD_PUBLISH_WORKTREE_DIR:-${CODEX_CLOUD_WORKTREE_DIR:-$default_publish_worktree}}"
publish_worktree_real="$(cd "$publish_worktree" 2>/dev/null && pwd -P || true)"
if [ "${CODEX_CLOUD_ALLOW_CANONICAL_PUBLISH:-0}" != "1" ] && [ "$repo_real" != "$publish_worktree_real" ]; then
  fail "refusing to apply cloud diff outside configured isolated worktree: $repo_root"
fi

if [ -n "${CODEX_CLOUD_CLI:-}" ]; then
  codex_cli="$CODEX_CLOUD_CLI"
elif [ -x /opt/homebrew/bin/codex ]; then
  codex_cli="/opt/homebrew/bin/codex"
else
  codex_cli="codex"
fi

command -v git >/dev/null 2>&1 || fail "git not found"
command -v gh >/dev/null 2>&1 || fail "gh not found"

if ! run_codex cloud diff --help >/tmp/codex-cloud-diff-help 2>&1; then
  fail "configured Codex CLI does not expose 'cloud diff'"
fi
if ! run_gh auth status --hostname github.com >/tmp/gh-auth-status 2>&1; then
  fail "gh auth is missing or insufficient"
fi
run_gh auth setup-git --hostname github.com >/tmp/gh-auth-setup-git 2>&1 || fail "gh could not configure git credentials"

git reset --hard HEAD >/dev/null
git clean -fd >/dev/null

if [ -n "$(git status --short)" ]; then
  git status --short >&2
  fail "worktree must be clean before publishing a cloud diff"
fi

base_branch="${CODEX_CLOUD_BRANCH:-main}"
base_ref="origin/${base_branch}"
repo="${CODEX_CLOUD_GITHUB_REPO:-Aneety/ai}"
target_cycle="${CODEX_CLOUD_TARGET_CYCLE:-}"
target_responsibility="${CODEX_CLOUD_TARGET_RESPONSIBILITY:-}"

git fetch origin "$base_branch" --prune >/dev/null
git checkout --detach "$base_ref" >/dev/null
git reset --hard "$base_ref" >/dev/null
git clean -fd >/dev/null

patch_file="$(mktemp -t "aneety-codex-cloud-${task_id}.XXXXXX.patch")"
pr_body="$(mktemp -t "aneety-codex-cloud-${task_id}.XXXXXX.md")"
trap 'rm -f "$patch_file" "$pr_body"' EXIT
(cd /tmp && run_codex cloud diff "$task_id") >"$patch_file"

if ! grep -q '^diff --git ' "$patch_file"; then
  log "task_diff_state=no_diff task=${task_id}"
  log "pr_state=no_diff"
  exit 0
fi

if [ -z "$target_responsibility" ]; then
  target_responsibility="$(infer_responsibility_from_patch "$patch_file")"
fi

if [ -n "$target_cycle" ] && [ -n "$target_responsibility" ]; then
  branch="codex/${target_cycle}-${target_responsibility}-$(date +%F)"
else
  suffix="$(printf '%s' "$task_id" | sed -E 's/^task_//' | cut -c1-12)"
  branch="codex/cloud-task-${suffix}"
fi

if [ -n "$target_cycle" ] && [ -n "$target_responsibility" ]; then
  if [ "$target_cycle" = "repositorio" ]; then
    title="feat(${target_responsibility}): add repository scaffold"
  else
    title="chore(${target_responsibility}): advance ${target_cycle} cycle"
  fi
else
  title="docs(project): publish cloud task diff"
fi

existing_exact="$(run_gh pr list --repo "$repo" --state open --head "$branch" --json number,url --jq '.[0] | select(.) | (.number|tostring) + " " + .url' || true)"
if [ -n "$existing_exact" ]; then
  pr_number="${existing_exact%% *}"
  pr_url="${existing_exact#* }"
  log "open_pr_exists branch=${branch} url=${pr_url}"
  log "pr_state=existing"
  log "pr_branch=${branch}"
  log "pr_number=${pr_number}"
  log "pr_url=${pr_url}"
  exit 0
fi

if [ -n "$target_cycle" ] && [ -n "$target_responsibility" ]; then
  branch_prefix="codex/${target_cycle}-${target_responsibility}"
  existing_prefix_url="$(
    run_gh pr list --repo "$repo" --state open --limit 100 --json number,headRefName,url |
      node -e '
        const prefix = process.argv[1];
        const payload = JSON.parse(require("fs").readFileSync(0, "utf8") || "[]");
        const match = payload.find((pr) => String(pr.headRefName ?? "").startsWith(prefix));
        if (match) {
          process.stdout.write(`${match.number} ${match.headRefName} ${match.url}`);
        }
      ' "$branch_prefix" || true
  )"
  if [ -n "$existing_prefix_url" ]; then
    pr_number="${existing_prefix_url%% *}"
    rest="${existing_prefix_url#* }"
    pr_branch="${rest%% *}"
    pr_url="${rest#* }"
    log "open_pr_exists branch=${pr_branch} url=${pr_url}"
    log "pr_state=existing"
    log "pr_branch=${pr_branch}"
    log "pr_number=${pr_number}"
    log "pr_url=${pr_url}"
    exit 0
  fi
fi

if git ls-remote --exit-code --heads origin "refs/heads/${branch}" >/dev/null 2>&1; then
  suffix="$(printf '%s' "$task_id" | sed -E 's/^task_//' | cut -c1-8)"
  branch="${branch}-${suffix}"
fi
if git show-ref --verify --quiet "refs/heads/${branch}"; then
  suffix="$(printf '%s' "$task_id" | sed -E 's/^task_//' | cut -c1-8)"
  branch="${branch}-${suffix}"
fi

if ! git apply --check "$patch_file"; then
  fail "cloud diff does not apply cleanly to ${base_ref}"
fi

git apply "$patch_file"

if [ -z "$(git status --short)" ]; then
  log "task_diff_state=no_diff task=${task_id}"
  log "pr_state=no_diff"
  exit 0
fi

git switch -c "$branch" >/dev/null

git add -A
git commit -m "$title" >/dev/null
commit_sha="$(git rev-parse --short HEAD)"

run_git_write push -u origin "$branch" >/dev/null

cat >"$pr_body" <<BODY
## Summary

- Publishes Codex Cloud task \`$task_id\` as a GitHub branch and PR.
- Keeps the canonical local checkout untouched; the diff was applied only in the scheduler's isolated worktree.
- Leaves merge to the scheduler reconciliation gate.

## Validation

- Source task: \`$task_id\`.
- Branch: \`$branch\`.
- Commit: \`$commit_sha\`.
- Merge: not performed in this step.
BODY

pr_url="$(run_gh pr create --repo "$repo" --base "$base_branch" --head "$branch" --title "$title" --body-file "$pr_body" --draft)"
pr_number="$(extract_pr_number "$pr_url")"
log "pr_created url=${pr_url} branch=${branch} commit=${commit_sha}"
log "pr_state=created"
log "pr_branch=${branch}"
log "pr_number=${pr_number}"
log "pr_url=${pr_url}"

if [ -n "$pr_url" ]; then
  changed_docs=0
  evidence_rewrite='
    s/URL do PR será registrada após abertura/[PR pendente]($ENV{PR_URL})/g;
    s/evidência temporária até criação do PR/[PR pendente]($ENV{PR_URL})/g;
    s/PR ainda pendente nesta evidência temporária/[PR pendente]($ENV{PR_URL})/g;
  '
  if [ -f docs/project/index.md ]; then
    PR_URL="$pr_url" perl -0pi -e "$evidence_rewrite" docs/project/index.md
    changed_docs=1
  fi
  if [ -n "$target_responsibility" ] && [ -f "docs/project/${target_responsibility}.md" ]; then
    PR_URL="$pr_url" perl -0pi -e "$evidence_rewrite" "docs/project/${target_responsibility}.md"
    changed_docs=1
  fi
  if [ "$changed_docs" -eq 1 ] && [ -n "$(git status --short)" ]; then
    git add docs/project
    git commit -m "docs(project): link cloud task PR evidence" >/dev/null
    run_git_write push >/dev/null
    log "pr_evidence_updated url=${pr_url}"
  fi
fi

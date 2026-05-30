#!/usr/bin/env bash
set -euo pipefail

log() { printf '[aneety-controller-check] %s\n' "$*"; }

prepend_local_bin() {
  local local_bin="${HOME:-/tmp}/.local/bin"
  case ":$PATH:" in
    *":$local_bin:"*) ;;
    *) export PATH="$local_bin:$PATH" ;;
  esac
}

ensure_origin() {
  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin https://github.com/Aneety/ai.git
  fi
}

prepend_local_bin
ensure_origin

log "repository"
printf 'branch=%s\n' "$(git branch --show-current 2>/dev/null || true)"
printf 'head=%s\n' "$(git rev-parse --short HEAD)"
printf 'origin=%s\n' "$(git remote get-url origin 2>/dev/null || echo unavailable)"
printf 'status_short<<EOF\n'
git status --short
printf 'EOF\n'

log "canonical files"
for path in \
  docs/README.md \
  docs/01-arquitetura.md \
  docs/02-requisitos.md \
  docs/03-processos.md \
  docs/04-modelagem-banco.md \
  docs/05-estrutura-repositorios.md \
  docs/06-ciclos-cobertura.md \
  docs/07-governanca-github.md \
  docs/08-planejamento-ciclos-implementacao-repositorios.md \
  docs/project/index.md; do
  if [ -f "$path" ]; then
    printf 'OK %s\n' "$path"
  else
    printf 'MISSING %s\n' "$path"
  fi
done

log "project panel summary"
if [ -d docs/project ]; then
  printf 'project_file_count=%s\n' "$(find docs/project -maxdepth 1 -type f -name '*.md' | wc -l | tr -d ' ')"
  if [ -f docs/project/index.md ]; then
    printf 'blocked_count=%s\n' "$(grep -c '`bloqueado`' docs/project/index.md || true)"
    printf 'latest_updates<<EOF\n'
    sed -n '/^## Últimas atualizações/,$p' docs/project/index.md | sed -n '1,12p'
    printf 'EOF\n'
  fi
else
  printf 'MISSING docs/project\n'
fi

log "implementation roots"
if [ -d aneety-platform/apps ]; then
  find aneety-platform/apps -maxdepth 2 -mindepth 1 -print | sort
else
  printf 'MISSING aneety-platform/apps\n'
fi

log "GitHub state"
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh pr list --repo Aneety/ai --state open --limit 20 || true
  gh run list --repo Aneety/ai --limit 10 || true
else
  printf 'gh unavailable or unauthenticated; set GH_TOKEN as a Codex Cloud environment variable if PR/check reads are required.\n'
fi

log "check complete; no files modified by this script"

#!/usr/bin/env bash
set -euo pipefail

fail() { printf '[codex-cloud-watch] %s\n' "$*" >&2; exit 1; }
run_codex() {
  local quoted_args
  printf -v quoted_args '%q ' "$@"
  eval "$codex_cli $quoted_args"
}

[ "$#" -eq 1 ] || fail "usage: $0 <task_id>"

task_id="$1"
interval="${CODEX_CLOUD_WATCH_INTERVAL:-30}"
max_polls="${CODEX_CLOUD_WATCH_MAX_POLLS:-40}"
codex_cli="${CODEX_CLOUD_CLI:-codex}"

if ! run_codex cloud status --help >/tmp/codex-cloud-status-help 2>&1; then
  fail "configured Codex CLI does not expose 'cloud status'; set CODEX_CLOUD_CLI to a newer CLI command before watching"
fi

for i in $(seq 1 "$max_polls"); do
  printf '[codex-cloud-watch] poll=%s task=%s\n' "$i" "$task_id"
  set +e
  output="$(run_codex cloud status "$task_id" 2>&1)"
  status_code=$?
  set -e
  printf '%s\n' "$output"
  case "$output" in
    *'[READY]'*) exit 0 ;;
    *'[FAILED]'*|*'[CANCELLED]'*) exit 1 ;;
    *'[PENDING]'*|*'[RUNNING]'*) ;;
    *)
      if [ "$status_code" -ne 0 ]; then
        exit "$status_code"
      fi
      ;;
  esac
  sleep "$interval"
done

fail "task did not reach READY after ${max_polls} polls"

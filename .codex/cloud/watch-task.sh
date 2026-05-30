#!/usr/bin/env bash
set -euo pipefail

fail() { printf '[codex-cloud-watch] %s\n' "$*" >&2; exit 1; }

[ "$#" -eq 1 ] || fail "usage: $0 <task_id>"
command -v codex >/dev/null 2>&1 || fail "codex CLI not found in PATH"

task_id="$1"
interval="${CODEX_CLOUD_WATCH_INTERVAL:-30}"
max_polls="${CODEX_CLOUD_WATCH_MAX_POLLS:-40}"

for i in $(seq 1 "$max_polls"); do
  printf '[codex-cloud-watch] poll=%s task=%s\n' "$i" "$task_id"
  output="$(codex cloud status "$task_id" 2>&1)" || {
    printf '%s\n' "$output"
    exit 1
  }
  printf '%s\n' "$output"
  case "$output" in
    *'[READY]'*) exit 0 ;;
    *'[FAILED]'*|*'[CANCELLED]'*) exit 1 ;;
  esac
  sleep "$interval"
done

fail "task did not reach READY after ${max_polls} polls"

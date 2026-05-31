#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { loadControllerBacklog, resolveNextBacklogTarget } from './controller-backlog.mjs';
import { deriveMonitorState } from './controller-progress.mjs';

const repoRoot = process.cwd();
const stateFile =
  process.env.CODEX_CLOUD_STATE_FILE ??
  path.join(
    process.env.HOME ?? '',
    '.codex',
    'automations',
    'aneety-project-hourly-controller',
    'runtime-state.json',
  );
const envFile =
  process.env.CODEX_CLOUD_ENV_FILE ??
  path.join(
    process.env.HOME ?? '',
    '.codex',
    'automations',
    'aneety-project-hourly-controller',
    'cloud-env.sh',
  );
const isolatedWorktree =
  process.env.CODEX_CLOUD_WORKTREE_DIR ??
  path.join(
    process.env.HOME ?? '',
    '.codex',
    'automations',
    'aneety-project-hourly-controller',
    'scheduler-worktree',
    'ai',
  );
const prWatchInterval = positiveInteger(process.env.CODEX_CLOUD_PR_WATCH_INTERVAL, 30);
const prWatchMaxPolls = positiveInteger(process.env.CODEX_CLOUD_PR_WATCH_MAX_POLLS, 60);

function log(message) {
  console.log(`[codex-cloud-monitor] ${message}`);
}

function warn(message) {
  console.log(`[codex-cloud-monitor] blocker=${message}`);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function run(command, options = {}) {
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_')),
  );
  return new Promise((resolve) => {
    const child = spawn('bash', ['-c', command], {
      cwd: options.cwd ?? repoRoot,
      env: {
        ...childEnv,
        ...(options.env ?? {}),
        PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH ?? ''}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (!options.quiet && stdout.trim()) console.log(stdout.trim());
      if (!options.quiet && stderr.trim()) console.error(stderr.trim());
      resolve({ code, stdout, stderr });
    });
  });
}

function extractField(output, key) {
  const regex = new RegExp(`${key}=([^\\s]+)`, 'g');
  const matches = [...output.matchAll(regex)];
  return matches.length > 0 ? matches.at(-1)[1] : null;
}

async function checkEnvFile() {
  try {
    await access(envFile);
    const mode = (await stat(envFile)).mode & 0o777;
    log(`env_file=present mode=${mode.toString(8)}`);
    if (mode !== 0o600) warn(`env_file_mode_expected_600_actual_${mode.toString(8)}`);
    return true;
  } catch {
    warn('env_file_missing');
    return false;
  }
}

function withEnvFile(command) {
  return [
    'set -euo pipefail',
    'export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:${PATH:-}"',
    `set -a; . ${shellQuote(envFile)}; set +a`,
    'if [ -z "${CODEX_CLOUD_CLI:-}" ] && [ -x /opt/homebrew/bin/codex ]; then export CODEX_CLOUD_CLI=/opt/homebrew/bin/codex; fi',
    `export CODEX_CLOUD_PR_WATCH_INTERVAL=${shellQuote(String(prWatchInterval))}`,
    `export CODEX_CLOUD_PR_WATCH_MAX_POLLS=${shellQuote(String(prWatchMaxPolls))}`,
    command,
  ].join('; ');
}

async function readRuntimeState() {
  try {
    const raw = await readFile(stateFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readMainSha(runtimeState) {
  const exists = await run(`git -C ${shellQuote(isolatedWorktree)} rev-parse --is-inside-work-tree`, { quiet: true });
  if (exists.code === 0) {
    const sha = await run(`git -C ${shellQuote(isolatedWorktree)} rev-parse HEAD`, { quiet: true });
    if (sha.code === 0) return sha.stdout.trim().split('\n').filter(Boolean).at(-1) ?? null;
  }
  return runtimeState?.lastNoProgressMainSha ?? runtimeState?.lastMergedSha ?? null;
}

async function resolveBacklogTarget() {
  try {
    const backlog = await loadControllerBacklog(repoRoot);
    return resolveNextBacklogTarget(backlog);
  } catch (error) {
    warn('controller_backlog_parse_failed');
    log(`controller_backlog_error=${String(error.message ?? error)}`);
    return { state: 'blocked', reason: error.message ?? 'controller_backlog_parse_failed' };
  }
}

async function checkDryRun(hasEnvFile) {
  if (!hasEnvFile) return false;
  const result = await run('npm run codex-cloud:scheduler:dry-run', { quiet: true });
  if (result.code === 0) {
    log('scheduler_dry_run=ok');
    return true;
  }
  warn('scheduler_dry_run_failed');
  return false;
}

async function checkProcess() {
  const result = await run("ps -axo pid=,command= | grep '[n]ode .*\\.codex/cloud/scheduler\\.mjs' || true", {
    quiet: true,
  });
  const lines = result.stdout.trim().split('\n').filter(Boolean);
  if (lines.length === 0) {
    warn('scheduler_process_not_running');
  } else {
    log(`scheduler_process_count=${lines.length}`);
  }
  return lines.length;
}

async function checkIsolatedWorktree() {
  const exists = await run(`git -C ${shellQuote(isolatedWorktree)} rev-parse --is-inside-work-tree`, { quiet: true });
  if (exists.code !== 0) {
    warn('scheduler_worktree_missing');
    return { exists: false, dirtyCount: null };
  }

  const status = await run('git status --short', { cwd: isolatedWorktree, quiet: true });
  if (status.code !== 0) {
    warn('scheduler_worktree_status_failed');
    return { exists: true, dirtyCount: null };
  }

  const dirtyLines = status.stdout.trim().split('\n').filter(Boolean);
  if (dirtyLines.length === 0) {
    log('scheduler_worktree=clean');
  } else {
    warn(`scheduler_worktree_dirty_count_${dirtyLines.length}`);
  }
  return { exists: true, dirtyCount: dirtyLines.length };
}

async function checkCloudTasks(hasEnvFile) {
  const base = '${CODEX_CLOUD_CLI:-codex} cloud list --json --limit 20';
  const command = hasEnvFile
    ? withEnvFile(`${base} --env "$CODEX_CLOUD_ENV_ID"`)
    : 'if [ -x /opt/homebrew/bin/codex ]; then /opt/homebrew/bin/codex cloud list --json --limit 20; else codex cloud list --json --limit 20; fi';
  const result = await run(command, { quiet: true, cwd: '/tmp' });
  if (result.code !== 0) {
    warn('cloud_task_list_failed');
    return { count: null, latest: null, failed: true };
  }

  try {
    const payload = JSON.parse(result.stdout);
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    log(`cloud_task_count=${tasks.length}`);
    const latest = tasks[0] ?? null;
    if (latest) {
      const id = String(latest.id ?? latest.task_id ?? latest.taskId ?? 'unknown');
      const status = latest.status ?? latest.state ?? 'unknown';
      const updated = latest.updated_at ?? latest.updatedAt ?? latest.created_at ?? latest.createdAt ?? 'unknown';
      log(`latest_task=${id} status=${status} timestamp=${updated}`);
    }
    return { count: tasks.length, latest, failed: false };
  } catch {
    warn('cloud_task_list_json_parse_failed');
    return { count: null, latest: null, failed: true };
  }
}

async function checkOpenControllerPr(hasEnvFile, runtimeState) {
  const command = hasEnvFile
    ? withEnvFile('node .codex/cloud/reconcile-controller-pr.mjs --probe-only')
    : 'node .codex/cloud/reconcile-controller-pr.mjs --probe-only';
  const result = await run(command, { quiet: true });
  if (result.code !== 0) {
    warn('open_controller_pr_check_failed');
    return { state: 'unknown', count: null };
  }

  const state = extractField(result.stdout, 'open_controller_pr_state') ?? 'unknown';
  const prNumber = extractField(result.stdout, 'open_controller_pr')?.replace(/^#/, '') ?? null;
  const prBranch = extractField(result.stdout, 'branch');
  const prUrl = extractField(result.stdout, 'url');
  const mergedSha = extractField(result.stdout, 'sha');
  const failedChecks = extractField(result.stdout, 'open_controller_pr_failed_checks');
  const pendingChecks = extractField(result.stdout, 'open_controller_pr_pending_checks');

  if (prNumber) {
    log('open_controller_pr_count=1');
    log(`open_controller_pr=#${prNumber} branch=${prBranch ?? 'unknown'} url=${prUrl ?? 'unknown'}`);
  } else {
    log('open_controller_pr_count=0');
  }

  if (state === 'none') {
    if (runtimeState?.openControllerPrState === 'merged' && runtimeState.lastMergedSha) {
      log('open_controller_pr_state=merged');
      log(
        `open_controller_pr_merged=#${runtimeState.lastMergedPrNumber ?? 'unknown'} sha=${runtimeState.lastMergedSha} timestamp=${runtimeState.lastMergedAt ?? 'unknown'}`,
      );
      return { state: 'merged', count: 0, prNumber: runtimeState.lastMergedPrNumber ?? null, mergedSha: runtimeState.lastMergedSha };
    }

    log('open_controller_pr_state=none');
    return { state: 'none', count: 0 };
  }

  log(`open_controller_pr_state=${state}`);
  if (pendingChecks) {
    log(`open_controller_pr_pending_checks=${pendingChecks}`);
  }
  if (failedChecks) {
    log(`open_controller_pr_failed_checks=${failedChecks}`);
  }
  if (state === 'failed') {
    warn('open_controller_pr_failed');
  }
  if (state === 'timeout') {
    warn('open_controller_pr_timeout');
  }
  if (state === 'merged' && mergedSha) {
    log(`open_controller_pr_merged=#${prNumber ?? 'unknown'} sha=${mergedSha}`);
  }

  return {
    state,
    count: prNumber ? 1 : 0,
    prNumber,
    prBranch,
    prUrl,
    mergedSha,
  };
}

async function main() {
  process.chdir(path.resolve(repoRoot));
  const hasEnvFile = await checkEnvFile();
  await checkDryRun(hasEnvFile);
  await checkProcess();
  await checkIsolatedWorktree();

  const runtimeState = await readRuntimeState();
  const cloudTasks = await checkCloudTasks(hasEnvFile);
  const prState = await checkOpenControllerPr(hasEnvFile, runtimeState);
  const resolvedTarget = await resolveBacklogTarget();
  const mainSha = await readMainSha(runtimeState);
  const derived = deriveMonitorState({
    resolvedTarget,
    runtimeState,
    mainSha,
    openControllerPrState: prState.state,
    cloudTaskCount: cloudTasks.count ?? 0,
  });

  if (resolvedTarget.state === 'actionable') {
    log(`next_actionable_responsibility=${resolvedTarget.responsibility}`);
    log(`next_actionable_cycle=${resolvedTarget.cycle}`);
  }
  if (runtimeState?.lastActionableResponsibility) {
    log(`last_actionable_responsibility=${runtimeState.lastActionableResponsibility}`);
  }
  if (runtimeState?.lastActionableCycle) {
    log(`last_actionable_cycle=${runtimeState.lastActionableCycle}`);
  }
  log(`controller_progress_state=${derived.controllerProgressState}`);
  log(`awaiting_next_tick=${derived.awaitingNextTick}`);
  log(`backlog_completion_state=${derived.backlogCompletionState}`);
  if (derived.lastSuccessAgeSeconds != null) {
    log(`last_success_age_seconds=${derived.lastSuccessAgeSeconds}`);
  }

  if ((cloudTasks.count ?? 0) === 0 && derived.shouldWarnCloudTaskListEmpty) {
    warn('cloud_task_list_empty');
  }

  log('monitor_complete');
}

main().catch((error) => {
  warn(error.message);
  process.exit(1);
});

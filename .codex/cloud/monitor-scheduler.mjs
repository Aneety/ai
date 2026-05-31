#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

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

async function checkDryRun(hasEnvFile) {
  if (!hasEnvFile) return;
  const result = await run('npm run codex-cloud:scheduler:dry-run', { quiet: true });
  if (result.code === 0) {
    log('scheduler_dry_run=ok');
  } else {
    warn('scheduler_dry_run_failed');
  }
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
}

async function checkIsolatedWorktree() {
  const exists = await run(`git -C ${shellQuote(isolatedWorktree)} rev-parse --is-inside-work-tree`, { quiet: true });
  if (exists.code !== 0) {
    warn('scheduler_worktree_missing');
    return;
  }

  const status = await run('git status --short', { cwd: isolatedWorktree, quiet: true });
  if (status.code !== 0) {
    warn('scheduler_worktree_status_failed');
    return;
  }

  const dirtyLines = status.stdout.trim().split('\n').filter(Boolean);
  if (dirtyLines.length === 0) {
    log('scheduler_worktree=clean');
  } else {
    warn(`scheduler_worktree_dirty_count_${dirtyLines.length}`);
  }
}

async function checkCloudTasks(hasEnvFile) {
  const base = '${CODEX_CLOUD_CLI:-codex} cloud list --json --limit 20';
  const command = hasEnvFile
    ? withEnvFile(`${base} --env "$CODEX_CLOUD_ENV_ID"`)
    : 'if [ -x /opt/homebrew/bin/codex ]; then /opt/homebrew/bin/codex cloud list --json --limit 20; else codex cloud list --json --limit 20; fi';
  const result = await run(command, { quiet: true, cwd: '/tmp' });
  if (result.code !== 0) {
    warn('cloud_task_list_failed');
    return;
  }

  try {
    const payload = JSON.parse(result.stdout);
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    log(`cloud_task_count=${tasks.length}`);
    const latest = tasks[0];
    if (latest) {
      const id = String(latest.id ?? latest.task_id ?? latest.taskId ?? 'unknown');
      const status = latest.status ?? latest.state ?? 'unknown';
      const updated = latest.updated_at ?? latest.updatedAt ?? latest.created_at ?? latest.createdAt ?? 'unknown';
      log(`latest_task=${id} status=${status} timestamp=${updated}`);
    } else {
      warn('cloud_task_list_empty');
    }
  } catch {
    warn('cloud_task_list_json_parse_failed');
  }
}

async function checkOpenControllerPr(hasEnvFile) {
  const command = hasEnvFile
    ? withEnvFile('node .codex/cloud/reconcile-controller-pr.mjs --probe-only')
    : 'node .codex/cloud/reconcile-controller-pr.mjs --probe-only';
  const result = await run(command, { quiet: true });
  if (result.code !== 0) {
    warn('open_controller_pr_check_failed');
    return;
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
    const runtimeState = await readRuntimeState();
    if (runtimeState?.openControllerPrState === 'merged' && runtimeState.lastMergedSha) {
      log('open_controller_pr_state=merged');
      log(
        `open_controller_pr_merged=#${runtimeState.lastMergedPrNumber ?? 'unknown'} sha=${runtimeState.lastMergedSha} timestamp=${runtimeState.lastMergedAt ?? 'unknown'}`,
      );
    } else {
      log('open_controller_pr_state=none');
    }
    return;
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
}

async function main() {
  process.chdir(path.resolve(repoRoot));
  const hasEnvFile = await checkEnvFile();
  await checkDryRun(hasEnvFile);
  await checkProcess();
  await checkIsolatedWorktree();
  await checkCloudTasks(hasEnvFile);
  await checkOpenControllerPr(hasEnvFile);
  log('monitor_complete');
}

main().catch((error) => {
  warn(error.message);
  process.exit(1);
});

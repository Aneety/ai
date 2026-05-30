#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const envFile =
  process.env.CODEX_CLOUD_ENV_FILE ??
  path.join(
    process.env.HOME ?? '',
    '.codex',
    'automations',
    'aneety-project-hourly-controller',
    'cloud-env.sh',
  );

function log(message) {
  console.log(`[codex-cloud-monitor] ${message}`);
}

function warn(message) {
  console.log(`[codex-cloud-monitor] blocker=${message}`);
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
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
    command,
  ].join('; ');
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

async function main() {
  process.chdir(path.resolve(repoRoot));
  const hasEnvFile = await checkEnvFile();
  await checkDryRun(hasEnvFile);
  await checkProcess();
  await checkCloudTasks(hasEnvFile);
  log('monitor_complete');
}

main().catch((error) => {
  warn(error.message);
  process.exit(1);
});

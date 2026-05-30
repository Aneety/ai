#!/usr/bin/env node
import cron from 'node-cron';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const schedule = process.env.CODEX_CLOUD_SCHEDULE ?? '*/30 * * * *';
const timezone = process.env.CODEX_CLOUD_SCHEDULE_TZ ?? 'America/Asuncion';
const envFile =
  process.env.CODEX_CLOUD_ENV_FILE ??
  path.join(
    process.env.HOME ?? '',
    '.codex',
    'automations',
    'aneety-project-hourly-controller',
    'cloud-env.sh',
  );
const mode = process.argv.includes('--once')
  ? 'once'
  : process.argv.includes('--dry-run')
    ? 'dry-run'
    : 'schedule';

function log(message) {
  console.log(`[codex-cloud-scheduler] ${message}`);
}

function fail(message) {
  console.error(`[codex-cloud-scheduler] ${message}`);
  process.exit(1);
}

function reportScheduledFailure(message) {
  console.error(`[codex-cloud-scheduler] scheduled cycle failed: ${message}`);
}

function runBash(command, options = {}) {
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_')),
  );
  return new Promise((resolve) => {
    const child = spawn('bash', ['-c', command], {
      cwd: repoRoot,
      env: {
        ...childEnv,
        PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:${process.env.PATH ?? ''}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      if (!options.quiet) process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      if (!options.quiet) process.stderr.write(text);
    });

    child.on('close', (code) => resolve({ code, output }));
  });
}

async function assertReadable(filePath) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`env file not readable: ${filePath}`);
  }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function withEnvFile(command) {
  const quotedEnvFile = shellQuote(envFile);
  return [
    'set -euo pipefail',
    'export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:${PATH:-}"',
    `set -a; . ${quotedEnvFile}; set +a`,
    'if [ -z "${CODEX_CLOUD_CLI:-}" ] && [ -x /opt/homebrew/bin/codex ]; then export CODEX_CLOUD_CLI=/opt/homebrew/bin/codex; fi',
    command,
  ].join('; ');
}

async function preflight() {
  await assertReadable(envFile);
  const checks = [
    ['CODEX_CLOUD_ENV_ID', 'test -n "${CODEX_CLOUD_ENV_ID:-}"'],
    ['codex cloud exec', '${CODEX_CLOUD_CLI:-codex} cloud exec --help >/tmp/codex-cloud-exec-help 2>&1'],
    ['codex cloud status', '${CODEX_CLOUD_CLI:-codex} cloud status --help >/tmp/codex-cloud-status-help 2>&1'],
  ];

  for (const [name, command] of checks) {
    const result = await runBash(withEnvFile(command), { quiet: true });
    if (result.code !== 0) throw new Error(`preflight failed: ${name}`);
  }
}

function extractTaskId(output) {
  return output.match(/task_[A-Za-z0-9_-]+/)?.[0] ?? null;
}

async function runCycle(reason) {
  log(`cycle started reason=${reason}`);
  await preflight();

  const submit = await runBash(withEnvFile('.codex/cloud/submit-controller-task.sh'));
  if (submit.code !== 0) throw new Error(`submit failed with exit ${submit.code}`);

  const taskId = extractTaskId(submit.output);
  if (!taskId) throw new Error('submit did not emit a task id');

  log(`watching task=${taskId}`);
  const watch = await runBash(withEnvFile(`.codex/cloud/watch-task.sh ${shellQuote(taskId)}`));
  if (watch.code !== 0) throw new Error(`watch failed with exit ${watch.code}`);

  log(`cycle finished task=${taskId}`);
}

async function main() {
  process.chdir(path.resolve(repoRoot));

  if (mode === 'dry-run') {
    await preflight();
    log('dry-run ok');
    return;
  }

  if (mode === 'once') {
    await runCycle('manual');
    return;
  }

  const task = cron.schedule(
    schedule,
    async (context) => {
      try {
        await runCycle(context.execution?.reason ?? 'scheduled');
      } catch (error) {
        reportScheduledFailure(error.message);
      }
    },
    {
      name: 'Aneety Codex Cloud controller',
      timezone,
      noOverlap: true,
    },
  );

  log(`started schedule=${schedule} timezone=${timezone} next=${task.getNextRun()?.toISOString()}`);
}

main().catch((error) => fail(error.message));

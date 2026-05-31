#!/usr/bin/env node
import cron from 'node-cron';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const canonicalRepoRoot = process.cwd();
const schedule = process.env.CODEX_CLOUD_SCHEDULE ?? '*/30 * * * *';
const timezone = process.env.CODEX_CLOUD_SCHEDULE_TZ ?? 'America/Asuncion';
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
const autoPublishDiff = process.env.CODEX_CLOUD_AUTO_PUBLISH_DIFF !== '0';
const prWatchInterval = positiveInteger(process.env.CODEX_CLOUD_PR_WATCH_INTERVAL, 30);
const prWatchMaxPolls = positiveInteger(process.env.CODEX_CLOUD_PR_WATCH_MAX_POLLS, 60);
const mode = process.argv.includes('--once')
  ? 'once'
  : process.argv.includes('--dry-run')
    ? 'dry-run'
    : 'schedule';

let executionRoot = canonicalRepoRoot;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

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

function childEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.toLowerCase().startsWith('npm_')),
  );
}

function runBash(command, options = {}) {
  return new Promise((resolve) => {
    const child = spawn('bash', ['-c', command], {
      cwd: options.cwd ?? executionRoot,
      env: {
        ...childEnv(),
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
    `export CODEX_CLOUD_PR_WATCH_INTERVAL=${shellQuote(String(prWatchInterval))}`,
    `export CODEX_CLOUD_PR_WATCH_MAX_POLLS=${shellQuote(String(prWatchMaxPolls))}`,
    command,
  ].join('; ');
}

function extractField(output, key) {
  const regex = new RegExp(`${key}=([^\\s]+)`, 'g');
  const matches = [...output.matchAll(regex)];
  return matches.length > 0 ? matches.at(-1)[1] : null;
}

async function loadRuntimeState() {
  try {
    const raw = await readFile(stateFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeRuntimeState(patch) {
  const current = await loadRuntimeState();
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  await writeFile(stateFile, JSON.stringify(next, null, 2));
}

async function prepareIsolatedWorktree() {
  const branch = process.env.CODEX_CLOUD_BRANCH ?? 'main';
  await mkdir(path.dirname(isolatedWorktree), { recursive: true, mode: 0o700 });

  let result = await runBash(`git -C ${shellQuote(canonicalRepoRoot)} fetch origin ${shellQuote(branch)} --prune`, {
    cwd: canonicalRepoRoot,
    quiet: true,
  });
  if (result.code !== 0) throw new Error(`failed to fetch origin/${branch}`);

  result = await runBash(`git -C ${shellQuote(isolatedWorktree)} rev-parse --is-inside-work-tree`, {
    cwd: canonicalRepoRoot,
    quiet: true,
  });

  if (result.code !== 0) {
    result = await runBash(
      [
        `git -C ${shellQuote(canonicalRepoRoot)} worktree remove --force ${shellQuote(isolatedWorktree)} 2>/dev/null || true`,
        `rm -rf ${shellQuote(isolatedWorktree)}`,
        `git -C ${shellQuote(canonicalRepoRoot)} worktree prune`,
        `git -C ${shellQuote(canonicalRepoRoot)} worktree add --detach ${shellQuote(isolatedWorktree)} ${shellQuote(`origin/${branch}`)}`,
      ].join(' && '),
      { cwd: canonicalRepoRoot, quiet: true },
    );
    if (result.code !== 0) throw new Error(`failed to create isolated worktree at ${isolatedWorktree}`);
  }

  result = await runBash(
    [
      `git -C ${shellQuote(isolatedWorktree)} fetch origin ${shellQuote(branch)} --prune`,
      `git -C ${shellQuote(isolatedWorktree)} checkout --detach ${shellQuote(`origin/${branch}`)}`,
      `git -C ${shellQuote(isolatedWorktree)} reset --hard ${shellQuote(`origin/${branch}`)}`,
      `git -C ${shellQuote(isolatedWorktree)} clean -fd`,
      `npm ci`,
    ].join(' && '),
    { cwd: isolatedWorktree, quiet: true },
  );
  if (result.code !== 0) throw new Error(`failed to prepare isolated worktree at ${isolatedWorktree}`);

  executionRoot = isolatedWorktree;
  log(`isolated_worktree=ready path=${isolatedWorktree}`);
}

async function cleanIsolatedWorktree() {
  const branch = process.env.CODEX_CLOUD_BRANCH ?? 'main';
  const result = await runBash(
    [
      `git -C ${shellQuote(isolatedWorktree)} reset --hard ${shellQuote(`origin/${branch}`)}`,
      `git -C ${shellQuote(isolatedWorktree)} clean -fd`,
    ].join(' && '),
    { cwd: isolatedWorktree, quiet: true },
  );
  if (result.code !== 0) throw new Error(`failed to clean isolated worktree at ${isolatedWorktree}`);
  log('isolated_worktree=clean');
}

async function syncIsolatedWorktreeToMain() {
  const branch = process.env.CODEX_CLOUD_BRANCH ?? 'main';
  const result = await runBash(
    [
      `git -C ${shellQuote(isolatedWorktree)} fetch origin ${shellQuote(branch)} --prune`,
      `git -C ${shellQuote(isolatedWorktree)} checkout --detach ${shellQuote(`origin/${branch}`)}`,
      `git -C ${shellQuote(isolatedWorktree)} reset --hard ${shellQuote(`origin/${branch}`)}`,
      `git -C ${shellQuote(isolatedWorktree)} clean -fd`,
      `git -C ${shellQuote(isolatedWorktree)} rev-parse ${shellQuote(`origin/${branch}`)}`,
    ].join(' && '),
    { cwd: isolatedWorktree, quiet: true },
  );
  if (result.code !== 0) throw new Error(`failed to sync isolated worktree to origin/${branch}`);
  const lines = result.output.trim().split('\n').filter(Boolean);
  return lines.at(-1) ?? 'unknown';
}

async function preflight() {
  await assertReadable(envFile);
  await prepareIsolatedWorktree();
  const checks = [
    ['CODEX_CLOUD_ENV_ID', 'test -n "${CODEX_CLOUD_ENV_ID:-}"'],
    ['codex cloud exec', '${CODEX_CLOUD_CLI:-codex} cloud exec --help >/tmp/codex-cloud-exec-help 2>&1'],
    ['codex cloud status', '${CODEX_CLOUD_CLI:-codex} cloud status --help >/tmp/codex-cloud-status-help 2>&1'],
  ];

  for (const [name, command] of checks) {
    const result = await runBash(withEnvFile(command), { quiet: true });
    if (result.code !== 0) throw new Error(`preflight failed: ${name}`);
  }

  if (autoPublishDiff) {
    const result = await runBash('test -x .codex/cloud/publish-task-diff.sh && test -f .codex/cloud/reconcile-controller-pr.mjs', {
      quiet: true,
    });
    if (result.code !== 0) throw new Error('preflight failed: publish or reconcile artifacts missing');
  }
}

async function reconcileOpenControllerPr({ wait = false } = {}) {
  if (!autoPublishDiff) return { state: 'none' };
  const modeFlag = wait ? '--wait' : '--probe-only';
  const result = await runBash(withEnvFile(`node .codex/cloud/reconcile-controller-pr.mjs ${modeFlag}`));
  if (result.code !== 0) throw new Error(`reconcile controller pr failed with exit ${result.code}`);

  const state = extractField(result.output, 'open_controller_pr_state') ?? 'unknown';
  const prNumber = extractField(result.output, 'open_controller_pr_merged')
    ? extractField(result.output, 'open_controller_pr_merged')?.replace(/^#/, '')
    : extractField(result.output, 'open_controller_pr')?.replace(/^#/, '');
  const prUrl = extractField(result.output, 'url');
  const prBranch = extractField(result.output, 'branch');
  const mergedSha = extractField(result.output, 'sha');
  const failedChecks = extractField(result.output, 'open_controller_pr_failed_checks');
  const pendingChecks = extractField(result.output, 'open_controller_pr_pending_checks');
  const mergeError = extractField(result.output, 'open_controller_pr_merge_error');

  await writeRuntimeState({
    openControllerPrState: state,
    lastPrNumber: prNumber ?? null,
    lastPrUrl: prUrl ?? null,
    lastPrBranch: prBranch ?? null,
    lastMergedPrNumber: state === 'merged' ? prNumber ?? null : undefined,
    lastMergedSha: state === 'merged' ? mergedSha ?? null : undefined,
    lastMergedAt: state === 'merged' ? new Date().toISOString() : undefined,
    lastFailedChecks: failedChecks ?? null,
    lastPendingChecks: pendingChecks ?? null,
    lastMergeError: mergeError ?? null,
  });

  return {
    state,
    prNumber,
    prUrl,
    prBranch,
    mergedSha,
    failedChecks,
    pendingChecks,
    mergeError,
  };
}

async function publishTaskDiff(taskId) {
  if (!autoPublishDiff) {
    log(`publish=disabled task=${taskId}`);
    return;
  }

  log(`publishing task diff task=${taskId}`);
  const publish = await runBash(withEnvFile(`.codex/cloud/publish-task-diff.sh ${shellQuote(taskId)}`));
  if (publish.code !== 0) throw new Error(`publish failed with exit ${publish.code}`);
  await writeRuntimeState({
    lastTaskId: taskId,
    lastPublishedPrBranch: extractField(publish.output, 'pr_branch'),
    lastPublishedPrNumber: extractField(publish.output, 'pr_number'),
    lastPublishedPrUrl: extractField(publish.output, 'pr_url'),
  });
}

function extractTaskId(output) {
  return output.match(/task_[A-Za-z0-9_-]+/)?.[0] ?? null;
}

async function runCycle(reason) {
  log(`cycle started reason=${reason}`);
  await preflight();
  await writeRuntimeState({
    lastCycleReason: reason,
    lastCycleStartedAt: new Date().toISOString(),
    lastError: null,
  });

  try {
    const initialReconciliation = await reconcileOpenControllerPr({ wait: true });
    if (initialReconciliation.state !== 'none') {
      if (initialReconciliation.state === 'merged') {
        const mergedSha = await syncIsolatedWorktreeToMain();
        log(`cycle_finished_merged_pr=#${initialReconciliation.prNumber} sha=${mergedSha}`);
        await writeRuntimeState({
          openControllerPrState: 'merged',
          lastMergedPrNumber: initialReconciliation.prNumber ?? null,
          lastMergedSha: mergedSha,
          lastMergedAt: new Date().toISOString(),
        });
      } else {
        log(`cycle blocked open_controller_pr_state=${initialReconciliation.state}`);
      }
      return;
    }

    const submit = await runBash(withEnvFile('.codex/cloud/submit-controller-task.sh'));
    if (submit.code !== 0) throw new Error(`submit failed with exit ${submit.code}`);

    const taskId = extractTaskId(submit.output);
    if (!taskId) throw new Error('submit did not emit a task id');

    log(`watching task=${taskId}`);
    const watch = await runBash(withEnvFile(`.codex/cloud/watch-task.sh ${shellQuote(taskId)}`));
    if (watch.code !== 0) throw new Error(`watch failed with exit ${watch.code}`);
    await writeRuntimeState({
      lastTaskId: taskId,
      lastTaskCompletedAt: new Date().toISOString(),
    });

    await publishTaskDiff(taskId);
    const publishedReconciliation = await reconcileOpenControllerPr({ wait: true });
    if (publishedReconciliation.state === 'merged') {
      const mergedSha = await syncIsolatedWorktreeToMain();
      log(`cycle_finished_merged_pr=#${publishedReconciliation.prNumber} sha=${mergedSha}`);
      await writeRuntimeState({
        openControllerPrState: 'merged',
        lastMergedPrNumber: publishedReconciliation.prNumber ?? null,
        lastMergedSha: mergedSha,
        lastMergedAt: new Date().toISOString(),
      });
    } else {
      log(`cycle blocked open_controller_pr_state=${publishedReconciliation.state}`);
    }
    log(`cycle finished task=${taskId}`);
  } catch (error) {
    await writeRuntimeState({
      lastError: error.message,
      lastErrorAt: new Date().toISOString(),
    });
    throw error;
  } finally {
    await cleanIsolatedWorktree();
  }
}

async function main() {
  process.chdir(path.resolve(canonicalRepoRoot));

  if (mode === 'dry-run') {
    await preflight();
    await cleanIsolatedWorktree();
    await writeRuntimeState({
      lastDryRunAt: new Date().toISOString(),
      openControllerPrState: 'dry_run_ok',
    });
    log('dry-run ok');
    return;
  }

  if (mode === 'once') {
    await runCycle('manual');
    return;
  }

  await preflight();
  await cleanIsolatedWorktree();

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

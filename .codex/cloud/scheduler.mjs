#!/usr/bin/env node
import cron from 'node-cron';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  buildActionableSignature,
  loadControllerBacklog,
  resolveNextBacklogTarget,
} from './controller-backlog.mjs';
import { compareTargets, isStableBlockedTarget } from './controller-progress.mjs';

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

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function withEnvFile(command, extraEnv = {}) {
  const quotedEnvFile = shellQuote(envFile);
  const extraExports = Object.entries(extraEnv)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `export ${key}=${shellQuote(String(value))}`);

  return [
    'set -euo pipefail',
    'export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:${PATH:-}"',
    `set -a; . ${quotedEnvFile}; set +a`,
    'if [ -z "${CODEX_CLOUD_CLI:-}" ] && [ -x /opt/homebrew/bin/codex ]; then export CODEX_CLOUD_CLI=/opt/homebrew/bin/codex; fi',
    `export CODEX_CLOUD_PR_WATCH_INTERVAL=${shellQuote(String(prWatchInterval))}`,
    `export CODEX_CLOUD_PR_WATCH_MAX_POLLS=${shellQuote(String(prWatchMaxPolls))}`,
    ...extraExports,
    command,
  ].join('; ');
}

function extractField(output, key) {
  const regex = new RegExp(`${key}=([^\\s]+)`, 'g');
  const matches = [...output.matchAll(regex)];
  return matches.length > 0 ? matches.at(-1)[1] : null;
}

function mergeDefined(current, patch) {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
  }
  return next;
}

function controllerEnv(target) {
  if (!target || target.state !== 'actionable') return {};
  return {
    CODEX_CLOUD_TARGET_CYCLE: target.cycle,
    CODEX_CLOUD_TARGET_RESPONSIBILITY: target.responsibility,
    CODEX_CLOUD_TARGET_SIGNATURE: buildActionableSignature(target) ?? '',
  };
}

function cycleStateFromResolvedTarget(resolved) {
  if (!resolved) return null;
  if (resolved.state === 'complete') return 'complete';
  if (resolved.state === 'blocked') return 'blocked';
  return 'actionable';
}

async function runBash(command, options = {}) {
  return new Promise((resolve) => {
    const child = spawn('bash', ['-c', command], {
      cwd: options.cwd ?? executionRoot,
      env: {
        ...childEnv(),
        ...(options.env ?? {}),
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
  const next = mergeDefined(current, patch);
  next.updatedAt = new Date().toISOString();
  await mkdir(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  await writeFile(stateFile, `${JSON.stringify(next, null, 2)}\n`);
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
      'npm ci',
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

async function readOriginMainSha() {
  const branch = process.env.CODEX_CLOUD_BRANCH ?? 'main';
  const result = await runBash(`git -C ${shellQuote(isolatedWorktree)} rev-parse ${shellQuote(`origin/${branch}`)}`, {
    cwd: isolatedWorktree,
    quiet: true,
  });
  if (result.code !== 0) throw new Error(`failed to resolve origin/${branch} sha`);
  return result.output.trim().split('\n').filter(Boolean).at(-1) ?? 'unknown';
}

async function resolveCurrentBacklog() {
  const backlog = await loadControllerBacklog(executionRoot);
  const resolved = resolveNextBacklogTarget(backlog);
  return { backlog, resolved };
}

async function persistResolvedTarget(resolved, patch = {}) {
  const actionable = resolved?.state === 'actionable';
  await writeRuntimeState({
    backlogResolutionState: resolved?.state ?? null,
    backlogResolutionReason: resolved?.reason ?? null,
    backlogCompletedMandatoryCycles: resolved?.backlogMetrics?.completedMandatoryCycles ?? null,
    backlogTotalMandatoryCycles: resolved?.backlogMetrics?.totalMandatoryCycles ?? null,
    backlogRemainingMandatoryCycles: resolved?.backlogMetrics?.remainingMandatoryCycles ?? null,
    backlogNotApplicableCycles: resolved?.backlogMetrics?.notApplicableCycles ?? null,
    lastActionableResponsibility: actionable ? resolved.responsibility : null,
    lastActionableCycle: actionable ? resolved.cycle : null,
    lastActionableSignature: actionable ? buildActionableSignature(resolved) : null,
    ...patch,
  });
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
    const result = await runBash(
      'test -x .codex/cloud/publish-task-diff.sh && test -f .codex/cloud/reconcile-controller-pr.mjs && test -x .codex/cloud/build-controller-prompt.mjs',
      { quiet: true },
    );
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

async function publishTaskDiff(taskId, target) {
  if (!autoPublishDiff) {
    log(`publish=disabled task=${taskId}`);
    return { prState: 'disabled' };
  }

  log(`publishing task diff task=${taskId}`);
  const publish = await runBash(
    withEnvFile(`.codex/cloud/publish-task-diff.sh ${shellQuote(taskId)}`, controllerEnv(target)),
  );
  if (publish.code !== 0) throw new Error(`publish failed with exit ${publish.code}`);

  const prState = extractField(publish.output, 'pr_state') ?? 'unknown';
  const prBranch = extractField(publish.output, 'pr_branch');
  const prNumber = extractField(publish.output, 'pr_number');
  const prUrl = extractField(publish.output, 'pr_url');

  await writeRuntimeState({
    lastTaskId: taskId,
    lastPublishedPrState: prState,
    lastPublishedPrBranch: prBranch ?? null,
    lastPublishedPrNumber: prNumber ?? null,
    lastPublishedPrUrl: prUrl ?? null,
  });

  return {
    prState,
    prBranch,
    prNumber,
    prUrl,
  };
}

function extractTaskId(output) {
  return output.match(/task_[A-Za-z0-9_-]+/)?.[0] ?? null;
}

async function finalizeProgress({
  targetBefore,
  targetAfter,
  mainSha,
  openControllerPrState,
  cycleCompletedAt,
  mergedSha = null,
  mergedPrNumber = null,
}) {
  const comparison = compareTargets(targetBefore, targetAfter);
  const noProgress = targetBefore?.state === 'actionable' && comparison.unchanged;
  const blockedPr = ['failed', 'timeout'].includes(openControllerPrState);
  const finalState =
    targetAfter?.state === 'complete'
      ? 'complete'
      : mergedSha
        ? 'merged'
        : blockedPr || noProgress || targetAfter?.state === 'blocked'
          ? 'blocked'
          : comparison.progressed
            ? 'progressed'
            : 'blocked';

  const actionableSignature =
    targetBefore?.state === 'actionable' ? buildActionableSignature(targetBefore) : null;

  await persistResolvedTarget(targetAfter, {
    openControllerPrState,
    lastCycleCompletedAt: cycleCompletedAt,
    lastCycleState: finalState,
    lastMergedPrNumber: mergedPrNumber ?? undefined,
    lastMergedSha: mergedSha ?? undefined,
    lastMergedAt: mergedSha ? cycleCompletedAt : undefined,
    lastNoProgressResponsibility: noProgress ? targetBefore.responsibility : null,
    lastNoProgressCycle: noProgress ? targetBefore.cycle : null,
    lastNoProgressSignature: noProgress ? actionableSignature : null,
    lastNoProgressMainSha: noProgress ? mainSha : null,
    lastError:
      blockedPr
        ? `open_controller_pr_state=${openControllerPrState}`
        : targetAfter?.state === 'blocked'
          ? targetAfter.reason ?? 'controller_backlog_blocked'
          : noProgress && targetBefore?.state === 'actionable'
            ? `target_unchanged=${targetBefore.responsibility}/${targetBefore.cycle}`
            : null,
    lastErrorAt:
      blockedPr || targetAfter?.state === 'blocked' || noProgress
        ? cycleCompletedAt
        : null,
  });

  return { comparison, noProgress, finalState };
}

async function runCycle(reason, scheduledSlotAt = new Date().toISOString()) {
  const previousRuntimeState = await loadRuntimeState();
  const cycleStartedAt = new Date().toISOString();
  log(`cycle started reason=${reason}`);
  await preflight();
  await writeRuntimeState({
    lastCycleReason: reason,
    lastScheduledSlotAt: scheduledSlotAt,
    lastCycleStartedAt: cycleStartedAt,
    lastCycleState: 'running',
    lastError: null,
    lastErrorAt: null,
  });

  try {
    const initialReconciliation = await reconcileOpenControllerPr({ wait: true });
    if (initialReconciliation.state === 'merged') {
      const mergedSha = await syncIsolatedWorktreeToMain();
      const { resolved: resolvedAfterMerge } = await resolveCurrentBacklog();
      await persistResolvedTarget(resolvedAfterMerge, {
        openControllerPrState: 'merged',
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: resolvedAfterMerge.state === 'complete' ? 'complete' : 'merged',
        lastMergedPrNumber: initialReconciliation.prNumber ?? null,
        lastMergedSha: mergedSha,
        lastMergedAt: new Date().toISOString(),
        lastError: null,
        lastErrorAt: null,
        lastNoProgressResponsibility: null,
        lastNoProgressCycle: null,
        lastNoProgressSignature: null,
        lastNoProgressMainSha: null,
      });
      log(`cycle_finished_merged_pr=#${initialReconciliation.prNumber} sha=${mergedSha}`);
      return;
    }

    if (initialReconciliation.state !== 'none') {
      await writeRuntimeState({
        openControllerPrState: initialReconciliation.state,
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: 'blocked',
        lastError: `open_controller_pr_state=${initialReconciliation.state}`,
        lastErrorAt: new Date().toISOString(),
      });
      log(`cycle blocked open_controller_pr_state=${initialReconciliation.state}`);
      return;
    }

    const mainSha = await readOriginMainSha();
    const { resolved: targetBefore } = await resolveCurrentBacklog();
    await persistResolvedTarget(targetBefore, {
      lastCycleState: cycleStateFromResolvedTarget(targetBefore),
    });

    if (targetBefore.state === 'complete') {
      await persistResolvedTarget(targetBefore, {
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: 'complete',
        openControllerPrState: 'none',
        lastError: null,
        lastErrorAt: null,
      });
      log('controller_backlog=complete');
      return;
    }

    if (targetBefore.state === 'blocked') {
      await persistResolvedTarget(targetBefore, {
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: 'blocked',
        openControllerPrState: 'none',
        lastError: targetBefore.reason ?? 'controller_backlog_blocked',
        lastErrorAt: new Date().toISOString(),
      });
      log(`controller_backlog=blocked reason=${targetBefore.reason ?? 'unknown'}`);
      return;
    }

    if (isStableBlockedTarget(targetBefore, previousRuntimeState, mainSha)) {
      await persistResolvedTarget(targetBefore, {
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: 'blocked',
        openControllerPrState: 'none',
        lastError: `stable_blocker=${targetBefore.responsibility}/${targetBefore.cycle}`,
        lastErrorAt: new Date().toISOString(),
      });
      log(`stable_blocker target=${targetBefore.responsibility}/${targetBefore.cycle}`);
      return;
    }

    const submit = await runBash(
      withEnvFile('.codex/cloud/submit-controller-task.sh', controllerEnv(targetBefore)),
    );
    if (submit.code !== 0) throw new Error(`submit failed with exit ${submit.code}`);

    const taskId = extractTaskId(submit.output);
    if (!taskId) throw new Error('submit did not emit a task id');

    await writeRuntimeState({
      lastTaskId: taskId,
      lastSubmittedTargetResponsibility: targetBefore.responsibility,
      lastSubmittedTargetCycle: targetBefore.cycle,
    });

    log(`watching task=${taskId}`);
    const watch = await runBash(withEnvFile(`.codex/cloud/watch-task.sh ${shellQuote(taskId)}`));
    if (watch.code !== 0) throw new Error(`watch failed with exit ${watch.code}`);
    await writeRuntimeState({
      lastTaskId: taskId,
      lastTaskCompletedAt: new Date().toISOString(),
    });

    await publishTaskDiff(taskId, targetBefore);
    const publishedReconciliation = await reconcileOpenControllerPr({ wait: true });

    if (publishedReconciliation.state === 'merged') {
      const mergedSha = await syncIsolatedWorktreeToMain();
      const { resolved: targetAfterMerge } = await resolveCurrentBacklog();
      await finalizeProgress({
        targetBefore,
        targetAfter: targetAfterMerge,
        mainSha,
        openControllerPrState: 'merged',
        cycleCompletedAt: new Date().toISOString(),
        mergedSha,
        mergedPrNumber: publishedReconciliation.prNumber ?? null,
      });
      log(`cycle_finished_merged_pr=#${publishedReconciliation.prNumber} sha=${mergedSha}`);
      return;
    }

    const { resolved: targetAfter } = await resolveCurrentBacklog();
    const finalized = await finalizeProgress({
      targetBefore,
      targetAfter,
      mainSha,
      openControllerPrState: publishedReconciliation.state,
      cycleCompletedAt: new Date().toISOString(),
    });

    log(
      `cycle finished state=${finalized.finalState} target_before=${targetBefore.responsibility}/${targetBefore.cycle} target_after=${
        targetAfter.state === 'actionable' ? `${targetAfter.responsibility}/${targetAfter.cycle}` : targetAfter.state
      }`,
    );
  } catch (error) {
    await writeRuntimeState({
      lastError: error.message,
      lastErrorAt: new Date().toISOString(),
      lastCycleCompletedAt: new Date().toISOString(),
      lastCycleState: 'failed',
    });
    throw error;
  } finally {
    try {
      await cleanIsolatedWorktree();
    } catch (cleanupError) {
      reportScheduledFailure(cleanupError.message);
    }
  }
}

async function updateSchedulerHeartbeat(task = null, patch = {}) {
  await writeRuntimeState({
    schedulerStartedAt: patch.schedulerStartedAt ?? undefined,
    nextScheduledRunAt: task?.getNextRun?.()?.toISOString?.() ?? patch.nextScheduledRunAt ?? null,
    ...patch,
  });
}

async function main() {
  process.chdir(path.resolve(canonicalRepoRoot));

  if (mode === 'dry-run') {
    await preflight();
    await cleanIsolatedWorktree();
    await writeRuntimeState({
      lastDryRunAt: new Date().toISOString(),
    });
    log('dry-run ok');
    return;
  }

  if (mode === 'once') {
    await runCycle('manual', new Date().toISOString());
    return;
  }

  await preflight();
  await cleanIsolatedWorktree();

  const schedulerStartedAt = new Date().toISOString();
  const task = cron.schedule(
    schedule,
    async () => {
      try {
        await updateSchedulerHeartbeat(task, {
          lastScheduledSlotAt: new Date().toISOString(),
        });
        await runCycle('scheduled', new Date().toISOString());
      } catch (error) {
        reportScheduledFailure(error.message);
      } finally {
        await updateSchedulerHeartbeat(task);
      }
    },
    {
      name: 'Aneety Codex Cloud controller',
      timezone,
      noOverlap: true,
    },
  );

  await updateSchedulerHeartbeat(task, { schedulerStartedAt });
  log(`started schedule=${schedule} timezone=${timezone} next=${task.getNextRun()?.toISOString()}`);
}

main().catch((error) => fail(error.message));

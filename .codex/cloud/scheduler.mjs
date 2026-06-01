#!/usr/bin/env node
import cron from 'node-cron';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
  buildActionableSignature,
  loadControllerBacklog,
  resolveNextBacklogTarget,
} from './controller-backlog.mjs';
import { compareTargets, isStableBlockedTarget } from './controller-progress.mjs';
import { runControllerHealthCheck } from './health-check.mjs';
import {
  executeGatewayBordaPublicationRemoteGate,
  getRemoteAutomationRunbook,
  mapMissingServicesToDependencies,
  REMOTE_GATE_STATE,
} from './remote-gate.mjs';

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
  next.lastMutationSurface ??= 'scheduler';
  return next;
}

function controllerEnv(target) {
  if (!target || target.state !== 'actionable') return {};
  const env = {
    CODEX_CLOUD_TARGET_CYCLE: target.cycle,
    CODEX_CLOUD_TARGET_RESPONSIBILITY: target.responsibility,
    CODEX_CLOUD_TARGET_SIGNATURE: buildActionableSignature(target) ?? '',
  };
  if (target.dependencyParentResponsibility && target.dependencyParentCycle) {
    env.CODEX_CLOUD_TARGET_PARENT_RESPONSIBILITY = target.dependencyParentResponsibility;
    env.CODEX_CLOUD_TARGET_PARENT_CYCLE = target.dependencyParentCycle;
  }
  return env;
}

function cycleStateFromResolvedTarget(resolved) {
  if (!resolved) return null;
  if (resolved.state === 'complete') return 'complete';
  if (resolved.state === 'blocked') return resolved.blockKind === 'pause' ? 'paused' : 'blocked';
  return 'actionable';
}

export function describeResolvedTargetState(resolved) {
  if (!resolved) {
    return {
      cycleState: null,
      functionalState: null,
      pauseStatus: null,
      pauseReason: null,
      error: null,
    };
  }

  if (resolved.state === 'complete') {
    return {
      cycleState: 'complete',
      functionalState: 'ready',
      pauseStatus: null,
      pauseReason: null,
      error: null,
    };
  }

  if (resolved.state === 'blocked') {
    if (resolved.blockKind === 'pause') {
      return {
        cycleState: 'paused',
        functionalState: 'paused',
        pauseStatus: resolved.pauseStatus ?? null,
        pauseReason: resolved.pauseReason ?? resolved.reason ?? null,
        error: null,
      };
    }

    return {
      cycleState: 'blocked',
      functionalState: 'degraded',
      pauseStatus: resolved.pauseStatus ?? null,
      pauseReason: resolved.pauseReason ?? resolved.reason ?? null,
      error: resolved.reason ?? 'controller_backlog_blocked',
    };
  }

  return {
    cycleState: 'actionable',
    functionalState: 'ready',
    pauseStatus: null,
    pauseReason: null,
    error: null,
  };
}

export function shouldSubmitControllerTask({
  resolvedTarget,
  healthState = 'ready',
  openControllerPrState = 'none',
} = {}) {
  if (healthState !== 'ready') return false;
  if (openControllerPrState !== 'none') return false;
  return resolvedTarget?.state === 'actionable';
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
  const resolvedState = describeResolvedTargetState(resolved);
  const dependencyParentResponsibility = resolved?.dependencyParentResponsibility ?? null;
  const dependencyParentCycle = resolved?.dependencyParentCycle ?? null;
  const dependencyReason = resolved?.dependencyReason ?? null;
  const dependencySource = resolved?.dependencySource ?? null;
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
    lastPauseStatus: resolvedState.pauseStatus,
    lastPauseReason: resolvedState.pauseReason,
    lastPauseResponsibility: resolved?.state === 'blocked' ? resolved.responsibility ?? null : null,
    lastPauseCycle: resolved?.state === 'blocked' ? resolved.cycle ?? null : null,
    lastDependencyParentResponsibility: dependencyParentResponsibility,
    lastDependencyParentCycle: dependencyParentCycle,
    lastDependencyTargetResponsibility: actionable && dependencyParentResponsibility ? resolved.responsibility : null,
    lastDependencyTargetCycle: actionable && dependencyParentResponsibility ? resolved.cycle : null,
    lastDependencyReason: dependencyReason,
    lastDependencySource: dependencySource,
    lastDependencyState:
      actionable && dependencyParentResponsibility
        ? 'ready_for_dependency_cycle'
        : resolved?.state === 'blocked' && dependencyParentResponsibility
          ? 'waiting_on_dependency_blocker'
          : null,
    ...patch,
  });
}

async function preflight() {
  await assertReadable(envFile);
  await prepareIsolatedWorktree();
  const checks = [
    ['CODEX_CLOUD_ENV_ID', 'test -n "${CODEX_CLOUD_ENV_ID:-}"'],
    ['codex cloud exec', '${CODEX_CLOUD_CLI:-codex} cloud exec --help >/tmp/codex-cloud-exec-help 2>&1'],
    ['codex cloud diff', '${CODEX_CLOUD_CLI:-codex} cloud diff --help >/tmp/codex-cloud-diff-help 2>&1'],
    ['codex cloud list', '${CODEX_CLOUD_CLI:-codex} cloud list --help >/tmp/codex-cloud-list-help 2>&1'],
  ];

  for (const [name, command] of checks) {
    const result = await runBash(withEnvFile(command), { quiet: true });
    if (result.code !== 0) throw new Error(`preflight failed: ${name}`);
  }

  if (autoPublishDiff) {
    const result = await runBash(
      'test -x .codex/cloud/publish-task-diff.sh && test -x .codex/cloud/publish-operational-update.sh && test -f .codex/cloud/reconcile-controller-pr.mjs && test -x .codex/cloud/build-controller-prompt.mjs',
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
    lastFunctionalState: ['failed', 'timeout'].includes(state) ? 'degraded' : undefined,
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

async function evaluateHealth() {
  return runControllerHealthCheck({
    repoRoot: executionRoot,
    envFile,
    isolatedWorktree,
    repo: process.env.CODEX_CLOUD_GITHUB_REPO ?? 'Aneety/ai',
  });
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

function isDependencyTarget(target) {
  return Boolean(target?.dependencyParentResponsibility && target?.dependencyParentCycle);
}

async function executeActionableTarget({ targetBefore, mainSha }) {
  await persistResolvedTarget(targetBefore, {
    lastCycleState: cycleStateFromResolvedTarget(targetBefore),
    lastFunctionalState: describeResolvedTargetState(targetBefore).functionalState ?? 'ready',
    healthState: 'ready',
    lastDependencyState: isDependencyTarget(targetBefore) ? 'task_submitted' : null,
  });

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
    lastDependencyState: isDependencyTarget(targetBefore) ? 'watching_task' : undefined,
  });

  log(`watching task=${taskId}`);
  const watch = await runBash(withEnvFile(`.codex/cloud/watch-task.sh ${shellQuote(taskId)}`));
  if (watch.code !== 0) throw new Error(`watch failed with exit ${watch.code}`);
  await writeRuntimeState({
    lastTaskId: taskId,
    lastTaskCompletedAt: new Date().toISOString(),
    lastDependencyState: isDependencyTarget(targetBefore) ? 'publishing_diff' : undefined,
  });

  await publishTaskDiff(taskId, targetBefore);
  await writeRuntimeState({
    lastDependencyState: isDependencyTarget(targetBefore) ? 'awaiting_pr_merge' : undefined,
  });
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
}

async function recordRemoteActionState(patch = {}) {
  await writeRuntimeState({
    lastRemoteAction: patch.lastRemoteAction ?? undefined,
    lastRemoteActionState: patch.lastRemoteActionState ?? undefined,
    lastRemoteDeployRunId: patch.lastRemoteDeployRunId ?? undefined,
    lastRemoteDeployUrl: patch.lastRemoteDeployUrl ?? undefined,
    lastPublishedUrl: patch.lastPublishedUrl ?? undefined,
    lastRemoteSmokeRunId: patch.lastRemoteSmokeRunId ?? undefined,
    lastRemoteSmokeUrl: patch.lastRemoteSmokeUrl ?? undefined,
    lastRemoteConclusion: patch.lastRemoteConclusion ?? undefined,
    lastRemoteActionAt: patch.lastRemoteActionAt ?? undefined,
  });
}

async function publishOperationalUpdate(target, remoteResult) {
  const bodyFile = path.join(
    process.env.TMPDIR ?? os.tmpdir(),
    `aneety-operational-pr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.md`,
  );
  const summary = [
    '## Summary',
    '',
    `- Records remote publication evidence for \`${target.responsibility}/${target.cycle}\`.`,
    `- Published URL: \`${remoteResult.evidence.publishedUrl}\`.`,
    `- Deploy run: ${remoteResult.deployRun.runUrl}.`,
    `- Smoke run: ${remoteResult.smokeRun.runUrl}.`,
    '',
    '## Validation',
    '',
    `- Publication evidence validated locally from \`${remoteResult.runbook.evidenceFile}\`.`,
    `- Source SHA: \`${remoteResult.evidence.headSha}\`.`,
    '- Merge: not performed in this step.',
    '',
  ].join('\n');
  await writeFile(bodyFile, summary);

  try {
    const publish = await runBash(
      withEnvFile(
        `.codex/cloud/publish-operational-update.sh`,
        {
          ...controllerEnv({
            state: 'actionable',
            responsibility: target.responsibility,
            cycle: target.cycle,
            cycleRow: { status: 'pronto', gate: 'processo' },
          }),
          CODEX_CLOUD_OPERATIONAL_PR_TITLE: remoteResult.runbook.commitTitle,
          CODEX_CLOUD_OPERATIONAL_PR_BODY_FILE: bodyFile,
        },
      ),
    );
    if (publish.code !== 0) throw new Error(`operational publish failed with exit ${publish.code}`);

    const prState = extractField(publish.output, 'pr_state') ?? 'unknown';
    const prBranch = extractField(publish.output, 'pr_branch');
    const prNumber = extractField(publish.output, 'pr_number');
    const prUrl = extractField(publish.output, 'pr_url');

    await writeRuntimeState({
      lastPrNumber: prNumber ?? null,
      lastPrUrl: prUrl ?? null,
      lastPrBranch: prBranch ?? null,
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
  } finally {
    await rm(bodyFile, { force: true });
  }
}

async function executeRemoteGateForTarget(target, mainSha) {
  const runbook = getRemoteAutomationRunbook(target);
  if (!runbook) {
    return { ok: false, state: 'unsupported', blocker: 'remote_gate_unsupported' };
  }

  const onStateChange = async (state) => {
    await recordRemoteActionState({
      lastRemoteAction: `${target.responsibility}/${target.cycle}`,
      lastRemoteActionState: state.state,
      lastRemoteDeployRunId: state.deployRunId ?? undefined,
      lastRemoteDeployUrl: state.deployRunUrl ?? undefined,
      lastPublishedUrl: state.publishedUrl ?? undefined,
      lastRemoteSmokeRunId: state.smokeRunId ?? undefined,
      lastRemoteSmokeUrl: state.smokeRunUrl ?? undefined,
      lastRemoteConclusion: state.state,
      lastRemoteActionAt: new Date().toISOString(),
    });
  };

  const result = await executeGatewayBordaPublicationRemoteGate({
    repoRoot: executionRoot,
    mainSha,
    run: runBash,
    onStateChange,
    repo: process.env.CODEX_CLOUD_GITHUB_REPO ?? 'Aneety/ai',
  });

  if (!result.ok) {
    await recordRemoteActionState({
      lastRemoteAction: `${target.responsibility}/${target.cycle}`,
      lastRemoteActionState: REMOTE_GATE_STATE.FAILED,
      lastRemoteDeployRunId: result.deployRun?.runId ?? null,
      lastRemoteDeployUrl: result.deployRun?.runUrl ?? null,
      lastPublishedUrl: result.deployRun?.result?.publishedUrl ?? null,
      lastRemoteSmokeRunId: result.smokeRun?.runId ?? null,
      lastRemoteSmokeUrl: result.smokeRun?.runUrl ?? null,
      lastRemoteConclusion:
        result.smokeRun?.result?.conclusion ??
        result.deployRun?.result?.conclusion ??
        result.state ??
        'failed',
      lastRemoteActionAt: new Date().toISOString(),
    });
    return result;
  }

  await recordRemoteActionState({
    lastRemoteAction: `${target.responsibility}/${target.cycle}`,
    lastRemoteActionState: REMOTE_GATE_STATE.SUCCEEDED,
    lastRemoteDeployRunId: result.deployRun.runId,
    lastRemoteDeployUrl: result.deployRun.runUrl,
    lastPublishedUrl: result.evidence.publishedUrl,
    lastRemoteSmokeRunId: result.smokeRun.runId,
    lastRemoteSmokeUrl: result.smokeRun.runUrl,
    lastRemoteConclusion: 'success',
    lastRemoteActionAt: new Date().toISOString(),
  });

  return result;
}

function extractTaskId(output) {
  return output.match(/task_[A-Za-z0-9_-]+/)?.[0] ?? null;
}

export function determineFinalCycleState({
  targetBefore,
  targetAfter,
  openControllerPrState,
  mergedSha = null,
}) {
  const comparison = compareTargets(targetBefore, targetAfter);
  const noProgress = targetBefore?.state === 'actionable' && comparison.unchanged;
  const blockedPr = ['failed', 'timeout'].includes(openControllerPrState);
  const resolvedState = describeResolvedTargetState(targetAfter);

  let finalState = 'blocked';
  let functionalState = resolvedState.functionalState ?? 'degraded';
  let lastError = resolvedState.error;

  if (targetAfter?.state === 'complete') {
    finalState = 'complete';
    functionalState = 'ready';
    lastError = null;
  } else if (blockedPr) {
    finalState = 'blocked';
    functionalState = 'degraded';
    lastError = `open_controller_pr_state=${openControllerPrState}`;
  } else if (resolvedState.cycleState === 'paused') {
    finalState = 'paused';
    functionalState = 'paused';
    lastError = null;
  } else if (resolvedState.cycleState === 'blocked') {
    finalState = 'blocked';
    functionalState = 'degraded';
    lastError = resolvedState.error;
  } else if (mergedSha && comparison.progressed) {
    finalState = 'merged';
    functionalState = 'ready';
    lastError = null;
  } else if (comparison.progressed) {
    finalState = 'progressed';
    functionalState = 'ready';
    lastError = null;
  } else if (noProgress) {
    finalState = 'blocked';
    functionalState = 'degraded';
    lastError =
      targetBefore?.state === 'actionable'
        ? `target_unchanged=${targetBefore.responsibility}/${targetBefore.cycle}`
        : resolvedState.error;
  }

  return {
    comparison,
    noProgress,
    blockedPr,
    resolvedState,
    finalState,
    functionalState,
    lastError,
  };
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
  const { comparison, noProgress, resolvedState, finalState, functionalState, lastError } =
    determineFinalCycleState({
      targetBefore,
      targetAfter,
      openControllerPrState,
      mergedSha,
    });

  const actionableSignature =
    targetBefore?.state === 'actionable' ? buildActionableSignature(targetBefore) : null;

  await persistResolvedTarget(targetAfter, {
    openControllerPrState,
    lastCycleCompletedAt: cycleCompletedAt,
    lastCycleState: finalState,
    lastFunctionalState: functionalState,
    healthState: 'ready',
    lastMergedPrNumber: mergedPrNumber ?? undefined,
    lastMergedSha: mergedSha ?? undefined,
    lastMergedAt: mergedSha ? cycleCompletedAt : undefined,
    lastNoProgressResponsibility: noProgress ? targetBefore.responsibility : null,
    lastNoProgressCycle: noProgress ? targetBefore.cycle : null,
    lastNoProgressSignature: noProgress ? actionableSignature : null,
    lastNoProgressMainSha: noProgress ? mainSha : null,
    lastPauseStatus: resolvedState.pauseStatus,
    lastPauseReason: resolvedState.pauseReason,
    lastError,
    lastErrorAt: lastError ? cycleCompletedAt : null,
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
    lastFunctionalState: 'ready',
    healthState: 'ready',
    lastPauseStatus: null,
    lastPauseReason: null,
    lastPauseResponsibility: null,
    lastPauseCycle: null,
    lastError: null,
    lastErrorAt: null,
  });

  try {
    const initialReconciliation = await reconcileOpenControllerPr({ wait: true });
    if (initialReconciliation.state === 'merged') {
      const mergedSha = await syncIsolatedWorktreeToMain();
      const { resolved: resolvedAfterMerge } = await resolveCurrentBacklog();
      const resolvedState = describeResolvedTargetState(resolvedAfterMerge);
      await persistResolvedTarget(resolvedAfterMerge, {
        openControllerPrState: 'merged',
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState:
          resolvedState.cycleState === 'paused'
            ? 'paused'
            : resolvedAfterMerge.state === 'complete'
              ? 'complete'
              : 'merged',
        lastFunctionalState: resolvedState.functionalState ?? 'ready',
        healthState: 'ready',
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
      const failedPr = ['failed', 'timeout'].includes(initialReconciliation.state);
      await writeRuntimeState({
        openControllerPrState: initialReconciliation.state,
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: failedPr ? 'blocked' : 'running',
        lastFunctionalState: failedPr ? 'degraded' : 'ready',
        healthState: 'ready',
        lastError: failedPr ? `open_controller_pr_state=${initialReconciliation.state}` : null,
        lastErrorAt: failedPr ? new Date().toISOString() : null,
      });
      log(`cycle blocked open_controller_pr_state=${initialReconciliation.state}`);
      return;
    }

    const health = await evaluateHealth();
    await writeRuntimeState({
      healthState: health.status,
      lastHealthEvaluatedAt: new Date().toISOString(),
      lastHealthErrors: health.errors.length > 0 ? health.errors.join(',') : null,
      lastHealthEvaluatedRefSource: health.evaluatedRefSource ?? null,
      lastHealthEvaluatedSha: health.evaluatedSha ?? null,
    });

    if (health.status !== 'ready') {
      const degradedAt = new Date().toISOString();
      await writeRuntimeState({
        lastCycleCompletedAt: degradedAt,
        lastCycleState: 'degraded',
        lastFunctionalState: 'degraded',
        healthState: 'degraded',
        openControllerPrState: 'none',
        lastPauseStatus: null,
        lastPauseReason: null,
        lastPauseResponsibility: null,
        lastPauseCycle: null,
        lastError: health.errors.join(',') || 'health_state=degraded',
        lastErrorAt: degradedAt,
      });
      log(`cycle degraded health_state=${health.status} errors=${health.errors.join(',') || 'unknown'}`);
      return;
    }

    const mainSha = await readOriginMainSha();
    const { resolved: targetBefore } = await resolveCurrentBacklog();
    await persistResolvedTarget(targetBefore, {
      lastCycleState: cycleStateFromResolvedTarget(targetBefore),
      lastFunctionalState: describeResolvedTargetState(targetBefore).functionalState ?? 'ready',
      healthState: 'ready',
    });

    if (targetBefore.state === 'complete') {
      await persistResolvedTarget(targetBefore, {
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: 'complete',
        lastFunctionalState: 'ready',
        healthState: 'ready',
        openControllerPrState: 'none',
        lastError: null,
        lastErrorAt: null,
      });
      log('controller_backlog=complete');
      return;
    }

    const remoteRunbook = getRemoteAutomationRunbook(targetBefore);
    if (targetBefore.state === 'blocked' && targetBefore.blockKind === 'pause' && remoteRunbook) {
      const remoteResult = await executeRemoteGateForTarget(targetBefore, mainSha);
      if (!remoteResult.ok) {
        const fallbackDependencies =
          remoteResult.dependencyTargets ??
          mapMissingServicesToDependencies(remoteResult.deployRun?.result?.missingServices).mapped;
        if (fallbackDependencies.length > 0) {
          const { resolved: dependencyTarget } = await resolveCurrentBacklog();
          if (dependencyTarget.state === 'actionable' && isDependencyTarget(dependencyTarget)) {
            await writeRuntimeState({
              lastDependencyParentResponsibility: dependencyTarget.dependencyParentResponsibility,
              lastDependencyParentCycle: dependencyTarget.dependencyParentCycle,
              lastDependencyTargetResponsibility: dependencyTarget.responsibility,
              lastDependencyTargetCycle: dependencyTarget.cycle,
              lastDependencyReason:
                dependencyTarget.dependencyReason ??
                remoteResult.failureReason ??
                remoteResult.blocker ??
                'remote_missing_service_dependency',
              lastDependencySource: dependencyTarget.dependencySource ?? 'planning_matrix',
              lastDependencyState: 'fallback_remote_missing_service',
              lastCycleCompletedAt: new Date().toISOString(),
              lastCycleState: 'dependency_preempted',
              lastFunctionalState: 'ready',
              healthState: 'ready',
              openControllerPrState: 'none',
              lastError: null,
              lastErrorAt: null,
            });
            log(
              `remote_gate_dependency_preempted parent=${targetBefore.responsibility}/${targetBefore.cycle} target=${dependencyTarget.responsibility}/${dependencyTarget.cycle}`,
            );
            await executeActionableTarget({ targetBefore: dependencyTarget, mainSha });
            return;
          }
        }

        const blockedAt = new Date().toISOString();
        await persistResolvedTarget(targetBefore, {
          lastCycleCompletedAt: blockedAt,
          lastCycleState: 'paused',
          lastFunctionalState: 'paused',
          healthState: 'ready',
          openControllerPrState: 'none',
          lastError: remoteResult.blocker ?? 'remote_gate_failed',
          lastErrorAt: blockedAt,
        });
        log(`remote_gate_failed target=${targetBefore.responsibility}/${targetBefore.cycle} blocker=${remoteResult.blocker ?? 'unknown'}`);
        return;
      }

      const operationalPublish = await publishOperationalUpdate(targetBefore, remoteResult);
      if (!['created', 'existing'].includes(operationalPublish.prState)) {
        throw new Error(`operational publish returned state ${operationalPublish.prState}`);
      }

      const remoteReconciliation = await reconcileOpenControllerPr({ wait: true });
      if (remoteReconciliation.state === 'merged') {
        const mergedSha = await syncIsolatedWorktreeToMain();
        const { resolved: targetAfterMerge } = await resolveCurrentBacklog();
        await finalizeProgress({
          targetBefore,
          targetAfter: targetAfterMerge,
          mainSha,
          openControllerPrState: 'merged',
          cycleCompletedAt: new Date().toISOString(),
          mergedSha,
          mergedPrNumber: remoteReconciliation.prNumber ?? null,
        });
        log(`cycle_finished_remote_gate_pr=#${remoteReconciliation.prNumber} sha=${mergedSha}`);
        return;
      }

      const { resolved: targetAfterRemote } = await resolveCurrentBacklog();
      const finalizedRemote = await finalizeProgress({
        targetBefore,
        targetAfter: targetAfterRemote,
        mainSha,
        openControllerPrState: remoteReconciliation.state,
        cycleCompletedAt: new Date().toISOString(),
      });
      log(
        `cycle finished state=${finalizedRemote.finalState} remote_gate_target=${targetBefore.responsibility}/${targetBefore.cycle} target_after=${
          targetAfterRemote.state === 'actionable'
            ? `${targetAfterRemote.responsibility}/${targetAfterRemote.cycle}`
            : targetAfterRemote.state
        }`,
      );
      return;
    }

    if (targetBefore.state === 'blocked') {
      const blockedState = describeResolvedTargetState(targetBefore);
      await persistResolvedTarget(targetBefore, {
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: blockedState.cycleState ?? 'blocked',
        lastFunctionalState: blockedState.functionalState ?? 'degraded',
        healthState: 'ready',
        openControllerPrState: 'none',
        lastError: blockedState.error,
        lastErrorAt: blockedState.error ? new Date().toISOString() : null,
      });
      log(
        `controller_backlog=${blockedState.cycleState ?? 'blocked'} reason=${targetBefore.reason ?? 'unknown'}${
          blockedState.pauseStatus ? ` pause_status=${blockedState.pauseStatus}` : ''
        }`,
      );
      return;
    }

    if (isStableBlockedTarget(targetBefore, previousRuntimeState, mainSha)) {
      await persistResolvedTarget(targetBefore, {
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: 'blocked',
        lastFunctionalState: 'degraded',
        healthState: 'ready',
        openControllerPrState: 'none',
        lastError: `stable_blocker=${targetBefore.responsibility}/${targetBefore.cycle}`,
        lastErrorAt: new Date().toISOString(),
      });
      log(`stable_blocker target=${targetBefore.responsibility}/${targetBefore.cycle}`);
      return;
    }

    if (!shouldSubmitControllerTask({ resolvedTarget: targetBefore, healthState: health.status })) {
      await persistResolvedTarget(targetBefore, {
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: 'blocked',
        lastFunctionalState: health.status === 'ready' ? 'ready' : 'degraded',
        healthState: health.status,
        openControllerPrState: 'none',
        lastError: health.status === 'ready' ? null : 'health_state=degraded',
        lastErrorAt: health.status === 'ready' ? null : new Date().toISOString(),
      });
      log('submission_skipped');
      return;
    }
    await executeActionableTarget({ targetBefore, mainSha });
  } catch (error) {
    await writeRuntimeState({
      lastError: error.message,
      lastErrorAt: new Date().toISOString(),
      lastCycleCompletedAt: new Date().toISOString(),
      lastCycleState: 'failed',
      lastFunctionalState: 'degraded',
      healthState: 'degraded',
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
    const health = await evaluateHealth();
    await cleanIsolatedWorktree();
    await writeRuntimeState({
      lastDryRunAt: new Date().toISOString(),
      lastDryRunHealthState: health.status,
      lastHealthEvaluatedAt: new Date().toISOString(),
      lastHealthErrors: health.errors.length > 0 ? health.errors.join(',') : null,
      lastHealthEvaluatedRefSource: health.evaluatedRefSource ?? null,
      lastHealthEvaluatedSha: health.evaluatedSha ?? null,
    });
    if (health.status !== 'ready') {
      throw new Error(`health_state=${health.status} errors=${health.errors.join(',') || 'unknown'}`);
    }
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => fail(error.message));
}

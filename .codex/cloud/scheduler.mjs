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
  resolveParallelBacklogTargets,
  resolveNextBacklogTarget,
  resolveResponsibilityTarget,
} from './controller-backlog.mjs';
import { compareTargets, isStableBlockedTarget } from './controller-progress.mjs';
import { runControllerHealthCheck } from './health-check.mjs';
import {
  executeWorkerDeployRemoteGate,
  executeWorkerPublicationRemoteGate,
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
const parallelLimit = positiveInteger(process.env.CODEX_CLOUD_MAX_PARALLEL_TASKS, 4);
const prWatchInterval = positiveInteger(process.env.CODEX_CLOUD_PR_WATCH_INTERVAL, 30);
const prWatchMaxPolls = positiveInteger(process.env.CODEX_CLOUD_PR_WATCH_MAX_POLLS, 60);
const mode = process.argv.includes('--once')
  ? 'once'
  : process.argv.includes('--dry-run')
    ? 'dry-run'
    : 'schedule';
const schedulerLockDir =
  process.env.CODEX_CLOUD_SCHEDULER_LOCK_DIR ??
  path.join(path.dirname(stateFile), 'scheduler-cycle.lock');
const schedulerLockOwnerFile = path.join(schedulerLockDir, 'owner.json');
const lockWaitMs = positiveInteger(
  process.env.CODEX_CLOUD_LOCK_WAIT_MS,
  mode === 'schedule' ? 0 : 60,
) * 1000;

let executionRoot = canonicalRepoRoot;
const NON_TERMINAL_TRACKED_STATES = new Set(['pending', 'running', 'ready', 'publishing']);
const TERMINAL_TRACKED_STATES = new Set(['published', 'superseded', 'failed', 'cancelled']);

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

function lockOwnerLabel(context) {
  return `${mode}:${context}`;
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readSchedulerLockOwner() {
  try {
    return JSON.parse(await readFile(schedulerLockOwnerFile, 'utf8'));
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function acquireSchedulerLock({ context, waitMilliseconds = lockWaitMs } = {}) {
  const owner = {
    pid: process.pid,
    mode,
    context,
    acquiredAt: new Date().toISOString(),
  };
  const deadline = Date.now() + Math.max(waitMilliseconds, 0);

  for (;;) {
    try {
      await mkdir(schedulerLockDir, { mode: 0o700 });
      await writeFile(schedulerLockOwnerFile, `${JSON.stringify(owner, null, 2)}\n`);
      return { acquired: true, owner };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;

      const existingOwner = await readSchedulerLockOwner();
      if (!isProcessAlive(Number(existingOwner?.pid))) {
        await rm(schedulerLockDir, { recursive: true, force: true });
        continue;
      }

      if (Date.now() >= deadline) {
        return { acquired: false, owner: existingOwner ?? null };
      }

      await sleep(1000);
    }
  }
}

async function releaseSchedulerLock(owner) {
  const existingOwner = await readSchedulerLockOwner();
  if (existingOwner?.pid && Number(existingOwner.pid) !== process.pid) return;
  if (owner?.pid && Number(owner.pid) !== process.pid) return;
  await rm(schedulerLockDir, { recursive: true, force: true });
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

function normalizeCloudTaskStatus(output) {
  const text = String(output ?? '');
  if (text.includes('[READY]')) return 'ready';
  if (text.includes('[FAILED]')) return 'failed';
  if (text.includes('[CANCELLED]')) return 'cancelled';
  if (text.includes('[RUNNING]')) return 'running';
  if (text.includes('[PENDING]')) return 'pending';
  return 'unknown';
}

function extractTaskUrl(output) {
  return output.match(/https:\/\/chatgpt\.com\/codex\/tasks\/task_[A-Za-z0-9_-]+/)?.[0] ?? null;
}

function mergeDefined(current, patch) {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
  }
  next.lastMutationSurface ??= 'scheduler';
  return next;
}

function normalizeTrackedTaskEntry(task = {}) {
  if (!task?.taskId) return null;
  return {
    taskId: String(task.taskId),
    taskUrl: task.taskUrl ?? null,
    responsibility: task.responsibility ?? null,
    cycle: task.cycle ?? null,
    signature: task.signature ?? null,
    baselineMainSha: task.baselineMainSha ?? null,
    submittedAt: task.submittedAt ?? null,
    state: String(task.state ?? 'unknown').toLowerCase(),
    dependencyParentResponsibility: task.dependencyParentResponsibility ?? null,
    dependencyParentCycle: task.dependencyParentCycle ?? null,
    dependencyReason: task.dependencyReason ?? null,
    dependencySource: task.dependencySource ?? null,
    lastObservedAt: task.lastObservedAt ?? null,
    publishedAt: task.publishedAt ?? null,
    supersededAt: task.supersededAt ?? null,
    supersededReason: task.supersededReason ?? null,
    prNumber: task.prNumber ?? null,
    prUrl: task.prUrl ?? null,
  };
}

function trackedTaskSelectionKey(task) {
  return `${task.responsibility ?? 'unknown'}/${task.cycle ?? 'unknown'}/${task.signature ?? 'unknown'}/${
    task.baselineMainSha ?? 'unknown'
  }`;
}

function trackedTaskConflictKey(task) {
  return `${task.responsibility ?? 'unknown'}/${task.cycle ?? 'unknown'}/${task.signature ?? 'unknown'}`;
}

function taskMatchesTarget(task, target) {
  if (!task || !target || target.state !== 'actionable') return false;
  if (task.responsibility !== target.responsibility) return false;
  if (task.cycle !== target.cycle) return false;
  const targetSignature = buildActionableSignature(target);
  if (task.signature && targetSignature && task.signature !== targetSignature) return false;
  return true;
}

function buildTrackedTaskFromTarget(target, {
  taskId,
  taskUrl = null,
  baselineMainSha = null,
  submittedAt = new Date().toISOString(),
  state = 'pending',
} = {}) {
  return normalizeTrackedTaskEntry({
    taskId,
    taskUrl,
    responsibility: target.responsibility,
    cycle: target.cycle,
    signature: buildActionableSignature(target),
    baselineMainSha,
    submittedAt,
    state,
    dependencyParentResponsibility: target.dependencyParentResponsibility ?? null,
    dependencyParentCycle: target.dependencyParentCycle ?? null,
    dependencyReason: target.dependencyReason ?? null,
    dependencySource: target.dependencySource ?? null,
  });
}

function targetFromTrackedTask(backlog, trackedTask) {
  if (!trackedTask?.responsibility || !trackedTask?.cycle) return null;
  const detail = backlog.detailsByResponsibility.get(trackedTask.responsibility);
  const summaryRow = backlog.summaryRows.find((row) => row.responsibility === trackedTask.responsibility);
  if (!detail || !summaryRow) return null;
  const cycleRow = detail.cycles.find((row) => row.cycle === trackedTask.cycle);
  if (!cycleRow) return null;
  return {
    state: 'actionable',
    responsibility: trackedTask.responsibility,
    cycle: trackedTask.cycle,
    branchPrefix: `codex/${trackedTask.cycle}-${trackedTask.responsibility}`,
    summaryRow,
    detail,
    cycleRow,
    matrix: backlog.planningMatrix.get(trackedTask.responsibility) ?? null,
    backlogMetrics: backlog.metrics,
    dependencyParentResponsibility: trackedTask.dependencyParentResponsibility ?? null,
    dependencyParentCycle: trackedTask.dependencyParentCycle ?? null,
    dependencyReason: trackedTask.dependencyReason ?? undefined,
    dependencySource: trackedTask.dependencySource ?? undefined,
  };
}

function upsertTrackedTask(tasks, entry) {
  const normalized = normalizeTrackedTaskEntry(entry);
  if (!normalized) return tasks;
  const next = [...tasks];
  const index = next.findIndex((task) => task.taskId === normalized.taskId);
  if (index === -1) next.push(normalized);
  else next[index] = { ...next[index], ...normalized };
  return next;
}

function migrateLegacyTrackedTasks(state) {
  const next = { ...state };
  const normalizedTasks = Array.isArray(next.activeTasks)
    ? next.activeTasks.map((task) => normalizeTrackedTaskEntry(task)).filter(Boolean)
    : [];
  next.activeTasks = normalizedTasks;
  next.publishQueue = Array.isArray(next.publishQueue)
    ? [...new Set(next.publishQueue.map((value) => String(value)))]
    : [];

  const legacyState = String(next.lastTaskState ?? '').toLowerCase();
  if (
    next.activeTasks.length === 0 &&
    next.lastTaskId &&
    next.lastSubmittedTargetResponsibility &&
    next.lastSubmittedTargetCycle &&
    ['pending', 'running', 'ready'].includes(legacyState)
  ) {
    const migrated = normalizeTrackedTaskEntry({
      taskId: next.lastTaskId,
      taskUrl: next.lastTaskUrl ?? null,
      responsibility: next.lastSubmittedTargetResponsibility,
      cycle: next.lastSubmittedTargetCycle,
      signature: next.lastActionableSignature ?? null,
      baselineMainSha: next.lastNoProgressMainSha ?? next.lastMergedSha ?? next.lastHealthEvaluatedSha ?? null,
      submittedAt: next.lastCycleStartedAt ?? next.updatedAt ?? new Date().toISOString(),
      state: legacyState,
      dependencyParentResponsibility:
        next.lastDependencyTargetResponsibility === next.lastSubmittedTargetResponsibility
          ? next.lastDependencyParentResponsibility ?? null
          : null,
      dependencyParentCycle:
        next.lastDependencyTargetResponsibility === next.lastSubmittedTargetResponsibility
          ? next.lastDependencyParentCycle ?? null
          : null,
      dependencyReason: next.lastDependencyReason ?? null,
      dependencySource: next.lastDependencySource ?? null,
    });
    if (migrated) next.activeTasks.push(migrated);
    if (migrated?.state === 'ready' && !next.publishQueue.includes(migrated.taskId)) {
      next.publishQueue.push(migrated.taskId);
    }
  }

  return next;
}

function snapshotLegacyTaskFields(state) {
  const activeTasks = Array.isArray(state?.activeTasks) ? state.activeTasks : [];
  const publishQueue = Array.isArray(state?.publishQueue) ? state.publishQueue : [];
  const prioritized =
    publishQueue
      .map((taskId) => activeTasks.find((task) => task.taskId === taskId))
      .find(Boolean) ??
    activeTasks.find((task) => NON_TERMINAL_TRACKED_STATES.has(task.state)) ??
    activeTasks[0] ??
    null;

  const dependencyTask = activeTasks.find(
    (task) => NON_TERMINAL_TRACKED_STATES.has(task.state) && task.dependencyParentResponsibility,
  );

  return {
    lastTaskId: prioritized?.taskId ?? null,
    lastTaskState: prioritized?.state ?? null,
    lastTaskUrl: prioritized?.taskUrl ?? null,
    lastSubmittedTargetResponsibility: prioritized?.responsibility ?? null,
    lastSubmittedTargetCycle: prioritized?.cycle ?? null,
    lastDependencyTargetResponsibility:
      dependencyTask?.responsibility ??
      (prioritized?.dependencyParentResponsibility ? prioritized.responsibility : null),
    lastDependencyTargetCycle:
      dependencyTask?.cycle ?? (prioritized?.dependencyParentResponsibility ? prioritized.cycle : null),
  };
}

export function reconcileTrackedTaskPool(tasks = []) {
  const normalized = tasks.map((task) => normalizeTrackedTaskEntry(task)).filter(Boolean);
  const groups = new Map();
  for (const task of normalized) {
    const key = trackedTaskConflictKey(task);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(task);
  }

  const now = new Date().toISOString();
  const next = [];
  for (const grouped of groups.values()) {
    const sorted = [...grouped].sort((left, right) => {
      const leftTime = Date.parse(left.submittedAt ?? '') || 0;
      const rightTime = Date.parse(right.submittedAt ?? '') || 0;
      return rightTime - leftTime;
    });
    const winner = sorted[0];
    next.push(winner);
    for (const task of sorted.slice(1)) {
      if (TERMINAL_TRACKED_STATES.has(task.state) || task.state === 'superseded') {
        next.push(task);
        continue;
      }
      next.push({
        ...task,
        state: 'superseded',
        supersededAt: task.supersededAt ?? now,
        supersededReason: task.supersededReason ?? `superseded_by=${winner.taskId}`,
      });
    }
  }

  return next.sort((left, right) => {
    const leftTime = Date.parse(left.submittedAt ?? '') || 0;
    const rightTime = Date.parse(right.submittedAt ?? '') || 0;
    return leftTime - rightTime;
  });
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
  activeTaskState = null,
  activeTaskCount = 0,
  maxParallelTasks = parallelLimit,
} = {}) {
  if (healthState !== 'ready') return false;
  if (openControllerPrState !== 'none') return false;
  if (['pending', 'running'].includes(String(activeTaskState ?? '').toLowerCase())) return false;
  if (activeTaskCount >= maxParallelTasks) return false;
  return resolvedTarget?.state === 'actionable';
}

export function shouldAttemptRemoteGate({
  resolvedTarget,
  remoteAutomationAvailable = false,
  activeTaskCount = 0,
  publishQueueCount = 0,
  parallelEligibleCount = 0,
} = {}) {
  if (!remoteAutomationAvailable) return false;
  if (resolvedTarget?.state !== 'blocked') return false;
  if (resolvedTarget?.blockKind !== 'pause') return false;
  if (activeTaskCount > 0) return false;
  if (publishQueueCount > 0) return false;
  if (parallelEligibleCount > 0) return false;
  return true;
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
    return migrateLegacyTrackedTasks(JSON.parse(raw));
  } catch {
    return migrateLegacyTrackedTasks({});
  }
}

async function writeRuntimeState(patch) {
  const current = await loadRuntimeState();
  const next = mergeDefined(current, patch);
  next.activeTasks = reconcileTrackedTaskPool(
    Array.isArray(next.activeTasks) ? next.activeTasks : current.activeTasks ?? [],
  );
  next.publishQueue = Array.isArray(next.publishQueue)
    ? [...new Set(next.publishQueue.map((value) => String(value)))]
    : current.publishQueue ?? [];
  const legacySnapshot = snapshotLegacyTaskFields(next);
  Object.assign(next, legacySnapshot);
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
  const trackedTask = await submitTrackedTask(targetBefore, mainSha);
  const runtimeState = await loadRuntimeState();
  const activeTasks = upsertTrackedTask(runtimeState.activeTasks ?? [], trackedTask);
  await persistResolvedTarget(targetBefore, {
    activeTasks,
    publishQueue: runtimeState.publishQueue ?? [],
    lastCycleState: 'running',
    lastFunctionalState: 'ready',
    healthState: 'ready',
    lastTaskCompletedAt: null,
    lastDependencyState: isDependencyTarget(targetBefore) ? 'watching_task' : null,
    lastError: null,
    lastErrorAt: null,
  });
  log(`task_submitted task=${trackedTask.taskId} target=${targetBefore.responsibility}/${targetBefore.cycle}`);
}

function resolveTrackedTaskForPublish(backlog, trackedTask) {
  const frontier = resolveResponsibilityTarget(backlog, trackedTask.responsibility);
  if (frontier.state !== 'actionable') {
    return { publishable: false, reason: `responsibility_frontier=${frontier.state}` };
  }
  const expectedSignature = buildActionableSignature(frontier);
  if (frontier.cycle !== trackedTask.cycle) {
    return { publishable: false, reason: `cycle_advanced=${frontier.cycle}` };
  }
  if (trackedTask.signature && expectedSignature && trackedTask.signature !== expectedSignature) {
    return { publishable: false, reason: 'signature_changed' };
  }
  return { publishable: true, target: frontier };
}

async function markTrackedTaskState(taskId, patch = {}) {
  const { removeFromQueue = false, ...taskPatch } = patch;
  const runtimeState = await loadRuntimeState();
  const activeTasks = (runtimeState.activeTasks ?? []).map((task) =>
    task.taskId === taskId ? { ...task, ...taskPatch } : task,
  );
  const publishQueue = (runtimeState.publishQueue ?? []).filter(
    (queuedTaskId) => (removeFromQueue ? queuedTaskId !== taskId : true),
  );
  await writeRuntimeState({
    activeTasks,
    publishQueue,
  });
}

async function processPublishQueue({ backlog, mainSha }) {
  let runtimeState = await refreshTrackedTasks(await loadRuntimeState());
  await writeRuntimeState({
    activeTasks: runtimeState.activeTasks,
    publishQueue: runtimeState.publishQueue,
  });

  const queuedTasks = normalizePublishQueue(runtimeState);
  for (const queuedTask of queuedTasks) {
    const publishResolution = resolveTrackedTaskForPublish(backlog, queuedTask);
    if (!publishResolution.publishable) {
      await markTrackedTaskState(queuedTask.taskId, {
        state: 'superseded',
        supersededAt: new Date().toISOString(),
        supersededReason: publishResolution.reason,
        removeFromQueue: true,
      });
      log(`task_superseded task=${queuedTask.taskId} reason=${publishResolution.reason}`);
      continue;
    }

    await markTrackedTaskState(queuedTask.taskId, {
      state: 'publishing',
      lastObservedAt: new Date().toISOString(),
    });
    const publish = await publishTaskDiff(queuedTask.taskId, publishResolution.target);
    if (publish.prState === 'no_diff') {
      await markTrackedTaskState(queuedTask.taskId, {
        state: 'superseded',
        supersededAt: new Date().toISOString(),
        supersededReason: 'no_diff',
        removeFromQueue: true,
      });
      log(`task_no_diff task=${queuedTask.taskId}`);
      continue;
    }
    if (publish.prState === 'stale_conflict') {
      await markTrackedTaskState(queuedTask.taskId, {
        state: 'superseded',
        supersededAt: new Date().toISOString(),
        supersededReason: 'patch_conflict_with_main',
        removeFromQueue: true,
      });
      log(`task_superseded task=${queuedTask.taskId} reason=patch_conflict_with_main`);
      continue;
    }

    await markTrackedTaskState(queuedTask.taskId, {
      state: 'publishing',
      prNumber: publish.prNumber ?? null,
      prUrl: publish.prUrl ?? null,
      lastObservedAt: new Date().toISOString(),
      removeFromQueue: true,
    });
    await writeRuntimeState({
      lastTaskCompletedAt: new Date().toISOString(),
      lastCycleState: 'awaiting_pr_merge',
      lastFunctionalState: 'ready',
      lastDependencyState: queuedTask.dependencyParentResponsibility ? 'awaiting_pr_merge' : null,
      lastError: null,
      lastErrorAt: null,
    });
    return {
      state: 'published',
      taskId: queuedTask.taskId,
      target: publishResolution.target,
      prState: publish.prState,
    };
  }

  return { state: 'empty' };
}

async function readCloudTaskStatus(taskId) {
  const statusResult = await runBash(
    withEnvFile(`${'${CODEX_CLOUD_CLI:-codex}'} cloud status ${shellQuote(taskId)}`),
    { quiet: true },
  );
  return {
    taskId,
    status: normalizeCloudTaskStatus(statusResult.output),
    output: statusResult.output,
    code: statusResult.code,
    taskUrl: extractTaskUrl(statusResult.output),
  };
}

function findTrackedTaskForTarget(target, runtimeState, states = NON_TERMINAL_TRACKED_STATES) {
  if (!target || target.state !== 'actionable') return null;
  const tasks = Array.isArray(runtimeState?.activeTasks) ? runtimeState.activeTasks : [];
  return (
    tasks.find(
      (task) =>
        taskMatchesTarget(task, target) &&
        states.has(task.state) &&
        (task.signature == null || task.signature === buildActionableSignature(target)),
    ) ?? null
  );
}

function normalizePublishQueue(runtimeState) {
  const tasks = Array.isArray(runtimeState?.activeTasks) ? runtimeState.activeTasks : [];
  const queue = Array.isArray(runtimeState?.publishQueue) ? runtimeState.publishQueue : [];
  return [...new Set(queue)]
    .map((taskId) => tasks.find((task) => task.taskId === taskId))
    .filter((task) => task && ['ready', 'publishing'].includes(task.state))
    .sort((left, right) => {
      const leftTime = Date.parse(left.submittedAt ?? '') || 0;
      const rightTime = Date.parse(right.submittedAt ?? '') || 0;
      return leftTime - rightTime;
    });
}

async function refreshTrackedTasks(runtimeState) {
  const currentTasks = Array.isArray(runtimeState?.activeTasks) ? runtimeState.activeTasks : [];
  let nextTasks = [...currentTasks];
  let nextQueue = Array.isArray(runtimeState?.publishQueue) ? [...runtimeState.publishQueue] : [];

  for (const task of currentTasks) {
    if (!NON_TERMINAL_TRACKED_STATES.has(task.state) || task.state === 'publishing') continue;
    const status = await readCloudTaskStatus(task.taskId);
    const normalizedTask = {
      ...task,
      state: status.status,
      taskUrl: task.taskUrl ?? status.taskUrl ?? null,
      lastObservedAt: new Date().toISOString(),
    };
    nextTasks = upsertTrackedTask(nextTasks, normalizedTask);
  }

  nextTasks = reconcileTrackedTaskPool(nextTasks);
  for (const task of nextTasks) {
    if (task.state === 'ready' && !nextQueue.includes(task.taskId)) {
      nextQueue.push(task.taskId);
    }
    if (!['ready', 'publishing'].includes(task.state)) {
      nextQueue = nextQueue.filter((taskId) => taskId !== task.taskId);
    }
  }

  const normalizedQueue = normalizePublishQueue({
    activeTasks: nextTasks,
    publishQueue: nextQueue,
  }).map((task) => task.taskId);

  return {
    ...runtimeState,
    activeTasks: nextTasks,
    publishQueue: normalizedQueue,
  };
}

function getOccupiedActionableTargets(runtimeState, backlog) {
  const occupied = [];
  for (const task of Array.isArray(runtimeState?.activeTasks) ? runtimeState.activeTasks : []) {
    if (!NON_TERMINAL_TRACKED_STATES.has(task.state)) continue;
    const target = targetFromTrackedTask(backlog, task);
    if (target) occupied.push(target);
  }
  return occupied;
}

function countTrackedTasks(runtimeState, states = []) {
  const tasks = Array.isArray(runtimeState?.activeTasks) ? runtimeState.activeTasks : [];
  const allowedStates = new Set(states);
  return tasks.filter((task) => allowedStates.has(task.state)).length;
}

function countActiveDependencyChains(runtimeState) {
  const tasks = Array.isArray(runtimeState?.activeTasks) ? runtimeState.activeTasks : [];
  const parents = new Set();
  for (const task of tasks) {
    if (!NON_TERMINAL_TRACKED_STATES.has(task.state)) continue;
    if (!task.dependencyParentResponsibility || !task.dependencyParentCycle) continue;
    parents.add(`${task.dependencyParentResponsibility}/${task.dependencyParentCycle}`);
  }
  return parents.size;
}

async function submitTrackedTask(target, baselineMainSha) {
  const submit = await runBash(
    withEnvFile('.codex/cloud/submit-controller-task.sh', controllerEnv(target)),
  );
  if (submit.code !== 0) throw new Error(`submit failed with exit ${submit.code}`);

  const taskId = extractTaskId(submit.output);
  if (!taskId) throw new Error('submit did not emit a task id');
  const taskUrl = extractTaskUrl(submit.output);
  return buildTrackedTaskFromTarget(target, {
    taskId,
    taskUrl,
    baselineMainSha,
    submittedAt: new Date().toISOString(),
    state: 'pending',
  });
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
  const isPublicationEvidence = Boolean(remoteResult.evidence?.publishedUrl && remoteResult.smokeRun);
  const summary = isPublicationEvidence
    ? [
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
      ].join('\n')
    : [
        '## Summary',
        '',
        `- Records remote deploy evidence for \`${target.responsibility}/${target.cycle}\`.`,
        `- Cloudflare dry-run: ${remoteResult.deployRun.runUrl}.`,
        `- Module path: \`${remoteResult.runbook.modulePath}\`.`,
        '',
        '## Validation',
        '',
        `- Dry-run remote concluído com sucesso para \`${target.responsibility}\`.`,
        `- Source SHA: \`${remoteResult.headSha ?? 'unknown'}\`.`,
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

  const remoteRunner =
    target.responsibility === 'gateway-borda' && target.cycle === 'publicacao'
      ? executeGatewayBordaPublicationRemoteGate
      : target.cycle === 'publicacao'
        ? executeWorkerPublicationRemoteGate
        : executeWorkerDeployRemoteGate;
  const result = await remoteRunner({
    target,
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
    lastPublishedUrl: result.evidence?.publishedUrl ?? '',
    lastRemoteSmokeRunId: result.smokeRun?.runId ?? null,
    lastRemoteSmokeUrl: result.smokeRun?.runUrl ?? null,
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
  const lock = await acquireSchedulerLock({
    context: `cycle:${reason}`,
    waitMilliseconds: reason === 'scheduled' ? 0 : lockWaitMs,
  });
  if (!lock.acquired) {
    const ownerLabel = lock.owner?.context ?? 'unknown';
    if (reason === 'scheduled') {
      log(`cycle skipped reason=${reason} lock_held_by=${ownerLabel}`);
      await writeRuntimeState({
        lastCycleReason: reason,
        lastScheduledSlotAt: scheduledSlotAt,
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: 'waiting_lock',
        lastFunctionalState: 'ready',
        healthState: 'ready',
        lastError: null,
        lastErrorAt: null,
      });
      return;
    }
    throw new Error(`scheduler_lock_timeout owner=${ownerLabel}`);
  }

  const previousRuntimeState = await loadRuntimeState();
  const cycleStartedAt = new Date().toISOString();
  log(`cycle started reason=${reason}`);

  try {
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
    }

    if (!['none', 'merged'].includes(initialReconciliation.state)) {
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
    let runtimeState = await refreshTrackedTasks(await loadRuntimeState());
    await writeRuntimeState({
      activeTasks: runtimeState.activeTasks,
      publishQueue: runtimeState.publishQueue,
      parallelLimit,
    });

    const { backlog, resolved: targetBefore } = await resolveCurrentBacklog();
    await persistResolvedTarget(targetBefore, {
      lastCycleState: cycleStateFromResolvedTarget(targetBefore),
      lastFunctionalState: describeResolvedTargetState(targetBefore).functionalState ?? 'ready',
      healthState: 'ready',
      parallelLimit,
      activeTasks: runtimeState.activeTasks,
      publishQueue: runtimeState.publishQueue,
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

    const publishQueueResult = await processPublishQueue({ backlog, mainSha });
    if (publishQueueResult.state === 'published') {
      const reconciliation = await reconcileOpenControllerPr({ wait: true });
      if (reconciliation.state === 'merged') {
        const mergedSha = await syncIsolatedWorktreeToMain();
        await markTrackedTaskState(publishQueueResult.taskId, {
          state: 'published',
          publishedAt: new Date().toISOString(),
          lastObservedAt: new Date().toISOString(),
        });
        const { resolved: targetAfterMerge } = await resolveCurrentBacklog();
        await finalizeProgress({
          targetBefore: publishQueueResult.target,
          targetAfter: targetAfterMerge,
          mainSha,
          openControllerPrState: 'merged',
          cycleCompletedAt: new Date().toISOString(),
          mergedSha,
          mergedPrNumber: reconciliation.prNumber ?? null,
        });
        log(`cycle_finished_published_task task=${publishQueueResult.taskId} pr=#${reconciliation.prNumber ?? 'unknown'} sha=${mergedSha}`);
        return;
      }

      await writeRuntimeState({
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: ['failed', 'timeout'].includes(reconciliation.state) ? 'blocked' : 'awaiting_pr_merge',
        lastFunctionalState: ['failed', 'timeout'].includes(reconciliation.state) ? 'degraded' : 'ready',
        openControllerPrState: reconciliation.state,
        healthState: 'ready',
        lastError:
          ['failed', 'timeout'].includes(reconciliation.state)
            ? `open_controller_pr_state=${reconciliation.state}`
            : null,
        lastErrorAt:
          ['failed', 'timeout'].includes(reconciliation.state) ? new Date().toISOString() : null,
      });
      log(`publish_queue_pending task=${publishQueueResult.taskId} pr_state=${reconciliation.state}`);
      return;
    }

    runtimeState = await refreshTrackedTasks(await loadRuntimeState());
    await writeRuntimeState({
      activeTasks: runtimeState.activeTasks,
      publishQueue: runtimeState.publishQueue,
    });

    const pendingRunningCount = countTrackedTasks(runtimeState, ['pending', 'running']);
    const publishQueueCount = normalizePublishQueue(runtimeState).length;
    const trackedReadyTaskCount = countTrackedTasks(runtimeState, ['ready']);
    const supersededTaskCount = countTrackedTasks(runtimeState, ['superseded']);
    const activeDependencyChainCount = countActiveDependencyChains(runtimeState);
    const occupiedTargets = getOccupiedActionableTargets(runtimeState, backlog);
    const slotsAvailable = Math.max(parallelLimit - pendingRunningCount, 0);
    const parallelWindow = resolveParallelBacklogTargets(backlog, {
      limit: slotsAvailable,
      excludeTargets: occupiedTargets,
    });

    await writeRuntimeState({
      lastParallelLimit: parallelLimit,
      lastActiveTaskCount: pendingRunningCount,
      lastPublishQueueCount: publishQueueCount,
      lastTrackedReadyTaskCount: trackedReadyTaskCount,
      lastSupersededTaskCount: supersededTaskCount,
      lastActiveDependencyChainCount: activeDependencyChainCount,
      lastParallelEligibleTargets: parallelWindow.targets.map((target) => `${target.responsibility}/${target.cycle}`),
      lastParallelExcludedTargets: parallelWindow.excluded.map((item) => `${item.responsibility}/${item.cycle ?? 'none'}:${item.reason}`),
    });

    if (slotsAvailable > 0 && parallelWindow.targets.length > 0) {
      for (const target of parallelWindow.targets) {
        if (findTrackedTaskForTarget(target, runtimeState)) continue;
        await executeActionableTarget({ targetBefore: target, mainSha });
        runtimeState = await loadRuntimeState();
      }

      await writeRuntimeState({
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: 'running',
        lastFunctionalState: 'ready',
        healthState: 'ready',
        openControllerPrState: 'none',
        lastError: null,
        lastErrorAt: null,
      });
      log(
        `parallel_submissions_submitted count=${parallelWindow.targets.length} slots=${slotsAvailable} pending_running=${countTrackedTasks(runtimeState, ['pending', 'running'])}`,
      );
      return;
    }

    const remoteRunbook = getRemoteAutomationRunbook(targetBefore);
    if (
      shouldAttemptRemoteGate({
        resolvedTarget: targetBefore,
        remoteAutomationAvailable: Boolean(remoteRunbook),
        activeTaskCount: pendingRunningCount,
        publishQueueCount,
        parallelEligibleCount: parallelWindow.targets.length,
      })
    ) {
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
            await writeRuntimeState({
              lastCycleCompletedAt: new Date().toISOString(),
              lastCycleState: 'running',
              lastFunctionalState: 'ready',
              healthState: 'ready',
            });
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

    if (targetBefore.state === 'blocked' && (pendingRunningCount > 0 || publishQueueCount > 0 || parallelWindow.targets.length > 0)) {
      await persistResolvedTarget(targetBefore, {
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: pendingRunningCount > 0 ? 'running' : 'ready',
        lastFunctionalState: 'ready',
        healthState: 'ready',
        openControllerPrState: 'none',
        lastError: null,
        lastErrorAt: null,
      });
      log(
        `parallel_window_waiting blocked_target=${targetBefore.responsibility}/${targetBefore.cycle} slots=${slotsAvailable} pending_running=${pendingRunningCount} eligible=${parallelWindow.targets.length} publish_queue=${publishQueueCount}`,
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

    if (slotsAvailable <= 0 || parallelWindow.targets.length === 0) {
      await persistResolvedTarget(targetBefore, {
        lastCycleCompletedAt: new Date().toISOString(),
        lastCycleState: pendingRunningCount > 0 ? 'running' : cycleStateFromResolvedTarget(targetBefore),
        lastFunctionalState: 'ready',
        healthState: 'ready',
        openControllerPrState: 'none',
        lastError: null,
        lastErrorAt: null,
      });
      log(
        `parallel_window_idle slots=${slotsAvailable} pending_running=${pendingRunningCount} eligible=${parallelWindow.targets.length}`,
      );
      return;
    }
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
    await releaseSchedulerLock(lock.owner);
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
    const lock = await acquireSchedulerLock({ context: lockOwnerLabel('dry-run') });
    if (!lock.acquired) {
      throw new Error(`scheduler_lock_timeout owner=${lock.owner?.context ?? 'unknown'}`);
    }
    try {
      await preflight();
      const health = await evaluateHealth();
      const runtimeState = await refreshTrackedTasks(await loadRuntimeState());
      const { backlog, resolved } = await resolveCurrentBacklog();
      const parallelWindow = resolveParallelBacklogTargets(backlog, {
        limit: Math.max(parallelLimit - countTrackedTasks(runtimeState, ['pending', 'running']), 0),
        excludeTargets: getOccupiedActionableTargets(runtimeState, backlog),
      });
      await cleanIsolatedWorktree();
      await writeRuntimeState({
        lastDryRunAt: new Date().toISOString(),
        lastDryRunHealthState: health.status,
        lastHealthEvaluatedAt: new Date().toISOString(),
        lastHealthErrors: health.errors.length > 0 ? health.errors.join(',') : null,
        lastHealthEvaluatedRefSource: health.evaluatedRefSource ?? null,
        lastHealthEvaluatedSha: health.evaluatedSha ?? null,
        activeTasks: runtimeState.activeTasks,
        publishQueue: runtimeState.publishQueue,
        lastParallelLimit: parallelLimit,
        lastActiveTaskCount: countTrackedTasks(runtimeState, ['pending', 'running']),
        lastPublishQueueCount: normalizePublishQueue(runtimeState).length,
        lastTrackedReadyTaskCount: countTrackedTasks(runtimeState, ['ready']),
        lastSupersededTaskCount: countTrackedTasks(runtimeState, ['superseded']),
        lastActiveDependencyChainCount: countActiveDependencyChains(runtimeState),
        lastParallelEligibleTargets: parallelWindow.targets.map((target) => `${target.responsibility}/${target.cycle}`),
        lastParallelExcludedTargets: parallelWindow.excluded.map((item) => `${item.responsibility}/${item.cycle ?? 'none'}:${item.reason}`),
      });
      await persistResolvedTarget(resolved, {
        activeTasks: runtimeState.activeTasks,
        publishQueue: runtimeState.publishQueue,
        parallelLimit,
      });
      if (health.status !== 'ready') {
        throw new Error(`health_state=${health.status} errors=${health.errors.join(',') || 'unknown'}`);
      }
      log(`dry_run_parallel_limit=${parallelLimit}`);
      log(`dry_run_active_task_count=${countTrackedTasks(runtimeState, ['pending', 'running'])}`);
      log(`dry_run_publish_queue_count=${normalizePublishQueue(runtimeState).length}`);
      log(
        `dry_run_parallel_targets=${parallelWindow.targets.map((target) => `${target.responsibility}/${target.cycle}`).join(',') || 'none'}`,
      );
      if (parallelWindow.excluded.length > 0) {
        log(
          `dry_run_parallel_excluded=${parallelWindow.excluded
            .map((item) => `${item.responsibility}/${item.cycle ?? 'none'}:${item.reason}`)
            .join(',')}`,
        );
      }
      log('dry-run ok');
    } finally {
      await releaseSchedulerLock(lock.owner);
    }
    return;
  }

  if (mode === 'once') {
    await runCycle('manual', new Date().toISOString());
    return;
  }

  const startupLock = await acquireSchedulerLock({ context: lockOwnerLabel('startup') });
  if (!startupLock.acquired) {
    throw new Error(`scheduler_lock_timeout owner=${startupLock.owner?.context ?? 'unknown'}`);
  }
  try {
    await preflight();
    await cleanIsolatedWorktree();
  } finally {
    await releaseSchedulerLock(startupLock.owner);
  }

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

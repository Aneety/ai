import { buildActionableSignature } from './controller-backlog.mjs';

function parseTimestamp(value) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function getLatestSuccessTimestamp(runtimeState) {
  return (
    parseTimestamp(runtimeState?.lastMergedAt) ??
    parseTimestamp(runtimeState?.lastTaskCompletedAt) ??
    parseTimestamp(runtimeState?.lastCycleCompletedAt) ??
    null
  );
}

export function getLastSuccessAgeSeconds(runtimeState, nowMs = Date.now()) {
  const latest = getLatestSuccessTimestamp(runtimeState);
  if (latest == null) return null;
  return Math.max(Math.floor((nowMs - latest) / 1000), 0);
}

export function isAwaitingNextTick(runtimeState, nowMs = Date.now()) {
  const nextScheduledRunAt = parseTimestamp(runtimeState?.nextScheduledRunAt);
  const schedulerStartedAt = parseTimestamp(runtimeState?.schedulerStartedAt);
  const lastCycleStartedAt = parseTimestamp(runtimeState?.lastCycleStartedAt);

  if (nextScheduledRunAt == null || schedulerStartedAt == null) return false;
  if (nowMs >= nextScheduledRunAt) return false;
  return lastCycleStartedAt == null || lastCycleStartedAt < schedulerStartedAt;
}

export function isBetweenScheduledSlots(runtimeState, nowMs = Date.now(), graceMs = 60_000) {
  const nextScheduledRunAt = parseTimestamp(runtimeState?.nextScheduledRunAt);
  if (nextScheduledRunAt == null) return false;
  return nowMs < nextScheduledRunAt + graceMs;
}

export function isStableBlockedTarget(target, runtimeState, mainSha) {
  if (!target || target.state !== 'actionable') return false;
  if (!runtimeState) return false;
  if (runtimeState.lastCycleState !== 'blocked') return false;
  if (runtimeState.lastNoProgressMainSha !== mainSha) return false;
  if (runtimeState.lastNoProgressResponsibility !== target.responsibility) return false;
  if (runtimeState.lastNoProgressCycle !== target.cycle) return false;
  return runtimeState.lastNoProgressSignature === buildActionableSignature(target);
}

export function compareTargets(beforeTarget, afterTarget) {
  if (!beforeTarget || beforeTarget.state !== 'actionable') {
    return { progressed: true, unchanged: false };
  }
  if (!afterTarget || afterTarget.state !== 'actionable') {
    return { progressed: true, unchanged: false };
  }

  const samePair =
    beforeTarget.responsibility === afterTarget.responsibility && beforeTarget.cycle === afterTarget.cycle;
  const sameSignature =
    buildActionableSignature(beforeTarget) != null &&
    buildActionableSignature(beforeTarget) === buildActionableSignature(afterTarget);

  return {
    progressed: !samePair || !sameSignature,
    unchanged: samePair && sameSignature,
    samePair,
    sameSignature,
  };
}

export function deriveMonitorState({
  resolvedTarget,
  runtimeState,
  mainSha,
  openControllerPrState = 'none',
  cloudTaskCount = 0,
  healthState = 'ready',
  nowMs = Date.now(),
  recentSuccessWindowSeconds = 3600,
}) {
  const awaitingNextTick = isAwaitingNextTick(runtimeState, nowMs);
  const betweenSlots = isBetweenScheduledSlots(runtimeState, nowMs);
  const lastSuccessAgeSeconds = getLastSuccessAgeSeconds(runtimeState, nowMs);
  const stableBlocked = isStableBlockedTarget(resolvedTarget, runtimeState, mainSha);
  const hasRecentSuccess =
    lastSuccessAgeSeconds != null && lastSuccessAgeSeconds <= Math.max(recentSuccessWindowSeconds, 0);
  const pausedByBacklog = resolvedTarget?.state === 'blocked' && resolvedTarget?.blockKind === 'pause';
  const pausedManualExternal =
    pausedByBacklog && resolvedTarget?.blockerAutomationKind !== 'remote_automable';
  const remoteActionState = runtimeState?.lastRemoteActionState ?? 'none';
  const runningRemoteDeploy = remoteActionState === 'running_remote_deploy';
  const runningRemoteSmoke = remoteActionState === 'running_remote_smoke';
  const degradedByBacklog =
    resolvedTarget?.state === 'blocked' && resolvedTarget?.blockKind != null && resolvedTarget?.blockKind !== 'pause';
  const degradedByPr = ['failed', 'timeout'].includes(openControllerPrState);
  const isDegraded = healthState !== 'ready' || degradedByBacklog || degradedByPr;

  let backlogCompletionState = 'in_progress';
  if (resolvedTarget?.state === 'complete') {
    backlogCompletionState = 'complete';
  } else if (pausedByBacklog) {
    backlogCompletionState = 'paused';
  } else if (resolvedTarget?.state === 'blocked' || stableBlocked || degradedByPr) {
    backlogCompletionState = 'blocked';
  }

  let schedulerFunctionalState = 'ready';
  if (backlogCompletionState === 'complete') {
    schedulerFunctionalState = 'ready';
  } else if (isDegraded || stableBlocked) {
    schedulerFunctionalState = 'degraded';
  } else if (
    (
      !runningRemoteDeploy &&
      !runningRemoteSmoke &&
      pausedByBacklog
    ) ||
    (
      !runningRemoteDeploy &&
      !runningRemoteSmoke &&
      resolvedTarget?.state === 'blocked' &&
      runtimeState?.lastFunctionalState === 'paused'
    )
  ) {
    schedulerFunctionalState = 'paused';
  }

  let controllerProgressState = 'ready_for_cycle';
  if (backlogCompletionState === 'complete') {
    controllerProgressState = 'complete';
  } else if (schedulerFunctionalState === 'degraded') {
    controllerProgressState = 'degraded_health';
  } else if (runningRemoteDeploy) {
    controllerProgressState = 'running_remote_deploy';
  } else if (runningRemoteSmoke) {
    controllerProgressState = 'running_remote_smoke';
  } else if (['pending', 'merge_ready'].includes(openControllerPrState)) {
    controllerProgressState = 'pending_pr_checks';
  } else if (schedulerFunctionalState === 'paused') {
    controllerProgressState = pausedManualExternal ? 'paused_waiting_manual_external_gate' : 'paused_waiting_external_gate';
  } else if (awaitingNextTick) {
    controllerProgressState = 'awaiting_next_tick';
  } else if (betweenSlots || hasRecentSuccess) {
    controllerProgressState = 'idle_between_slots';
  }

  const shouldWarnCloudTaskListEmpty =
    cloudTaskCount === 0 &&
    openControllerPrState === 'none' &&
    schedulerFunctionalState === 'ready' &&
    backlogCompletionState !== 'complete' &&
    !runningRemoteDeploy &&
    !runningRemoteSmoke &&
    !awaitingNextTick &&
    !betweenSlots &&
    !hasRecentSuccess;

  return {
    awaitingNextTick,
    betweenSlots,
    stableBlocked,
    backlogCompletionState,
    controllerProgressState,
    schedulerFunctionalState,
    lastSuccessAgeSeconds,
    hasRecentSuccess,
    pausedByBacklog,
    pausedManualExternal,
    runningRemoteDeploy,
    runningRemoteSmoke,
    isDegraded,
    shouldWarnCloudTaskListEmpty,
  };
}

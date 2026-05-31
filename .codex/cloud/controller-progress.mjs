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
    return { progressed: afterTarget?.state !== 'actionable', unchanged: false };
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
  nowMs = Date.now(),
  recentSuccessWindowSeconds = 3600,
}) {
  const awaitingNextTick = isAwaitingNextTick(runtimeState, nowMs);
  const betweenSlots = isBetweenScheduledSlots(runtimeState, nowMs);
  const lastSuccessAgeSeconds = getLastSuccessAgeSeconds(runtimeState, nowMs);
  const stableBlocked = isStableBlockedTarget(resolvedTarget, runtimeState, mainSha);
  const hasRecentSuccess =
    lastSuccessAgeSeconds != null && lastSuccessAgeSeconds <= Math.max(recentSuccessWindowSeconds, 0);

  let backlogCompletionState = 'in_progress';
  if (resolvedTarget?.state === 'complete') {
    backlogCompletionState = 'complete';
  } else if (
    resolvedTarget?.state === 'blocked' ||
    stableBlocked ||
    ['failed', 'timeout'].includes(openControllerPrState)
  ) {
    backlogCompletionState = 'blocked';
  }

  let controllerProgressState = 'ready_for_cycle';
  if (backlogCompletionState === 'complete') {
    controllerProgressState = 'complete';
  } else if (['pending', 'merge_ready'].includes(openControllerPrState)) {
    controllerProgressState = openControllerPrState;
  } else if (['failed', 'timeout'].includes(openControllerPrState) || stableBlocked) {
    controllerProgressState = 'blocked';
  } else if (awaitingNextTick) {
    controllerProgressState = 'awaiting_next_tick';
  } else if (betweenSlots || hasRecentSuccess) {
    controllerProgressState = 'idle_between_slots';
  }

  const shouldWarnCloudTaskListEmpty =
    cloudTaskCount === 0 &&
    openControllerPrState === 'none' &&
    backlogCompletionState !== 'complete' &&
    !awaitingNextTick &&
    !betweenSlots &&
    !hasRecentSuccess;

  return {
    awaitingNextTick,
    betweenSlots,
    stableBlocked,
    backlogCompletionState,
    controllerProgressState,
    lastSuccessAgeSeconds,
    hasRecentSuccess,
    shouldWarnCloudTaskListEmpty,
  };
}

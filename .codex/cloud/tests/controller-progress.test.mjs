import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveMonitorState, isAwaitingNextTick } from '../controller-progress.mjs';

const now = Date.parse('2026-05-31T21:33:00Z');

function actionableTarget(overrides = {}) {
  return {
    state: 'actionable',
    responsibility: 'tenant-white-label',
    cycle: 'deploy',
    cycleRow: {
      status: 'pronto',
      gate: 'processo',
      evidence: 'PR mergeada',
      blocker: '—',
      nextAction: 'Executar deploy.',
    },
    ...overrides,
  };
}

test('detecta awaiting_next_tick após restart antes do primeiro slot', () => {
  const runtimeState = {
    schedulerStartedAt: '2026-05-31T21:30:01Z',
    nextScheduledRunAt: '2026-05-31T22:00:00Z',
  };

  assert.equal(isAwaitingNextTick(runtimeState, now), true);
});

test('não alerta cloud_task_list_empty quando houve sucesso recente', () => {
  const runtimeState = {
    lastMergedAt: '2026-05-31T21:20:00Z',
    nextScheduledRunAt: '2026-05-31T22:00:00Z',
    schedulerStartedAt: '2026-05-31T20:00:00Z',
    lastCycleStartedAt: '2026-05-31T21:00:00Z',
  };

  const derived = deriveMonitorState({
    resolvedTarget: actionableTarget(),
    runtimeState,
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 0,
    nowMs: now,
  });

  assert.equal(derived.hasRecentSuccess, true);
  assert.equal(derived.shouldWarnCloudTaskListEmpty, false);
  assert.equal(derived.controllerProgressState, 'idle_between_slots');
});

test('alerta cloud_task_list_empty sem sucesso recente, sem PR e fora da janela', () => {
  const runtimeState = {
    lastMergedAt: '2026-05-31T18:00:00Z',
    nextScheduledRunAt: '2026-05-31T20:00:00Z',
    schedulerStartedAt: '2026-05-31T17:00:00Z',
    lastCycleStartedAt: '2026-05-31T19:00:00Z',
  };

  const derived = deriveMonitorState({
    resolvedTarget: actionableTarget(),
    runtimeState,
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 0,
    nowMs: now,
  });

  assert.equal(derived.hasRecentSuccess, false);
  assert.equal(derived.shouldWarnCloudTaskListEmpty, true);
  assert.equal(derived.controllerProgressState, 'ready_for_cycle');
});

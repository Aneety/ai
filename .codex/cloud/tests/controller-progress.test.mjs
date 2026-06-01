import test from 'node:test';
import assert from 'node:assert/strict';
import { compareTargets, deriveMonitorState, isAwaitingNextTick } from '../controller-progress.mjs';

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

function dependencyTarget(overrides = {}) {
  return actionableTarget({
    responsibility: 'tenant-white-label',
    cycle: 'deploy',
    dependencyParentResponsibility: 'gateway-borda',
    dependencyParentCycle: 'publicacao',
    dependencyReason: 'dependency_preemption=gateway-borda/publicacao->tenant-white-label/deploy',
    dependencySource: 'planning_matrix',
    ...overrides,
  });
}

function pausedTarget(status = 'bloqueado') {
  return {
    state: 'blocked',
    blockKind: 'pause',
    pauseStatus: status,
    pauseReason: 'Aguardando gate remoto.',
    responsibility: 'gateway-borda',
    cycle: 'deploy',
    cycleRow: {
      status,
      gate: 'processo',
      evidence: 'Gate remoto ausente.',
      blocker: 'Aguardando gate remoto.',
      nextAction: 'Executar gate remoto.',
    },
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
  assert.equal(derived.controllerProgressState, 'ready_for_more_parallel_work');
});

test('mudanca apenas narrativa nao conta como progresso', () => {
  const before = actionableTarget();
  const after = actionableTarget({
    cycleRow: {
      ...before.cycleRow,
      evidence: 'Texto reescrito sem mudar gate.',
      blocker: 'Narrativa alterada.',
      nextAction: 'Narrativa alterada.',
    },
  });

  const comparison = compareTargets(before, after);
  assert.equal(comparison.samePair, true);
  assert.equal(comparison.sameSignature, true);
  assert.equal(comparison.progressed, false);
  assert.equal(comparison.unchanged, true);
});

test('mudanca de status conta como progresso funcional', () => {
  const before = actionableTarget();
  const after = actionableTarget({
    cycleRow: {
      ...before.cycleRow,
      status: 'validacao',
    },
  });

  const comparison = compareTargets(before, after);
  assert.equal(comparison.progressed, true);
  assert.equal(comparison.unchanged, false);
});

test('backlog pausado mostra paused_waiting_external_gate e nao alerta task vazia', () => {
  const derived = deriveMonitorState({
    resolvedTarget: pausedTarget('bloqueado'),
    runtimeState: {
      nextScheduledRunAt: '2026-05-31T20:00:00Z',
      schedulerStartedAt: '2026-05-31T17:00:00Z',
      lastCycleStartedAt: '2026-05-31T19:00:00Z',
      lastFunctionalState: 'paused',
    },
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 0,
    nowMs: now,
  });

  assert.equal(derived.schedulerFunctionalState, 'paused');
  assert.equal(derived.controllerProgressState, 'paused_waiting_manual_external_gate');
  assert.equal(derived.shouldWarnCloudTaskListEmpty, false);
});

test('backlog pausado com alvos paralelos elegiveis mostra ready_for_more_parallel_work', () => {
  const derived = deriveMonitorState({
    resolvedTarget: pausedTarget('bloqueado'),
    runtimeState: {
      nextScheduledRunAt: '2026-05-31T20:00:00Z',
      schedulerStartedAt: '2026-05-31T17:00:00Z',
      lastCycleStartedAt: '2026-05-31T19:00:00Z',
      lastFunctionalState: 'paused',
      lastParallelEligibleTargets: ['tenant-white-label/publicacao', 'identidade-acesso/publicacao'],
    },
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 0,
    nowMs: now,
  });

  assert.equal(derived.schedulerFunctionalState, 'ready');
  assert.equal(derived.controllerProgressState, 'ready_for_more_parallel_work');
});

test('health degradado mostra degraded_health', () => {
  const derived = deriveMonitorState({
    resolvedTarget: actionableTarget(),
    runtimeState: {
      nextScheduledRunAt: '2026-05-31T20:00:00Z',
      schedulerStartedAt: '2026-05-31T17:00:00Z',
      lastCycleStartedAt: '2026-05-31T19:00:00Z',
    },
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 0,
    healthState: 'degraded',
    nowMs: now,
  });

  assert.equal(derived.schedulerFunctionalState, 'degraded');
  assert.equal(derived.controllerProgressState, 'degraded_health');
});

test('remote deploy em andamento mostra running_remote_deploy e nao alerta task vazia', () => {
  const derived = deriveMonitorState({
    resolvedTarget: pausedTarget('bloqueado'),
    runtimeState: {
      nextScheduledRunAt: '2026-05-31T20:00:00Z',
      schedulerStartedAt: '2026-05-31T17:00:00Z',
      lastCycleStartedAt: '2026-05-31T19:00:00Z',
      lastRemoteActionState: 'running_remote_deploy',
    },
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 0,
    nowMs: now,
  });

  assert.equal(derived.schedulerFunctionalState, 'ready');
  assert.equal(derived.controllerProgressState, 'running_remote_deploy');
  assert.equal(derived.shouldWarnCloudTaskListEmpty, false);
});

test('remote smoke em andamento mostra running_remote_smoke', () => {
  const derived = deriveMonitorState({
    resolvedTarget: pausedTarget('bloqueado'),
    runtimeState: {
      nextScheduledRunAt: '2026-05-31T20:00:00Z',
      schedulerStartedAt: '2026-05-31T17:00:00Z',
      lastCycleStartedAt: '2026-05-31T19:00:00Z',
      lastRemoteActionState: 'running_remote_smoke',
    },
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 0,
    nowMs: now,
  });

  assert.equal(derived.controllerProgressState, 'running_remote_smoke');
});

test('dependencia pronta mostra ready_for_dependency_cycle', () => {
  const derived = deriveMonitorState({
    resolvedTarget: dependencyTarget(),
    runtimeState: {
      nextScheduledRunAt: '2026-05-31T20:00:00Z',
      schedulerStartedAt: '2026-05-31T17:00:00Z',
      lastCycleStartedAt: '2026-05-31T19:00:00Z',
    },
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 0,
    nowMs: now,
  });

  assert.equal(derived.controllerProgressState, 'ready_for_dependency_cycle');
  assert.equal(derived.shouldWarnCloudTaskListEmpty, false);
});

test('dependencia em andamento mostra dependency_cycle_running', () => {
  const derived = deriveMonitorState({
    resolvedTarget: dependencyTarget(),
    runtimeState: {
      nextScheduledRunAt: '2026-05-31T20:00:00Z',
      schedulerStartedAt: '2026-05-31T17:00:00Z',
      lastCycleStartedAt: '2026-05-31T19:00:00Z',
      activeTasks: [
        {
          taskId: 'task_1',
          responsibility: 'tenant-white-label',
          cycle: 'deploy',
          state: 'pending',
          dependencyParentResponsibility: 'gateway-borda',
          dependencyParentCycle: 'publicacao',
        },
      ],
    },
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 1,
    nowMs: now,
  });

  assert.equal(derived.controllerProgressState, 'dependency_chain_in_progress');
});

test('task cloud ativa mostra parallel_tasks_running fora da cadeia de dependencia', () => {
  const derived = deriveMonitorState({
    resolvedTarget: actionableTarget(),
    runtimeState: {
      nextScheduledRunAt: '2026-05-31T20:00:00Z',
      schedulerStartedAt: '2026-05-31T17:00:00Z',
      lastCycleStartedAt: '2026-05-31T19:00:00Z',
      activeTasks: [
        {
          taskId: 'task_1',
          responsibility: 'tenant-white-label',
          cycle: 'deploy',
          state: 'pending',
        },
      ],
    },
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 1,
    latestCloudTaskStatus: 'pending',
    nowMs: now,
  });

  assert.equal(derived.controllerProgressState, 'parallel_tasks_running');
  assert.equal(derived.shouldWarnCloudTaskListEmpty, false);
});

test('target pausado com tasks paralelas ativas nao rebaixa scheduler para paused', () => {
  const derived = deriveMonitorState({
    resolvedTarget: pausedTarget('bloqueado'),
    runtimeState: {
      nextScheduledRunAt: '2026-05-31T20:00:00Z',
      schedulerStartedAt: '2026-05-31T17:00:00Z',
      lastCycleStartedAt: '2026-05-31T19:00:00Z',
      lastFunctionalState: 'paused',
      activeTasks: [
        {
          taskId: 'task_1',
          responsibility: 'tenant-white-label',
          cycle: 'publicacao',
          state: 'pending',
        },
      ],
    },
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 1,
    latestCloudTaskStatus: 'pending',
    nowMs: now,
  });

  assert.equal(derived.schedulerFunctionalState, 'ready');
  assert.equal(derived.controllerProgressState, 'parallel_tasks_running');
});

test('cadeia de dependencias em progresso mostra dependency_chain_in_progress', () => {
  const derived = deriveMonitorState({
    resolvedTarget: dependencyTarget(),
    runtimeState: {
      lastMergedAt: '2026-05-31T21:20:00Z',
      nextScheduledRunAt: '2026-05-31T22:00:00Z',
      schedulerStartedAt: '2026-05-31T20:00:00Z',
      lastCycleStartedAt: '2026-05-31T21:00:00Z',
      lastDependencyParentResponsibility: 'gateway-borda',
      lastDependencyTargetResponsibility: 'tenant-white-label',
      lastDependencyState: 'ready_for_dependency_cycle',
    },
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 0,
    nowMs: now,
  });

  assert.equal(derived.controllerProgressState, 'dependency_chain_in_progress');
});

test('fila de publicacao pronta tem prioridade sobre task mais recente pendente', () => {
  const derived = deriveMonitorState({
    resolvedTarget: actionableTarget(),
    runtimeState: {
      nextScheduledRunAt: '2026-05-31T20:00:00Z',
      schedulerStartedAt: '2026-05-31T17:00:00Z',
      lastCycleStartedAt: '2026-05-31T19:00:00Z',
      activeTasks: [
        {
          taskId: 'task_ready',
          responsibility: 'tenant-white-label',
          cycle: 'publicacao',
          state: 'ready',
        },
        {
          taskId: 'task_pending',
          responsibility: 'onboarding-acesso',
          cycle: 'deploy',
          state: 'pending',
        },
      ],
      publishQueue: ['task_ready'],
    },
    mainSha: 'abc123',
    openControllerPrState: 'none',
    cloudTaskCount: 2,
    latestCloudTaskStatus: 'pending',
    nowMs: now,
  });

  assert.equal(derived.publishQueueCount, 1);
  assert.equal(derived.controllerProgressState, 'publish_queue_pending');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeResolvedTargetState,
  determineFinalCycleState,
  reconcileTrackedTaskPool,
  shouldAttemptRemoteGate,
  shouldSubmitControllerTask,
} from '../scheduler.mjs';

function actionableTarget(overrides = {}) {
  return {
    state: 'actionable',
    responsibility: 'tenant-white-label',
    cycle: 'deploy',
    cycleRow: {
      status: 'pronto',
      gate: 'processo',
      evidence: 'PR verde.',
      blocker: '—',
      nextAction: 'Executar deploy.',
    },
    ...overrides,
  };
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
      evidence: 'Gate remoto pendente.',
      blocker: 'Aguardando gate remoto.',
      nextAction: 'Executar gate remoto.',
    },
  };
}

test('target pausado sem PR aberta nao deve submeter task nova', () => {
  assert.equal(
    shouldSubmitControllerTask({
      resolvedTarget: pausedTarget(),
      healthState: 'ready',
      openControllerPrState: 'none',
    }),
    false,
  );
});

test('health degradado bloqueia submissao mesmo com target acionavel', () => {
  assert.equal(
    shouldSubmitControllerTask({
      resolvedTarget: actionableTarget(),
      healthState: 'degraded',
      openControllerPrState: 'none',
    }),
    false,
  );
});

test('task ativa em pending bloqueia re-submissao duplicada', () => {
  assert.equal(
    shouldSubmitControllerTask({
      resolvedTarget: actionableTarget(),
      healthState: 'ready',
      openControllerPrState: 'none',
      activeTaskState: 'pending',
    }),
    false,
  );
});

test('pool cheio bloqueia nova submissao', () => {
  assert.equal(
    shouldSubmitControllerTask({
      resolvedTarget: actionableTarget(),
      healthState: 'ready',
      openControllerPrState: 'none',
      activeTaskCount: 4,
      maxParallelTasks: 4,
    }),
    false,
  );
});

test('remote gate nao roda enquanto existir alvo paralelo elegivel', () => {
  assert.equal(
    shouldAttemptRemoteGate({
      resolvedTarget: pausedTarget(),
      remoteAutomationAvailable: true,
      activeTaskCount: 0,
      publishQueueCount: 0,
      parallelEligibleCount: 2,
    }),
    false,
  );
});

test('remote gate roda apenas quando backlog paralelo estiver vazio', () => {
  assert.equal(
    shouldAttemptRemoteGate({
      resolvedTarget: pausedTarget(),
      remoteAutomationAvailable: true,
      activeTaskCount: 0,
      publishQueueCount: 0,
      parallelEligibleCount: 0,
    }),
    true,
  );
});

test('merge que mantem mesmo par pausado termina como paused', () => {
  const result = determineFinalCycleState({
    targetBefore: actionableTarget({
      responsibility: 'gateway-borda',
      cycle: 'deploy',
    }),
    targetAfter: pausedTarget('bloqueado'),
    openControllerPrState: 'merged',
    mergedSha: 'abc123',
  });

  assert.equal(result.finalState, 'paused');
  assert.equal(result.functionalState, 'paused');
  assert.equal(result.lastError, null);
});

test('describeResolvedTargetState trata bloqueio pausado como paused', () => {
  const state = describeResolvedTargetState(pausedTarget('validacao'));
  assert.equal(state.cycleState, 'paused');
  assert.equal(state.functionalState, 'paused');
  assert.equal(state.pauseStatus, 'validacao');
});

test('merge remoto que tira alvo de paused para próximo ciclo conta como merged funcional', () => {
  const result = determineFinalCycleState({
    targetBefore: pausedTarget('bloqueado'),
    targetAfter: actionableTarget({
      responsibility: 'gateway-borda',
      cycle: 'backend',
    }),
    openControllerPrState: 'merged',
    mergedSha: 'def456',
  });

  assert.equal(result.finalState, 'merged');
  assert.equal(result.functionalState, 'ready');
  assert.equal(result.lastError, null);
});

test('reconcileTrackedTaskPool marca duplicata antiga como superseded', () => {
  const reconciled = reconcileTrackedTaskPool([
    {
      taskId: 'task_old',
      responsibility: 'identidade-acesso',
      cycle: 'deploy',
      signature: '{"responsibility":"identidade-acesso","cycle":"deploy","status":"pronto","gate":"processo"}',
      baselineMainSha: 'aaa111',
      submittedAt: '2026-06-01T04:00:00Z',
      state: 'ready',
    },
    {
      taskId: 'task_new',
      responsibility: 'identidade-acesso',
      cycle: 'deploy',
      signature: '{"responsibility":"identidade-acesso","cycle":"deploy","status":"pronto","gate":"processo"}',
      baselineMainSha: 'bbb222',
      submittedAt: '2026-06-01T05:00:00Z',
      state: 'pending',
    },
  ]);

  const oldTask = reconciled.find((task) => task.taskId === 'task_old');
  const newTask = reconciled.find((task) => task.taskId === 'task_new');
  assert.equal(newTask.state, 'pending');
  assert.equal(oldTask.state, 'superseded');
  assert.match(oldTask.supersededReason, /superseded_by=task_new/);
});

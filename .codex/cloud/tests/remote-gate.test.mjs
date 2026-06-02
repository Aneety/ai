import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDatabaseValidationEvidence,
  buildPublicationEvidence,
  buildWorkflowDispatchNonce,
  getRemoteAutomationKind,
  getRemoteAutomationRunbook,
  mapMissingServicesToDependencies,
  parseDatabaseGateResult,
  parseRemoteGateResult,
  REMOTE_AUTOMATION_KIND,
  updateDatabaseValidationDocs,
  updateWorkerDeployDocs,
  updateWorkerPublicationDocs,
  updateGatewayPublicationDocs,
} from '../remote-gate.mjs';

test('classifica gateway-borda/publicacao como remote_automable', () => {
  const kind = getRemoteAutomationKind({
    state: 'blocked',
    blockKind: 'pause',
    responsibility: 'gateway-borda',
    cycle: 'publicacao',
    cycleRow: {
      status: 'bloqueado',
      gate: 'processo',
      blocker: 'Falta URL remota.',
      nextAction: 'Executar deploy.',
    },
  });

  assert.equal(kind, REMOTE_AUTOMATION_KIND.REMOTE_AUTOMABLE);
});

test('classifica tenant-white-label/deploy em validacao como remote_automable', () => {
  const target = {
    state: 'blocked',
    blockKind: 'pause',
    responsibility: 'tenant-white-label',
    cycle: 'deploy',
    pauseStatus: 'validacao',
    cycleRow: {
      status: 'validacao',
      gate: 'processo',
      blocker: 'Aguardando Cloudflare dry-run.',
      nextAction: 'Executar gate remoto.',
    },
  };

  assert.equal(getRemoteAutomationKind(target), REMOTE_AUTOMATION_KIND.REMOTE_AUTOMABLE);
  assert.equal(
    getRemoteAutomationRunbook(target)?.modulePath,
    'aneety-platform/apps/tenant-white-label/worker-tenant-white-label',
  );
});

test('classifica tenant-white-label/publicacao bloqueado como remote_automable', () => {
  const target = {
    state: 'blocked',
    blockKind: 'pause',
    responsibility: 'tenant-white-label',
    cycle: 'publicacao',
    pauseStatus: 'bloqueado',
    cycleRow: {
      status: 'bloqueado',
      gate: 'processo',
      blocker: 'Falta URL remota.',
      nextAction: 'Executar deploy e smoke remotos.',
    },
  };

  assert.equal(getRemoteAutomationKind(target), REMOTE_AUTOMATION_KIND.REMOTE_AUTOMABLE);
  assert.equal(
    getRemoteAutomationRunbook(target)?.evidenceFile,
    'aneety-platform/apps/tenant-white-label/worker-tenant-white-label/publication-evidence.json',
  );
});

test('classifica tenant-white-label/banco em validacao como remote_automable', () => {
  const target = {
    state: 'blocked',
    blockKind: 'pause',
    responsibility: 'tenant-white-label',
    cycle: 'banco',
    pauseStatus: 'validacao',
    cycleRow: {
      status: 'validacao',
      gate: 'DB',
      blocker: 'Aguardando validação D1-backed.',
      nextAction: 'Executar gate remoto D1.',
    },
  };

  assert.equal(getRemoteAutomationKind(target), REMOTE_AUTOMATION_KIND.REMOTE_AUTOMABLE);
  assert.equal(
    getRemoteAutomationRunbook(target)?.evidenceFile,
    'aneety-platform/apps/tenant-white-label/db-tenant-white-label/d1-validation-evidence.json',
  );
});

test('parseRemoteGateResult normaliza payload JSON', () => {
  const result = parseRemoteGateResult({
    mode: 'deploy',
    modulePath: 'aneety-platform/apps/gateway-borda/worker-gateway',
    headSha: 'abc',
    runId: 123,
    runUrl: 'https://github.com/Aneety/ai/actions/runs/123',
    conclusion: 'success',
    publishedUrl: 'https://aneety.example.workers.dev',
    smokeUrl: '',
    smokeStatus: '',
    controllerNonce: 'nonce-1',
    failureCode: '10143',
    failureReason: 'service_binding_missing',
    missingServices: ['worker-identidade-acesso'],
  });

  assert.equal(result.mode, 'deploy');
  assert.equal(result.runId, '123');
  assert.equal(result.controllerNonce, 'nonce-1');
  assert.equal(result.failureCode, '10143');
  assert.deepEqual(result.missingServices, ['worker-identidade-acesso']);
});

test('parseDatabaseGateResult normaliza payload JSON do gate D1', () => {
  const result = parseDatabaseGateResult({
    mode: 'validate',
    modulePath: 'aneety-platform/apps/tenant-white-label/db-tenant-white-label',
    headSha: 'abc',
    runId: 456,
    runUrl: 'https://github.com/Aneety/ai/actions/runs/456',
    conclusion: 'success',
    controllerNonce: 'nonce-2',
    responsibility: 'tenant-white-label',
    cycle: 'banco',
    runtime: 'cloudflare-workers',
    binding: 'TENANT_WHITE_LABEL_DB',
    databaseName: 'tenant-white-label-db',
    migrationFiles: ['migrations/0001_tenant_white_label_d1.sql'],
    seedFiles: ['seeds/0001_lia_demo_brand.sql'],
    fixtureFiles: ['tests/tenant-isolation-fixture.sql'],
    rollbackFiles: ['rollbacks/0001_tenant_white_label_d1.sql'],
    steps: {
      validate: { status: 'success', detail: 'ok' },
      create: { status: 'success', detail: 'ok' },
      migrate: { status: 'success', detail: 'ok' },
      seed: { status: 'success', detail: 'ok' },
      fixture: { status: 'success', detail: 'ok' },
      rollback: { status: 'success', detail: 'ok' },
      cleanup: { status: 'success', detail: 'ok' },
    },
    validatedAt: '2026-06-02T10:00:00Z',
  });

  assert.equal(result.runId, '456');
  assert.equal(result.databaseName, 'tenant-white-label-db');
  assert.deepEqual(result.fixtureFiles, ['tests/tenant-isolation-fixture.sql']);
  assert.equal(result.steps.cleanup.status, 'success');
});

test('mapMissingServicesToDependencies converte services conhecidos em ciclos deploy', () => {
  const mapped = mapMissingServicesToDependencies([
    'worker-identidade-acesso',
    'worker-tenant-white-label',
    'worker-onboarding-acesso',
    'worker-desconhecido',
  ]);

  assert.deepEqual(mapped.mapped, [
    {
      service: 'worker-identidade-acesso',
      responsibility: 'identidade-acesso',
      cycle: 'deploy',
    },
    {
      service: 'worker-tenant-white-label',
      responsibility: 'tenant-white-label',
      cycle: 'deploy',
    },
    {
      service: 'worker-onboarding-acesso',
      responsibility: 'onboarding-acesso',
      cycle: 'deploy',
    },
  ]);
  assert.deepEqual(mapped.unmapped, ['worker-desconhecido']);
});

test('buildPublicationEvidence gera contrato mínimo esperado', () => {
  const evidence = buildPublicationEvidence({
    publishedUrl: 'https://aneety.example.workers.dev',
    headSha: '0123456789abcdef0123456789abcdef01234567',
    deployRunId: '10',
    deployRunUrl: 'https://github.com/Aneety/ai/actions/runs/10',
    smokeRunId: '11',
    smokeRunUrl: 'https://github.com/Aneety/ai/actions/runs/11',
    validatedAt: '2026-06-01T03:00:00Z',
    costProofValidatedAt: '2026-06-02T20:40:41Z',
    servicesChecked: 3,
  });

  assert.deepEqual(evidence, {
    responsibility: 'gateway-borda',
    cycle: 'publicacao',
    modulePath: 'aneety-platform/apps/gateway-borda/worker-gateway',
    deployRunId: '10',
    deployRunUrl: 'https://github.com/Aneety/ai/actions/runs/10',
    smokeRunId: '11',
    smokeRunUrl: 'https://github.com/Aneety/ai/actions/runs/11',
    publishedUrl: 'https://aneety.example.workers.dev',
    headSha: '0123456789abcdef0123456789abcdef01234567',
    validatedAt: '2026-06-01T03:00:00Z',
    costProofRef: 'docs/ai-guardrails/cost-proofs/current-services.json',
    costProofValidatedAt: '2026-06-02T20:40:41Z',
    servicesChecked: 3,
    costResult: 'free',
    result: 'success',
  });
});

test('buildDatabaseValidationEvidence gera contrato mínimo esperado', () => {
  const evidence = buildDatabaseValidationEvidence({
    responsibility: 'tenant-white-label',
    modulePath: 'aneety-platform/apps/tenant-white-label/db-tenant-white-label',
    binding: 'TENANT_WHITE_LABEL_DB',
    databaseName: 'tenant-white-label-db',
    headSha: '0123456789abcdef0123456789abcdef01234567',
    runId: '20',
    runUrl: 'https://github.com/Aneety/ai/actions/runs/20',
    controllerNonce: 'tenant-white-label-banco-validate-20260602094427',
    migrationFiles: ['migrations/0001_tenant_white_label_d1.sql'],
    seedFiles: ['seeds/0001_lia_demo_brand.sql'],
    fixtureFiles: ['tests/tenant-isolation-fixture.sql'],
    rollbackFiles: ['rollbacks/0001_tenant_white_label_d1.sql'],
    steps: {
      validate: { status: 'success', detail: 'ok' },
      create: { status: 'success', detail: 'ok' },
      migrate: { status: 'success', detail: 'ok' },
      seed: { status: 'success', detail: 'ok' },
      fixture: { status: 'success', detail: 'ok' },
      rollback: { status: 'success', detail: 'ok' },
      cleanup: { status: 'success', detail: 'ok' },
    },
    validatedAt: '2026-06-02T10:00:00Z',
  });

  assert.equal(evidence.cycle, 'banco');
  assert.equal(evidence.databaseName, 'tenant-white-label-db');
  assert.equal(evidence.steps.migrate.status, 'success');
});

test('updateGatewayPublicationDocs conclui publicacao e aponta backend como próximo ciclo', () => {
  const sourceGatewayMarkdown = `| \`publicacao\` | \`bloqueado\` | alta | \`processo\` | — | Sem URL. | Executar deploy. |\n| \`backend\` | \`triagem\` | alta | \`backend\` | — | Aguardando publicacao. | Executar backend depois. |`;
  const sourceIndexMarkdown =
    '| `gateway-borda` | Ricardo Malnati | alta | `publicacao` | `bloqueado` | [gateway-borda](./gateway-borda.md) | — | Sem URL. |';

  const updated = updateGatewayPublicationDocs({
    gatewayMarkdown: sourceGatewayMarkdown,
    indexMarkdown: sourceIndexMarkdown,
    publishedUrl: 'https://aneety.example.workers.dev',
    headSha: '0123456789abcdef0123456789abcdef01234567',
    deployRunUrl: 'https://github.com/Aneety/ai/actions/runs/10',
    smokeRunUrl: 'https://github.com/Aneety/ai/actions/runs/11',
  });

  assert.match(updated.gatewayMarkdown, /\| `publicacao` \| `concluido` \|/);
  assert.match(updated.gatewayMarkdown, /\| `backend` \| `triagem` \|/);
  assert.match(updated.indexMarkdown, /\| `gateway-borda` \| Ricardo Malnati \| alta \| `backend` \| `triagem` \|/);
});

test('updateWorkerDeployDocs conclui deploy e aponta publicacao como próximo ciclo', () => {
  const sourceResponsibilityMarkdown =
    '| `deploy` | `validacao` | alta | `processo` | — | Aguardando dry-run. | Executar dry-run. |\n' +
    '| `publicacao` | `triagem` | alta | `processo` | — | Aguardando deploy. | Executar publicacao depois. |';
  const sourceIndexMarkdown =
    '| `tenant-white-label` | Ricardo Malnati | alta | `deploy` | `validacao` | [tenant-white-label](./tenant-white-label.md) | — | Aguardando dry-run. |';

  const updated = updateWorkerDeployDocs({
    responsibility: 'tenant-white-label',
    responsibilityMarkdown: sourceResponsibilityMarkdown,
    indexMarkdown: sourceIndexMarkdown,
    headSha: '0123456789abcdef0123456789abcdef01234567',
    dryRunUrl: 'https://github.com/Aneety/ai/actions/runs/123',
  });

  assert.match(updated.responsibilityMarkdown, /\| `deploy` \| `concluido` \|/);
  assert.match(updated.responsibilityMarkdown, /\| `publicacao` \| `triagem` \| alta \| `processo` \| — \| — \| Executar `publicacao`/);
  assert.match(updated.indexMarkdown, /\| `tenant-white-label` \| Ricardo Malnati \| alta \| `publicacao` \| `triagem` \|/);
});

test('updateWorkerPublicationDocs conclui publicacao e aponta banco como próximo ciclo', () => {
  const sourceResponsibilityMarkdown =
    '| `publicacao` | `bloqueado` | alta | `processo` | — | Sem URL real. | Executar publicacao remota. |\n' +
    '| `banco` | `triagem` | alta | `DB` | — | Aguardando publicacao. | Executar banco depois. |';
  const sourceIndexMarkdown =
    '| `tenant-white-label` | Ricardo Malnati | alta | `publicacao` | `bloqueado` | [tenant-white-label](./tenant-white-label.md) | — | Sem URL real. |';

  const updated = updateWorkerPublicationDocs({
    responsibility: 'tenant-white-label',
    responsibilityMarkdown: sourceResponsibilityMarkdown,
    indexMarkdown: sourceIndexMarkdown,
    publishedUrl: 'https://aneety-worker-tenant-white-label.workers.dev',
    headSha: '0123456789abcdef0123456789abcdef01234567',
    deployRunUrl: 'https://github.com/Aneety/ai/actions/runs/123',
    smokeRunUrl: 'https://github.com/Aneety/ai/actions/runs/124',
  });

  assert.match(updated.responsibilityMarkdown, /\| `publicacao` \| `concluido` \|/);
  assert.match(updated.responsibilityMarkdown, /\| `banco` \| `triagem` \| alta \| `DB` \| — \| — \| Executar `banco`/);
  assert.match(updated.indexMarkdown, /\| `tenant-white-label` \| Ricardo Malnati \| alta \| `banco` \| `triagem` \|/);
});

test('updateDatabaseValidationDocs conclui banco e aponta backend como próximo ciclo', () => {
  const sourceResponsibilityMarkdown =
    '| `banco` | `validacao` | alta | `DB` | — | Aguardando validação D1-backed. | Executar gate remoto D1. |\n' +
    '| `backend` | `triagem` | alta | `backend` | — | Aguardando banco. | Executar backend depois. |';
  const sourceIndexMarkdown =
    '| `tenant-white-label` | Ricardo Malnati | alta | `banco` | `validacao` | [tenant-white-label](./tenant-white-label.md) | — | Aguardando validação D1-backed. |';

  const updated = updateDatabaseValidationDocs({
    responsibility: 'tenant-white-label',
    responsibilityMarkdown: sourceResponsibilityMarkdown,
    indexMarkdown: sourceIndexMarkdown,
    headSha: '0123456789abcdef0123456789abcdef01234567',
    runUrl: 'https://github.com/Aneety/ai/actions/runs/456',
  });

  assert.match(updated.responsibilityMarkdown, /\| `banco` \| `concluido` \|/);
  assert.match(updated.responsibilityMarkdown, /\| `backend` \| `triagem` \| alta \| `backend` \| — \| — \| Executar `backend`/);
  assert.match(updated.indexMarkdown, /\| `tenant-white-label` \| Ricardo Malnati \| alta \| `backend` \| `triagem` \|/);
});

test('buildWorkflowDispatchNonce inclui responsabilidade, ciclo e estágio', () => {
  const nonce = buildWorkflowDispatchNonce({
    responsibility: 'gateway-borda',
    cycle: 'publicacao',
    stage: 'deploy',
    now: new Date('2026-06-01T03:04:05Z'),
  });

  assert.match(nonce, /^gateway-borda-publicacao-deploy-20260601030405$/);
});

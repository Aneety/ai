import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicationEvidence,
  buildWorkflowDispatchNonce,
  getRemoteAutomationKind,
  mapMissingServicesToDependencies,
  parseRemoteGateResult,
  REMOTE_AUTOMATION_KIND,
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
    result: 'success',
  });
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

test('buildWorkflowDispatchNonce inclui responsabilidade, ciclo e estágio', () => {
  const nonce = buildWorkflowDispatchNonce({
    responsibility: 'gateway-borda',
    cycle: 'publicacao',
    stage: 'deploy',
    now: new Date('2026-06-01T03:04:05Z'),
  });

  assert.match(nonce, /^gateway-borda-publicacao-deploy-20260601030405$/);
});

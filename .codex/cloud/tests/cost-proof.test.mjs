import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertPublicationCostProof,
  validateCostProofDocument,
} from '../validate-cost-proof.mjs';

const now = new Date('2026-06-02T12:00:00Z');

function validService(overrides = {}) {
  return {
    provider: 'GitHub',
    service: 'GitHub Actions standard runners',
    planName: 'GitHub Free for public repositories',
    pricingSourceUrl: 'https://docs.github.com/en/billing/concepts/product-billing/github-actions',
    pricingCheckedAt: '2026-06-02T10:00:00Z',
    usageSource: 'gh run list --repo Aneety/ai --limit 1000',
    observedUsage: { quantity: 231.92, unit: 'minutes/month-to-date' },
    periodStart: '2026-06-01T00:00:00Z',
    periodEnd: '2026-06-30T23:59:59Z',
    freeAllowance: { unlimited: true, unit: 'minutes/month', label: 'public repositories standard runners' },
    projectedUsage: { quantity: 3739.64, unit: 'minutes/month' },
    projectedCostUsd: 0,
    status: 'free',
    calculation: 'Public repositories using standard GitHub-hosted runners are free; projected usage does not create billed minutes.',
    ...overrides,
  };
}

function validProof(overrides = {}) {
  return {
    project: 'Aneety/ai',
    validatedAt: '2026-06-02T10:00:00Z',
    validUntil: '2026-06-09T10:00:00Z',
    result: 'free',
    services: [validService()],
    ...overrides,
  };
}

test('validateCostProofDocument aceita prova vigente com servicos gratuitos', () => {
  const result = validateCostProofDocument(validProof(), { now });
  assert.equal(result.result, 'free');
  assert.equal(result.servicesChecked, 1);
});

test('validateCostProofDocument bloqueia prova expirada', () => {
  assert.throws(
    () => validateCostProofDocument(validProof({ validUntil: '2026-06-01T00:00:00Z' }), { now }),
    /validUntil must be in the future/,
  );
});

test('validateCostProofDocument bloqueia validUntil acima de 7 dias de validatedAt', () => {
  assert.throws(
    () => validateCostProofDocument(validProof({ validUntil: '2026-06-10T10:00:01Z' }), { now }),
    /validUntil must be at most 7 days after validatedAt/,
  );
});

test('validateCostProofDocument bloqueia servico pago ou desconhecido', () => {
  for (const status of ['paid', 'unknown', 'expired']) {
    assert.throws(
      () => validateCostProofDocument(validProof({ services: [validService({ status })] }), { now }),
      /service status must be free/,
    );
  }
});

test('validateCostProofDocument bloqueia consumo projetado acima da franquia numerica', () => {
  assert.throws(
    () =>
      validateCostProofDocument(
        validProof({
          services: [
            validService({
              freeAllowance: { quantity: 100, unit: 'requests/day' },
              projectedUsage: { quantity: 101, unit: 'requests/day' },
            }),
          ],
        }),
        { now },
      ),
    /projectedUsage exceeds freeAllowance/,
  );
});

test('assertPublicationCostProof exige referencia versionada em publication-evidence', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'aneety-cost-proof-'));
  try {
    const proofRef = 'docs/ai-guardrails/cost-proofs/current-services.json';
    const proofPath = path.join(tempDir, proofRef);
    await mkdir(path.dirname(proofPath), { recursive: true });
    await writeFile(proofPath, `${JSON.stringify(validProof(), null, 2)}\n`);

    const evidence = {
      costProofRef: proofRef,
      costProofValidatedAt: '2026-06-02T10:00:00Z',
      servicesChecked: 1,
      costResult: 'free',
    };

    const result = await assertPublicationCostProof(evidence, { repoRoot: tempDir, now });
    assert.equal(result.servicesChecked, 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('assertPublicationCostProof bloqueia publication-evidence sem prova de custo', async () => {
  await assert.rejects(
    () => assertPublicationCostProof({}, { repoRoot: os.tmpdir(), now }),
    /costProofRef must not be empty/,
  );
});

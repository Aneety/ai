import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { CONTRACT_VERSION } from '../src/index.js';

const scriptPath = fileURLToPath(new URL('../scripts/validate-publication-evidence.mjs', import.meta.url));

function runValidator(evidenceFile) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      ANEETY_PUBLICATION_EVIDENCE_FILE: evidenceFile,
    },
    encoding: 'utf8',
  });
}

async function writeEvidence(overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'onboarding-publication-evidence-'));
  const evidenceFile = join(dir, 'publication-evidence.json');
  const evidence = {
    responsibility: 'onboarding-acesso',
    cycle: 'publicacao',
    template: false,
    modulePath: 'aneety-platform/apps/onboarding-acesso/worker-onboarding-acesso',
    contractVersion: CONTRACT_VERSION,
    deployRunId: '26737997590',
    deployRunUrl: 'https://github.com/Aneety/ai/actions/runs/26737997590',
    smokeRunId: '26737997591',
    smokeRunUrl: 'https://github.com/Aneety/ai/actions/runs/26737997591',
    publishedUrl: 'https://worker-onboarding-acesso.aneety.workers.dev',
    headSha: '444e8d04fa94613dbbf3affca5bcbfaedfd92a5f',
    validatedAt: '2026-06-01T00:00:00Z',
    result: 'success',
    costProofRef: 'docs/ai-guardrails/cost-proofs/current-services.json',
    costProofValidatedAt: '2026-06-02T21:40:57Z',
    servicesChecked: 6,
    costResult: 'free',
    ...overrides,
  };

  await writeFile(evidenceFile, JSON.stringify(evidence, null, 2));
  return evidenceFile;
}

test('publication evidence validator accepts a real remote evidence shape', async () => {
  const result = runValidator(await writeEvidence());

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Publication evidence validation OK/);
});

test('publication evidence validator rejects placeholder values outside the bundled example', async () => {
  const result = runValidator(await writeEvidence({
    deployRunId: '00000000000',
    deployRunUrl: 'https://github.com/Aneety/ai/actions/runs/00000000000',
    publishedUrl: 'https://aneety-worker-onboarding-acesso.placeholder.workers.dev',
    headSha: '0000000000000000000000000000000000000000',
  }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /placeholder/);
});

test('publication evidence validator rejects mismatched run ids and URLs', async () => {
  const result = runValidator(await writeEvidence({
    deployRunId: '26737997590',
    deployRunUrl: 'https://github.com/Aneety/ai/actions/runs/26737997591',
  }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /deployRunUrl must match deployRunId/);
});

test('publication evidence validator rejects secret-like URL parameters', async () => {
  const result = runValidator(await writeEvidence({
    publishedUrl: 'https://worker-onboarding-acesso.aneety.workers.dev?token=hidden',
  }));

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /secret-like/);
});

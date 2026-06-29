import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertPublicationCostProof } from '../../../../../.codex/cloud/validate-cost-proof.mjs';

const moduleRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(moduleRoot, '../../../..');
const examplePath = resolve(moduleRoot, 'publication-evidence.example.json');
const evidencePath = resolve(moduleRoot, 'publication-evidence.json');
const selectedPath = process.env.ANEETY_PUBLICATION_EVIDENCE_FILE
  ? resolve(process.cwd(), process.env.ANEETY_PUBLICATION_EVIDENCE_FILE)
  : (await exists(evidencePath))
    ? evidencePath
    : examplePath;

const evidence = JSON.parse(await readFile(selectedPath, 'utf8'));
const isTemplate = selectedPath === examplePath;
const runUrlPattern = /^https:\/\/github\.com\/Aneety\/ai\/actions\/runs\/\d+$/;
const realUrlPattern = /^https:\/\/[^\s/?#]+(?:\/[^\s?#]*)?(?:\?[^\s#]*)?(?:#[^\s]*)?$/;

assert.equal(evidence.responsibility, 'pagamentos');
assert.equal(evidence.cycle, 'publicacao');
assert.equal(evidence.modulePath, 'aneety-platform/apps/pagamentos/worker-pagamentos');
assert.equal(Boolean(evidence.template), isTemplate, 'Only example evidence may be marked as template.');
assert.match(evidence.deployRunId, /^\d+$/);
assert.match(evidence.deployRunUrl, runUrlPattern);
assert.match(evidence.smokeRunId, /^\d+$/);
assert.match(evidence.smokeRunUrl, runUrlPattern);
assert.match(evidence.publishedUrl, realUrlPattern);
if (!isTemplate) assert.ok(!evidence.publishedUrl.includes('placeholder'), 'Canonical evidence must use real URL.');
assert.match(evidence.headSha, /^[0-9a-f]{40}$/i);
assert.match(evidence.validatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
assert.equal(evidence.result, 'success');
assertInvoiceSmoke(evidence.invoiceSmoke);
await assertPublicationCostProof(evidence, { repoRoot });
console.log(`pagamentos publication evidence OK for ${evidence.publishedUrl}`);

function assertInvoiceSmoke(smoke) {
  assert.equal(typeof smoke, 'object');
  assert.equal(smoke.status, 'success');
  assert.equal(smoke.contentType, 'application/pdf');
  assert.equal(smoke.startsWithPdfMagic, true);
  assert.equal(smoke.htmlLoaded, true);
  assert.equal(typeof smoke.browserMsUsed, 'number');
  assert.ok(smoke.browserMsUsed >= 0 && smoke.browserMsUsed <= 60000);
  assert.equal(smoke.browserDailyFreeAllowanceMs, 600000);
  assert.ok(smoke.browserProjectedDailyMs <= 300000);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

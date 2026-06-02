import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assertPublicationCostProof } from '../../../../../.codex/cloud/validate-cost-proof.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../../..');
const workerDir = resolve(scriptDir, '..');
const bundledTemplatePath = resolve(workerDir, 'publication-evidence.example.json');
const canonicalEvidencePath = resolve(workerDir, 'publication-evidence.json');
const evidencePath = process.env.ANEETY_PUBLICATION_EVIDENCE_FILE
  ? resolve(process.cwd(), process.env.ANEETY_PUBLICATION_EVIDENCE_FILE)
  : (await canAccess(canonicalEvidencePath))
    ? canonicalEvidencePath
    : bundledTemplatePath;

const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
const isBundledTemplate = evidencePath === bundledTemplatePath;
const isCanonicalEvidence = evidencePath === canonicalEvidencePath;
const remoteRunPattern = /^https:\/\/github\.com\/Aneety\/ai\/actions\/runs\/\d+$/;
const remoteUrlPattern = /^https:\/\/[^\s/?#]+(?:\/[^\s?#]*)?(?:\?[^\s#]*)?(?:#[^\s]*)?$/;
const forbiddenHostPattern = /(?:^|\.)(?:localhost|local|test|example)(?::\d+)?$/i;
const placeholderHostPattern = /^aneety-worker-tenant-white-label\.placeholder\.workers\.dev$/i;
const secretLikePattern = /(?:token|secret|password|private|credential|key)=/i;

function assertNonEmptyString(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string.`);
  assert.ok(value.trim(), `${label} must not be empty.`);
  return value.trim();
}

function assertHttpsUrl(value, label, { allowPlaceholder = false } = {}) {
  const url = assertNonEmptyString(value, label);
  assert.match(url, remoteUrlPattern, `${label} must be an HTTPS URL.`);
  assert.ok(!secretLikePattern.test(url), `${label} must not expose secret-like query parameters.`);

  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'https:', `${label} must use HTTPS.`);
  assert.ok(!forbiddenHostPattern.test(parsed.hostname), `${label} must point to an allowed remote environment, not ${parsed.hostname}.`);
  assert.ok(allowPlaceholder || !placeholderHostPattern.test(parsed.hostname), `${label} must use the real Cloudflare Workers URL, not the bundled placeholder.`);

  return url;
}

async function canAccess(candidatePath) {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

assert.equal(evidence.responsibility, 'tenant-white-label', 'Publication evidence must target tenant-white-label.');
assert.equal(evidence.cycle, 'publicacao', 'Publication evidence must target the publicacao cycle.');
assert.equal(evidence.modulePath, 'aneety-platform/apps/tenant-white-label/worker-tenant-white-label', 'Publication evidence must target the canonical Worker module path.');
assert.equal(Boolean(evidence.template), isBundledTemplate, 'Only the bundled example may be marked as a template.');

assertHttpsUrl(evidence.publishedUrl, 'publishedUrl', { allowPlaceholder: isBundledTemplate });
assert.match(assertNonEmptyString(evidence.deployRunId, 'deployRunId'), /^\d+$/, 'deployRunId must be a GitHub Actions numeric id.');
assert.match(assertNonEmptyString(evidence.deployRunUrl, 'deployRunUrl'), remoteRunPattern, 'deployRunUrl must be an Aneety/ai GitHub Actions run URL.');
assert.match(assertNonEmptyString(evidence.smokeRunId, 'smokeRunId'), /^\d+$/, 'smokeRunId must be a GitHub Actions numeric id.');
assert.match(assertNonEmptyString(evidence.smokeRunUrl, 'smokeRunUrl'), remoteRunPattern, 'smokeRunUrl must be an Aneety/ai GitHub Actions run URL.');
assert.match(assertNonEmptyString(evidence.headSha, 'headSha'), /^[0-9a-f]{40}$/i, 'headSha must be a full Git SHA.');
assert.match(assertNonEmptyString(evidence.validatedAt, 'validatedAt'), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'validatedAt must be an UTC timestamp without milliseconds.');
assert.equal(assertNonEmptyString(evidence.result, 'result'), 'success', 'result must be success.');
if (isCanonicalEvidence) {
  assert.equal(Boolean(evidence.template), false, 'The canonical evidence file must not be marked as a template.');
}

await assertPublicationCostProof(evidence, { repoRoot });

console.log(`Publication evidence validation OK for ${evidence.publishedUrl} with zero-cost proof`);

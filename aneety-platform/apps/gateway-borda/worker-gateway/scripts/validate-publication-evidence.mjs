import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { CONTRACT_VERSION } from '../../pkg-contratos-publicos/index.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(scriptDir, '..');
const evidencePath = process.env.ANEETY_PUBLICATION_EVIDENCE_FILE
  ? resolve(process.cwd(), process.env.ANEETY_PUBLICATION_EVIDENCE_FILE)
  : resolve(workerDir, 'publication-evidence.example.json');

const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
const isBundledTemplate = evidencePath === resolve(workerDir, 'publication-evidence.example.json');
const remoteRunPattern = /^https:\/\/github\.com\/Aneety\/ai\/actions\/runs\/\d+$/;
const remoteUrlPattern = /^https:\/\/[^\s/?#]+(?:\/[^\s?#]*)?(?:\?[^\s#]*)?(?:#[^\s]*)?$/;
const forbiddenHostPattern = /(?:^|\.)(?:localhost|local|test|example)(?::\d+)?$/i;
const placeholderHostPattern = /^aneety-worker-gateway-borda\.placeholder\.workers\.dev$/i;
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

assert.equal(evidence.responsibility, 'gateway-borda', 'Publication evidence must target gateway-borda.');
assert.equal(evidence.cycle, 'publicacao', 'Publication evidence must target the publicacao cycle.');
assert.equal(evidence.worker, 'aneety-worker-gateway-borda', 'Publication evidence must target the canonical Worker name.');
assert.equal(Boolean(evidence.template), isBundledTemplate, 'Only the bundled example may be marked as a template.');
assert.equal(evidence.contractVersion, CONTRACT_VERSION, 'Publication evidence must use the current public contract version.');

assertHttpsUrl(evidence.publishedUrl, 'publishedUrl', { allowPlaceholder: isBundledTemplate });
assert.match(assertNonEmptyString(evidence.deployRunUrl, 'deployRunUrl'), remoteRunPattern, 'deployRunUrl must be an Aneety/ai GitHub Actions run URL.');
assert.match(assertNonEmptyString(evidence.smokeRunUrl, 'smokeRunUrl'), remoteRunPattern, 'smokeRunUrl must be an Aneety/ai GitHub Actions run URL.');
assert.match(assertNonEmptyString(evidence.commitSha, 'commitSha'), /^[0-9a-f]{40}$/i, 'commitSha must be a full Git SHA.');
assert.match(assertNonEmptyString(evidence.recordedAt, 'recordedAt'), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'recordedAt must be an UTC timestamp without milliseconds.');
assert.deepEqual(evidence.remoteAcceptance, {
  prGateGreen: true,
  cloudflareDeployMode: 'deploy',
  smokeMode: 'smoke',
}, 'remoteAcceptance must prove PR gate, deploy mode and smoke mode were completed remotely.');

console.log(`Publication evidence validation OK for ${evidence.publishedUrl}`);

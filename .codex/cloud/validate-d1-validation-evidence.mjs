import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const remoteRunPattern = /^https:\/\/github\.com\/Aneety\/ai\/actions\/runs\/\d+$/;
const secretLikePattern = /(?:token|secret|password|private|credential|key)=/i;
const forbiddenUrlPattern = /https?:\/\//i;
const allowedStepStatuses = new Set(['success', 'failed', 'skipped']);

function assertNonEmptyString(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string.`);
  assert.ok(value.trim(), `${label} must not be empty.`);
  return value.trim();
}

function assertRelativePosixPath(value, label) {
  const normalized = assertNonEmptyString(value, label);
  assert.ok(!normalized.startsWith('/'), `${label} must be relative.`);
  assert.ok(!normalized.includes('..'), `${label} must not escape module root.`);
  return normalized;
}

function assertStringArray(value, label) {
  assert.ok(Array.isArray(value), `${label} must be an array.`);
  assert.ok(value.length > 0, `${label} must not be empty.`);
  return value.map((item, index) => assertRelativePosixPath(item, `${label}[${index}]`));
}

function assertStep(value, label) {
  assert.equal(typeof value, 'object', `${label} must be an object.`);
  assert.ok(value, `${label} must not be null.`);
  const status = assertNonEmptyString(value.status, `${label}.status`);
  assert.ok(allowedStepStatuses.has(status), `${label}.status must be success, failed or skipped.`);
  if (value.detail != null) {
    const detail = assertNonEmptyString(value.detail, `${label}.detail`);
    assert.equal(forbiddenUrlPattern.test(detail) && !detail.includes('github.com/Aneety/ai/actions/runs/'), false, `${label}.detail must not embed arbitrary URLs.`);
    assert.equal(secretLikePattern.test(detail), false, `${label}.detail must not expose secrets.`);
  }
  return status;
}

async function canAccess(candidatePath) {
  try {
    await access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadD1ValidationEvidence({ moduleDir, evidenceEnvVar = 'ANEETY_D1_VALIDATION_EVIDENCE_FILE' }) {
  const canonicalEvidencePath = resolve(moduleDir, 'd1-validation-evidence.json');
  const evidencePath = process.env[evidenceEnvVar]
    ? resolve(process.cwd(), process.env[evidenceEnvVar])
    : canonicalEvidencePath;

  const exists = await canAccess(evidencePath);
  assert.equal(exists, true, `D1 validation evidence file not found: ${evidencePath}`);

  return {
    evidencePath,
    canonicalEvidencePath,
    evidence: JSON.parse(await readFile(evidencePath, 'utf8')),
  };
}

export function validateD1ValidationEvidence({
  evidence,
  evidencePath,
  canonicalEvidencePath,
  responsibility,
  modulePath,
  binding,
  databaseName,
}) {
  assert.equal(evidence.responsibility, responsibility, 'D1 validation evidence must target the expected responsibility.');
  assert.equal(evidence.cycle, 'banco', 'D1 validation evidence must target the banco cycle.');
  assert.equal(evidence.runtime, 'cloudflare-workers', 'D1 validation evidence must use the Workers runtime.');
  assert.equal(evidence.modulePath, modulePath, 'D1 validation evidence must target the canonical db module path.');
  assert.equal(evidence.binding, binding, 'D1 validation evidence must use the canonical D1 binding.');
  assert.equal(evidence.databaseName, databaseName, 'D1 validation evidence must use the canonical D1 database name.');
  assert.equal(assertNonEmptyString(evidence.result, 'result'), 'success', 'result must be success.');
  assert.match(assertNonEmptyString(evidence.headSha, 'headSha'), /^[0-9a-f]{40}$/i, 'headSha must be a full Git SHA.');
  assert.match(assertNonEmptyString(evidence.runId, 'runId'), /^\d+$/, 'runId must be a GitHub Actions numeric id.');
  assert.match(assertNonEmptyString(evidence.runUrl, 'runUrl'), remoteRunPattern, 'runUrl must be an Aneety/ai GitHub Actions run URL.');
  assert.match(assertNonEmptyString(evidence.controllerNonce, 'controllerNonce'), /^[a-z0-9-]+$/i, 'controllerNonce must be a non-empty nonce.');
  assert.match(assertNonEmptyString(evidence.validatedAt, 'validatedAt'), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'validatedAt must be an UTC timestamp without milliseconds.');

  assertStringArray(evidence.migrationFiles, 'migrationFiles');
  assertStringArray(evidence.seedFiles, 'seedFiles');
  assertStringArray(evidence.fixtureFiles, 'fixtureFiles');
  assertStringArray(evidence.rollbackFiles, 'rollbackFiles');

  assert.equal(typeof evidence.steps, 'object', 'steps must be an object.');
  assert.ok(evidence.steps, 'steps must not be null.');
  for (const stepName of ['validate', 'create', 'migrate', 'seed', 'fixture', 'rollback', 'cleanup']) {
    assertStep(evidence.steps[stepName], `steps.${stepName}`);
  }

  if (evidencePath === canonicalEvidencePath) {
    assert.equal(Boolean(evidence.template), false, 'The canonical D1 validation evidence file must not be marked as a template.');
  }

  return true;
}

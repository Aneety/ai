import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const DEFAULT_COST_PROOF_REF = 'docs/ai-guardrails/cost-proofs/current-services.json';
const PROJECT = 'Aneety/ai';
const MAX_VALIDITY_DAYS = 7;

function assertNonEmptyString(value, label) {
  assert.equal(typeof value, 'string', `${label} must not be empty.`);
  assert.ok(value.trim(), `${label} must not be empty.`);
  return value.trim();
}

function assertHttpsUrl(value, label) {
  const url = assertNonEmptyString(value, label);
  assert.match(url, /^https:\/\/[^\s]+$/i, `${label} must be an HTTPS URL.`);
  return url;
}

function assertIsoDate(value, label) {
  const raw = assertNonEmptyString(value, label);
  const parsed = new Date(raw);
  assert.ok(!Number.isNaN(parsed.getTime()), `${label} must be a valid ISO date.`);
  return parsed;
}

function assertUsageObject(value, label) {
  assert.equal(typeof value, 'object', `${label} must be an object.`);
  assert.ok(value !== null, `${label} must be an object.`);
  assert.equal(typeof value.unit, 'string', `${label}.unit must be a string.`);
  assert.ok(value.unit.trim(), `${label}.unit must not be empty.`);
  if (value.unlimited === true) {
    return value;
  }
  assert.equal(typeof value.quantity, 'number', `${label}.quantity must be a number.`);
  assert.ok(Number.isFinite(value.quantity), `${label}.quantity must be finite.`);
  assert.ok(value.quantity >= 0, `${label}.quantity must be >= 0.`);
  return value;
}

function assertService(service, index, now) {
  const prefix = `services[${index}]`;
  assert.equal(typeof service, 'object', `${prefix} must be an object.`);
  assert.ok(service !== null, `${prefix} must be an object.`);

  for (const field of ['provider', 'service', 'planName', 'usageSource', 'calculation']) {
    assertNonEmptyString(service[field], `${prefix}.${field}`);
  }
  assertHttpsUrl(service.pricingSourceUrl, `${prefix}.pricingSourceUrl`);

  const pricingCheckedAt = assertIsoDate(service.pricingCheckedAt, `${prefix}.pricingCheckedAt`);
  assert.ok(pricingCheckedAt.getTime() <= now.getTime(), `${prefix}.pricingCheckedAt must not be in the future.`);

  const periodStart = assertIsoDate(service.periodStart, `${prefix}.periodStart`);
  const periodEnd = assertIsoDate(service.periodEnd, `${prefix}.periodEnd`);
  assert.ok(periodEnd.getTime() > periodStart.getTime(), `${prefix}.periodEnd must be after periodStart.`);

  const observedUsage = assertUsageObject(service.observedUsage, `${prefix}.observedUsage`);
  const freeAllowance = assertUsageObject(service.freeAllowance, `${prefix}.freeAllowance`);
  const projectedUsage = assertUsageObject(service.projectedUsage, `${prefix}.projectedUsage`);

  assert.equal(service.status, 'free', `${prefix}.service status must be free.`);
  assert.equal(service.projectedCostUsd, 0, `${prefix}.projectedCostUsd must be 0.`);

  if (freeAllowance.unlimited !== true) {
    assert.equal(
      projectedUsage.unit,
      freeAllowance.unit,
      `${prefix}.projectedUsage.unit must match freeAllowance.unit for numeric allowances.`,
    );
    assert.ok(
      projectedUsage.quantity <= freeAllowance.quantity,
      `${prefix}.projectedUsage exceeds freeAllowance.`,
    );
  }

  return { observedUsage, freeAllowance, projectedUsage };
}

export function validateCostProofDocument(proof, { now = new Date(), maxValidityDays = MAX_VALIDITY_DAYS } = {}) {
  assert.equal(typeof proof, 'object', 'cost proof must be an object.');
  assert.ok(proof !== null, 'cost proof must be an object.');
  assert.equal(proof.project, PROJECT, `project must be ${PROJECT}.`);
  assert.equal(proof.result, 'free', 'result must be free.');

  const validatedAt = assertIsoDate(proof.validatedAt, 'validatedAt');
  const validUntil = assertIsoDate(proof.validUntil, 'validUntil');
  assert.ok(validatedAt.getTime() <= now.getTime(), 'validatedAt must not be in the future.');
  assert.ok(validUntil.getTime() > now.getTime(), 'validUntil must be in the future.');
  const maxValidityMs = maxValidityDays * 24 * 60 * 60 * 1000;
  assert.ok(validUntil.getTime() - validatedAt.getTime() <= maxValidityMs, 'validUntil must be at most 7 days after validatedAt.');

  assert.ok(Array.isArray(proof.services), 'services must be an array.');
  assert.ok(proof.services.length > 0, 'services must not be empty.');
  proof.services.forEach((service, index) => assertService(service, index, now));

  return {
    project: proof.project,
    result: proof.result,
    validatedAt: proof.validatedAt,
    validUntil: proof.validUntil,
    servicesChecked: proof.services.length,
  };
}

export function resolveCostProofPath(ref = DEFAULT_COST_PROOF_REF, { repoRoot = process.cwd() } = {}) {
  const proofRef = assertNonEmptyString(ref, 'costProofRef');
  assert.ok(
    proofRef.startsWith('docs/ai-guardrails/cost-proofs/') && proofRef.endsWith('.json'),
    'costProofRef must point to docs/ai-guardrails/cost-proofs/*.json.',
  );
  const resolved = path.resolve(repoRoot, proofRef);
  const allowedRoot = path.resolve(repoRoot, 'docs/ai-guardrails/cost-proofs');
  assert.ok(resolved.startsWith(`${allowedRoot}${path.sep}`), 'costProofRef must stay under docs/ai-guardrails/cost-proofs.');
  return resolved;
}

export async function loadCostProof(ref = DEFAULT_COST_PROOF_REF, options = {}) {
  const proofPath = resolveCostProofPath(ref, options);
  return JSON.parse(await readFile(proofPath, 'utf8'));
}

export async function assertPublicationCostProof(evidence, { repoRoot = process.cwd(), now = new Date() } = {}) {
  assert.equal(typeof evidence, 'object', 'publication evidence must be an object.');
  assert.ok(evidence !== null, 'publication evidence must be an object.');

  const costProofRef = assertNonEmptyString(evidence.costProofRef, 'costProofRef');
  assert.equal(evidence.costResult, 'free', 'costResult must be free.');
  const costProofValidatedAt = assertIsoDate(evidence.costProofValidatedAt, 'costProofValidatedAt');
  assert.equal(typeof evidence.servicesChecked, 'number', 'servicesChecked must be a number.');
  assert.ok(Number.isInteger(evidence.servicesChecked) && evidence.servicesChecked > 0, 'servicesChecked must be a positive integer.');

  const proof = await loadCostProof(costProofRef, { repoRoot });
  const result = validateCostProofDocument(proof, { now });
  assert.equal(evidence.costProofValidatedAt, result.validatedAt, 'costProofValidatedAt must match proof validatedAt.');
  assert.equal(evidence.servicesChecked, result.servicesChecked, 'servicesChecked must match proof services length.');
  assert.ok(costProofValidatedAt.getTime() <= now.getTime(), 'costProofValidatedAt must not be in the future.');
  return result;
}

async function main(argv = process.argv.slice(2)) {
  const proofRef = argv[0] || DEFAULT_COST_PROOF_REF;
  const proof = await loadCostProof(proofRef, { repoRoot: process.cwd() });
  const result = validateCostProofDocument(proof);
  console.log(`Aneety cost proof OK: ${result.servicesChecked} services checked until ${result.validUntil}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(`Aneety cost proof failed: ${error.message}`);
    process.exitCode = 1;
  });
}

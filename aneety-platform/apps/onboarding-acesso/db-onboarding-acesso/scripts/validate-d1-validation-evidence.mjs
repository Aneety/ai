import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  loadD1ValidationEvidence,
  validateD1ValidationEvidence,
} from '../../../../../.codex/cloud/validate-d1-validation-evidence.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const moduleDir = resolve(scriptDir, '..');
const { evidence, evidencePath, canonicalEvidencePath } = await loadD1ValidationEvidence({ moduleDir });
validateD1ValidationEvidence({
  evidence,
  evidencePath,
  canonicalEvidencePath,
  responsibility: 'onboarding-acesso',
  modulePath: 'aneety-platform/apps/onboarding-acesso/db-onboarding-acesso',
  binding: 'ONBOARDING_ACESSO_DB',
  databaseName: 'onboarding-acesso-db',
});
console.log(`D1 validation evidence OK for ${evidence.databaseName}`);

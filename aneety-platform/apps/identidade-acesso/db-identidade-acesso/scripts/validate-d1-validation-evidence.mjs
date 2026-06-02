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
  responsibility: 'identidade-acesso',
  modulePath: 'aneety-platform/apps/identidade-acesso/db-identidade-acesso',
  binding: 'IDENTIDADE_ACESSO_DB',
  databaseName: 'identidade-acesso-db',
});
console.log(`D1 validation evidence OK for ${evidence.databaseName}`);

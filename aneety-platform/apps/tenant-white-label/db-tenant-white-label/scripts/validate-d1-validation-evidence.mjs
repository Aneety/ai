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
  responsibility: 'tenant-white-label',
  modulePath: 'aneety-platform/apps/tenant-white-label/db-tenant-white-label',
  binding: 'TENANT_WHITE_LABEL_DB',
  databaseName: 'tenant-white-label-db',
});
console.log(`D1 validation evidence OK for ${evidence.databaseName}`);

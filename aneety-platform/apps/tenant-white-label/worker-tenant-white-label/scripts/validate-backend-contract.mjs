import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONTRACT_VERSION,
  CONTRACT_VERSION_HEADER,
  PERMISSIONS_HEADER,
  READ_PERMISSION,
  TENANT_ID_HEADER,
} from '../src/index.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const moduleDir = resolve(scriptDir, '..');
const repoRoot = resolve(moduleDir, '../../../..');
const readinessPath = resolve(moduleDir, 'backend-readiness.json');

function fail(message) {
  console.error(`[backend:validate] ${message}`);
  process.exitCode = 1;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function assertHttpsUrl(value, label) {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    fail(`${label} deve usar HTTPS.`);
  }
  if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname) || url.hostname.endsWith('.example.com')) {
    fail(`${label} não pode apontar para host local ou de exemplo.`);
  }
}

const readiness = await readJson(readinessPath);
const publication = await readJson(resolve(moduleDir, readiness.publicationEvidence));
const d1Evidence = await readJson(resolve(moduleDir, readiness.databaseEvidence));
const storageContract = await readJson(resolve(moduleDir, readiness.routes?.[0]?.storageContract || ''));
const wrangler = await readFile(resolve(moduleDir, 'wrangler.toml'), 'utf8');
const costProof = await readJson(resolve(repoRoot, readiness.costProofRef));

if (readiness.responsibility !== 'tenant-white-label') {
  fail('backend-readiness.json deve pertencer à responsabilidade tenant-white-label.');
}

if (readiness.cycle !== 'backend') {
  fail('backend-readiness.json deve declarar ciclo backend.');
}

if (!['validacao', 'bloqueado', 'concluido'].includes(readiness.status)) {
  fail('backend-readiness.json deve usar status operacional canônico.');
}

if (readiness.status !== 'concluido' && (!readiness.blocker || !readiness.nextAction)) {
  fail('Status não concluído exige blocker objetivo e próxima ação.');
}

if (readiness.contractVersion !== CONTRACT_VERSION) {
  fail(`Contrato backend divergente: esperado ${CONTRACT_VERSION}.`);
}

if (!wrangler.includes(`ANEETY_CONTRACT_VERSION = "${CONTRACT_VERSION}"`)) {
  fail('wrangler.toml deve versionar a versão pública do contrato backend.');
}

assertHttpsUrl(readiness.publishedUrl, 'backend-readiness.publishedUrl');

if (publication.result !== 'success') {
  fail('publication-evidence.json precisa estar com result=success antes do backend.');
}

assertHttpsUrl(publication.publishedUrl, 'publication-evidence.publishedUrl');

if (d1Evidence.result !== 'success' || d1Evidence.binding !== readiness.databaseBinding) {
  fail('Evidência D1 precisa estar verde e apontar para o binding TENANT_WHITE_LABEL_DB.');
}

if (storageContract.storage?.binding !== readiness.databaseBinding) {
  fail('Storage contract precisa declarar o binding TENANT_WHITE_LABEL_DB.');
}

const brandingRoute = readiness.routes?.find((route) => route.id === 'tenant.branding.read');
if (!brandingRoute) {
  fail('Rota tenant.branding.read é obrigatória para o backend tenant-white-label.');
} else {
  if (brandingRoute.method !== 'GET' || brandingRoute.path !== '/branding') {
    fail('Rota tenant.branding.read deve expor GET /branding.');
  }
  if (brandingRoute.tenantBoundary !== TENANT_ID_HEADER) {
    fail(`Rota /branding deve usar boundary ${TENANT_ID_HEADER}.`);
  }
  if (brandingRoute.permissionsHeader !== PERMISSIONS_HEADER || brandingRoute.requiredPermission !== READ_PERMISSION) {
    fail('Rota /branding deve exigir permissão tenant-white-label:read.');
  }
}

if (!CONTRACT_VERSION_HEADER.startsWith('x-aneety-')) {
  fail('Header de contrato deve ser público e padronizado x-aneety-*.');
}

const services = Array.isArray(costProof.services) ? costProof.services : [];
if (!services.length || services.some((service) => service.status !== 'free')) {
  fail('Prova de custo zero deve existir e manter todos os serviços com status free.');
}

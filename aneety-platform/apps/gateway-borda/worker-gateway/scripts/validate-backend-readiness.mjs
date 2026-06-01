import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONTRACT_VERSION,
  PUBLIC_ROUTES,
  SERVICE_BINDINGS,
} from '../../pkg-contratos-publicos/index.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const moduleDir = resolve(scriptDir, '..');
const readinessPath = resolve(moduleDir, 'backend-readiness.json');
const gatewayEvidencePath = resolve(moduleDir, 'publication-evidence.json');

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

function routeById(routeId) {
  return Object.values(PUBLIC_ROUTES).find((route) => route.id === routeId);
}

const readiness = await readJson(readinessPath);
const gatewayEvidence = await readJson(gatewayEvidencePath);

if (readiness.responsibility !== 'gateway-borda') {
  fail('backend-readiness.json deve pertencer à responsabilidade gateway-borda.');
}

if (readiness.cycle !== 'backend') {
  fail('backend-readiness.json deve declarar o ciclo backend.');
}

if (readiness.contractVersion !== CONTRACT_VERSION) {
  fail(`Versão de contrato divergente: esperado ${CONTRACT_VERSION}.`);
}

if (readiness.runtime !== 'cloudflare-workers') {
  fail('O runtime backend do gateway deve permanecer cloudflare-workers.');
}

if (gatewayEvidence.result !== 'success') {
  fail('A evidência de publicação do gateway precisa estar com result=success antes do backend.');
}

assertHttpsUrl(gatewayEvidence.publishedUrl, 'publication-evidence.publishedUrl');

const bindingByName = new Map(Object.values(SERVICE_BINDINGS).map((service) => [service.binding, service]));

for (const upstream of readiness.upstreams || []) {
  const service = bindingByName.get(upstream.binding);
  if (!service) {
    fail(`Binding ${upstream.binding} não existe em SERVICE_BINDINGS.`);
    continue;
  }

  if (service.service !== upstream.service) {
    fail(`Binding ${upstream.binding} aponta para ${service.service}, mas readiness declara ${upstream.service}.`);
  }

  const route = routeById(upstream.gatewayRouteId);
  if (!route) {
    fail(`Rota pública ${upstream.gatewayRouteId} não existe em PUBLIC_ROUTES.`);
    continue;
  }

  if (route.binding !== upstream.binding) {
    fail(`Rota ${route.id} usa binding ${route.binding}, mas readiness declara ${upstream.binding}.`);
  }

  if (route.method !== upstream.requiredUpstreamMethod) {
    fail(`Rota ${route.id} usa método ${route.method}, mas readiness declara ${upstream.requiredUpstreamMethod}.`);
  }

  if (route.path !== upstream.gatewayPath) {
    fail(`Rota ${route.id} usa caminho ${route.path}, mas readiness declara ${upstream.gatewayPath}.`);
  }

  if (route.upstreamPath !== upstream.requiredUpstreamPath) {
    fail(`Rota ${route.id} encaminha para ${route.upstreamPath}, mas readiness declara ${upstream.requiredUpstreamPath}.`);
  }

  const evidencePath = resolve(moduleDir, upstream.publicationEvidence);
  const evidence = await readJson(evidencePath);
  if (evidence.responsibility !== upstream.responsibility) {
    fail(`Evidência ${upstream.publicationEvidence} pertence a ${evidence.responsibility}, esperado ${upstream.responsibility}.`);
  }
  if (evidence.result !== 'success') {
    fail(`Evidência de publicação de ${upstream.responsibility} precisa estar com result=success.`);
  }
  assertHttpsUrl(evidence.publishedUrl, `${upstream.responsibility}.publishedUrl`);
}

if (!process.exitCode) {
  console.log(JSON.stringify({
    responsibility: readiness.responsibility,
    cycle: readiness.cycle,
    status: readiness.status,
    upstreams: readiness.upstreams.length,
    blocker: readiness.blocker,
    nextAction: readiness.nextAction,
  }, null, 2));
}

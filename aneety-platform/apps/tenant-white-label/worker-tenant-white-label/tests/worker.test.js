import test from 'node:test';
import assert from 'node:assert/strict';

import { CONTRACT_VERSION, CONTRACT_VERSION_HEADER, handleRequest } from '../src/index.js';

function request(path, init = {}) {
  return new Request(`https://worker-tenant-white-label.aneety.example${path}`, init);
}

test('health route is deployable without exposing technical details', async () => {
  const response = await handleRequest(request('/health'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'worker-tenant-white-label');
  assert.equal(body.responsibility, 'tenant-white-label');
  assert.equal(response.headers.get(CONTRACT_VERSION_HEADER), CONTRACT_VERSION);
});

test('contract route requires the current public contract version', async () => {
  const response = await handleRequest(request('/contract'));
  const body = await response.json();

  assert.equal(response.status, 428);
  assert.equal(body.error.code, 'contract_version_required');
  assert.match(body.error.message, /contrato/i);
});

test('contract route exposes deploy contract when version is valid', async () => {
  const response = await handleRequest(
    request('/contract', {
      headers: { [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.runtime, 'cloudflare-workers');
  assert.equal(body.cycle, 'deploy');
  assert.deepEqual(body.dataBoundaries, ['tenant', 'tenant_branding']);
  assert.equal(body.routes.some((route) => route.path === '/contract'), true);
});

test('unsupported contract versions are rejected with a public error', async () => {
  const response = await handleRequest(
    request('/contract', {
      headers: { [CONTRACT_VERSION_HEADER]: '2026-05-31.tenant-white-label.v0' },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 412);
  assert.equal(body.error.code, 'contract_version_unsupported');
});

test('unknown routes stay closed until backend cycle defines product APIs', async () => {
  const response = await handleRequest(
    request('/branding', {
      headers: { [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'route_not_found');
  assert.equal(JSON.stringify(body).includes('wrangler'), false);
});

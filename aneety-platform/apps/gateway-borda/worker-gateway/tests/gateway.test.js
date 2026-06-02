import test from 'node:test';
import assert from 'node:assert/strict';

import { CONTRACT_VERSION, CONTRACT_VERSION_HEADER, PUBLIC_SESSION_HEADER } from '../../pkg-contratos-publicos/index.js';
import { handleRequest } from '../src/index.js';

const env = {
  ANEETY_ALLOWED_ORIGINS: 'https://app.aneety.com.br',
  ANEETY_CONTRACT_VERSION: CONTRACT_VERSION,
};

function request(path, init = {}) {
  return new Request(`https://gateway.aneety.test${path}`, init);
}

test('answers health without requiring a public contract header', async () => {
  const response = await handleRequest(request('/health'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get(CONTRACT_VERSION_HEADER), CONTRACT_VERSION);
  assert.equal((await response.json()).service, 'worker-gateway');
});

test('answers CORS preflight with canonical public edge headers', async () => {
  const response = await handleRequest(
    request('/bff/tenant-white-label/branding', {
      method: 'OPTIONS',
      headers: { origin: 'https://app.aneety.com.br' },
    }),
    env,
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://app.aneety.com.br');
  assert.match(response.headers.get('access-control-allow-methods'), /OPTIONS/);
  assert.match(response.headers.get('access-control-allow-headers'), new RegExp(CONTRACT_VERSION_HEADER));
  assert.match(response.headers.get('access-control-expose-headers'), new RegExp(CONTRACT_VERSION_HEADER));
});

test('rejects contract routes without the public contract version header', async () => {
  const response = await handleRequest(request('/contract'), env);
  assert.equal(response.status, 428);
  assert.equal((await response.json()).error.code, 'contract_version_required');
});

test('publishes public contract metadata after version validation', async () => {
  const response = await handleRequest(
    request('/contract', { headers: { [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION } }),
    env,
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.contractVersion, CONTRACT_VERSION);
  assert.equal(body.runtime, 'cloudflare-workers');
  assert.equal(Object.hasOwn(body, 'backendStatus'), false);
  assert.equal(Object.hasOwn(body, 'backendBlocker'), false);
  assert.ok(body.routes.some((route) => route.id === 'tenant.branding'));
  assert.ok(body.routes.some((route) => route.id === 'tenant.branding' && route.binding === 'TENANT_WHITE_LABEL' && route.upstreamPath === '/branding'));
});

test('requires public Aneety session before forwarding protected BFF route', async () => {
  const response = await handleRequest(
    request('/bff/tenant-white-label/branding', { headers: { [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION } }),
    env,
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'public_session_required');
});

test('forwards validated requests to service binding with edge headers', async () => {
  const response = await handleRequest(
    request('/bff/tenant-white-label/branding', {
      headers: {
        [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION,
        [PUBLIC_SESSION_HEADER]: 'public-session-id',
      },
    }),
    {
      ...env,
      TENANT_WHITE_LABEL: {
        async fetch(upstreamRequest) {
          assert.equal(new URL(upstreamRequest.url).pathname, '/branding');
          return Response.json({ tenant: 'lia' });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-aneety-route'), 'tenant.branding');
  assert.deepEqual(await response.json(), { tenant: 'lia' });
});

test('rejects unsupported public contract versions before routing', async () => {
  const response = await handleRequest(
    request('/bff/tenant-white-label/branding', {
      headers: { [CONTRACT_VERSION_HEADER]: '2026-05-30.gateway-borda.v0' },
    }),
    env,
  );

  assert.equal(response.status, 412);
  assert.equal((await response.json()).error.code, 'contract_version_unsupported');
});

test('returns canonical upstream unavailable error when a service binding is absent', async () => {
  const response = await handleRequest(
    request('/bff/onboarding-acesso/invitations', {
      method: 'POST',
      headers: {
        [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION,
        [PUBLIC_SESSION_HEADER]: 'public-session-id',
      },
    }),
    env,
  );

  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'upstream_unavailable');
});

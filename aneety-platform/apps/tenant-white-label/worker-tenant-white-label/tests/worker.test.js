import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTRACT_VERSION,
  CONTRACT_VERSION_HEADER,
  PERMISSIONS_HEADER,
  READ_PERMISSION,
  TENANT_ID_HEADER,
  handleRequest,
} from '../src/index.js';

function request(path, init = {}) {
  return new Request(`https://worker-tenant-white-label.aneety.example${path}`, init);
}

function backendHeaders(overrides = {}) {
  return {
    [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION,
    [TENANT_ID_HEADER]: 'tenant_lia_demo_20260601',
    [PERMISSIONS_HEADER]: READ_PERMISSION,
    ...overrides,
  };
}

function mockD1({ tenant = true, branding = true } = {}) {
  const statements = [];

  return {
    statements,
    prepare(sql) {
      const statement = {
        sql,
        values: [],
        bind(...values) {
          this.values = values;
          return this;
        },
        async first() {
          statements.push({ sql: this.sql, values: this.values });

          if (this.sql.includes('FROM tenants')) {
            return tenant
              ? {
                  tenant_id: 'tenant_lia_demo_20260601',
                  tenant_key: 'lia-demo',
                  display_name: 'Lia Demonstração',
                  status: 'active',
                  default_locale: 'pt-BR',
                }
              : null;
          }

          if (this.sql.includes('FROM tenant_branding')) {
            return branding
              ? {
                  branding_id: 'branding_lia_demo_20260601',
                  tenant_id: 'tenant_lia_demo_20260601',
                  brand_key: 'lia-demo',
                  display_name: 'Lia',
                  logo_asset_ref: 'asset://tenant-white-label/lia/logo.svg',
                  primary_color: '#5B21B6',
                  secondary_color: '#A78BFA',
                  accent_color: '#F59E0B',
                  surface_color: '#FFFFFF',
                  text_color: '#111827',
                  support_copy: 'Configuração de marca pronta para demonstração.',
                  publication_status: 'published',
                  version: 1,
                  active_from: '2026-06-01T00:00:00.000Z',
                  active_until: null,
                }
              : null;
          }

          throw new Error('Unexpected SQL in test mock');
        },
      };

      return statement;
    },
  };
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

test('contract route exposes backend BFF contract when version is valid', async () => {
  const response = await handleRequest(
    request('/contract', {
      headers: { [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.runtime, 'cloudflare-workers');
  assert.equal(body.cycle, 'backend');
  assert.equal(body.bffContract.storageBinding, 'TENANT_WHITE_LABEL_DB');
  assert.deepEqual(body.dataBoundaries, ['tenant', 'tenant_branding']);
  assert.equal(body.routes.some((route) => route.path === '/branding' && route.requiredPermission === READ_PERMISSION), true);
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

test('branding route requires tenant context before reading D1', async () => {
  const response = await handleRequest(
    request('/branding', {
      headers: backendHeaders({ [TENANT_ID_HEADER]: '' }),
    }),
    { TENANT_WHITE_LABEL_DB: mockD1() },
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'tenant_context_required');
});

test('branding route requires explicit read permission', async () => {
  const response = await handleRequest(
    request('/branding', {
      headers: backendHeaders({ [PERMISSIONS_HEADER]: 'tenant-white-label:write' }),
    }),
    { TENANT_WHITE_LABEL_DB: mockD1() },
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'permission_required');
});

test('branding route fails closed when D1 binding is not available', async () => {
  const response = await handleRequest(
    request('/branding', {
      headers: backendHeaders(),
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error.code, 'backend_storage_unavailable');
  assert.equal(JSON.stringify(body).includes('TENANT_WHITE_LABEL_DB'), false);
});

test('branding route reads tenant-scoped public brand data from D1', async () => {
  const d1 = mockD1();
  const response = await handleRequest(
    request('/branding?brandKey=lia-demo', {
      headers: backendHeaders(),
    }),
    { TENANT_WHITE_LABEL_DB: d1 },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.responsibility, 'tenant-white-label');
  assert.equal(body.tenantBoundary, 'tenant_lia_demo_20260601');
  assert.equal(body.tenant.key, 'lia-demo');
  assert.equal(body.branding.key, 'lia-demo');
  assert.equal(body.branding.colors.primary, '#5B21B6');
  assert.equal(body.branding.publicationStatus, 'published');
  assert.equal(d1.statements.every((statement) => statement.values[0] === 'tenant_lia_demo_20260601'), true);
});

test('branding route rejects invalid brand keys without exposing storage details', async () => {
  const response = await handleRequest(
    request('/branding?brandKey=../secret', {
      headers: backendHeaders(),
    }),
    { TENANT_WHITE_LABEL_DB: mockD1() },
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'invalid_brand_key');
  assert.equal(JSON.stringify(body).includes('SELECT'), false);
});

test('unknown routes return public not found errors', async () => {
  const response = await handleRequest(
    request('/admin/internal', {
      headers: { [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.error.code, 'route_not_found');
  assert.equal(JSON.stringify(body).includes('wrangler'), false);
});

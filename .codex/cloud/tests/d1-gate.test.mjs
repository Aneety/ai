import test from 'node:test';
import assert from 'node:assert/strict';
import { buildD1DeleteArgs, buildD1WranglerConfig, buildEphemeralDatabaseName, parseD1ListJson, sanitizeD1DatabaseName } from '../run-d1-gate.mjs';

test('sanitizeD1DatabaseName normaliza caracteres inválidos', () => {
  assert.equal(sanitizeD1DatabaseName('Tenant White Label DB!'), 'tenant-white-label-db');
});

test('buildEphemeralDatabaseName preserva base, nonce legível e sufixo único', () => {
  const first = buildEphemeralDatabaseName('tenant-white-label-db', 'tenant-white-label/banco#validate-20260602213008');
  const second = buildEphemeralDatabaseName('tenant-white-label-db', 'tenant-white-label/banco#validate-20260602214509');

  assert.match(first, /^tenant-white-label-db-tenant-white-label-banco-[a-f0-9]{8}$/);
  assert.match(second, /^tenant-white-label-db-tenant-white-label-banco-[a-f0-9]{8}$/);
  assert.notEqual(first, second);
  assert.ok(first.length <= 64);
  assert.ok(second.length <= 64);
});

test('buildD1DeleteArgs usa a flag confirmada pelo Wrangler atual', () => {
  assert.deepEqual(buildD1DeleteArgs('tenant-white-label-db-validation'), [
    '--yes',
    'wrangler@latest',
    'd1',
    'delete',
    'tenant-white-label-db-validation',
    '--skip-confirmation',
  ]);
});

test('buildD1WranglerConfig usa migrations_dir absoluto para config temporário', () => {
  const config = buildD1WranglerConfig({
    binding: 'TENANT_WHITE_LABEL_DB',
    databaseName: 'tenant-white-label-db-validation',
    databaseUuid: 'uuid-1',
    migrationDirectory: 'migrations',
    moduleDir: '/workspace/aneety-platform/apps/tenant-white-label/db-tenant-white-label',
  });

  assert.equal(
    config.d1_databases[0].migrations_dir,
    '/workspace/aneety-platform/apps/tenant-white-label/db-tenant-white-label/migrations',
  );
});

test('parseD1ListJson normaliza saída json do wrangler', () => {
  const parsed = parseD1ListJson([
    { uuid: 'uuid-1', name: 'db-1' },
    { uuid: 'uuid-2', name: 'db-2' },
  ]);
  assert.deepEqual(parsed, [
    { uuid: 'uuid-1', name: 'db-1' },
    { uuid: 'uuid-2', name: 'db-2' },
  ]);
});

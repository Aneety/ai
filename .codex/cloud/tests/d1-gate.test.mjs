import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEphemeralDatabaseName, parseD1ListJson, sanitizeD1DatabaseName } from '../run-d1-gate.mjs';

test('sanitizeD1DatabaseName normaliza caracteres inválidos', () => {
  assert.equal(sanitizeD1DatabaseName('Tenant White Label DB!'), 'tenant-white-label-db');
});

test('buildEphemeralDatabaseName preserva base e nonce sanitizado', () => {
  const value = buildEphemeralDatabaseName('tenant-white-label-db', 'tenant-white-label/banco#validate-20260602');
  assert.match(value, /^tenant-white-label-db-tenant-white-label-banco$/);
  assert.ok(value.length <= 64);
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

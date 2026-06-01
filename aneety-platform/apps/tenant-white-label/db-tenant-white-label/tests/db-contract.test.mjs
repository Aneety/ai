import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripSqlComments = (sql) => sql.replace(/^\s*--.*$/gm, '').trim();

test('D1 migration declares tenant and branding isolation boundaries', () => {
  const migration = read('migrations/0001_tenant_white_label_d1.sql');

  assert.match(migration, /CREATE TABLE tenants/);
  assert.match(migration, /CREATE TABLE tenant_branding/);
  assert.match(migration, /tenant_id TEXT NOT NULL/);
  assert.match(migration, /FOREIGN KEY \(tenant_id\) REFERENCES tenants\(tenant_id\)/);
  assert.match(migration, /UNIQUE \(tenant_id, brand_key\)/);
  assert.match(migration, /idx_tenant_branding_tenant_status ON tenant_branding\(tenant_id, publication_status, brand_key\)/);
});

test('CRUD query contract keeps tenant-scoped reads and mutations', () => {
  const queries = read('queries/crud-contract.sql');
  const statements = queries
    .split(';')
    .map((statement) => stripSqlComments(statement))
    .filter((statement) => /^(SELECT|UPDATE)\b/i.test(statement));

  assert.ok(statements.length >= 4);
  for (const statement of statements) {
    assert.match(statement, /WHERE\s+[\s\S]*tenant_id\s*=\s*:tenant_id/i);
  }
});

test('seed data is sanitized and avoids runtime secrets', () => {
  const seed = read('seeds/0001_lia_demo_brand.sql');

  assert.match(seed, /tenant_lia_demo_0001/);
  assert.match(seed, /Lia Demonstração/);
  assert.doesNotMatch(stripSqlComments(seed), /(password|secret|token|api[_-]?key|private[_-]?key|bearer|https?:\/\/)/i);
});

test('storage contract points to Cloudflare D1 without local fallback', () => {
  const contract = JSON.parse(read('contracts/storage-contract.json'));

  assert.equal(contract.runtime, 'cloudflare-workers');
  assert.equal(contract.storage.type, 'd1');
  assert.equal(contract.storage.binding, 'TENANT_WHITE_LABEL_DB');
  assert.equal(contract.acceptanceEvidenceRequired.includes('Cloudflare D1-backed'), true);
});

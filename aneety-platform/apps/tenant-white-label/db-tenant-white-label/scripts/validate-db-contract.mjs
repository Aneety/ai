import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripSqlComments = (sql) => sql.replace(/^\s*--.*$/gm, '').trim();
const migration = read('migrations/0001_tenant_white_label_d1.sql');
const rollback = read('rollbacks/0001_tenant_white_label_d1.sql');
const seed = read('seeds/0001_lia_demo_brand.sql');
const queries = read('queries/crud-contract.sql');
const storageContract = JSON.parse(read('contracts/storage-contract.json'));

const forbidden = /(password|secret|token|api[_-]?key|private[_-]?key|bearer|cloudflare_api|account_id|https?:\/\/)/i;

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message ?? `Expected to find ${needle}`);
}

function assertNoForbiddenSecrets(label, value) {
  assert.equal(forbidden.test(value), false, `${label} must not expose secrets, external endpoints or tokens`);
}

assert.equal(storageContract.responsibility, 'tenant-white-label');
assert.equal(storageContract.cycle, 'banco');
assert.equal(storageContract.runtime, 'cloudflare-workers');
assert.equal(storageContract.storage.type, 'd1');
assert.equal(storageContract.storage.binding, 'TENANT_WHITE_LABEL_DB');

for (const table of ['tenants', 'tenant_branding', 'tenant_branding_audit_events']) {
  assertIncludes(migration, `CREATE TABLE ${table}`);
  assertIncludes(rollback, `DROP TABLE IF EXISTS ${table}`);
}

for (const fragment of [
  'FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)',
  'UNIQUE (tenant_id, brand_key)',
  'CHECK (publication_status IN',
  'CHECK (status IN',
  "CHECK (tenant_key NOT GLOB '*[^a-z0-9-]*')",
  "CHECK (tenant_key NOT GLOB '-*')",
  "CHECK (tenant_key NOT GLOB '*-')",
  "CHECK (brand_key NOT GLOB '*[^a-z0-9-]*')",
  "CHECK (brand_key NOT GLOB '-*')",
  "CHECK (brand_key NOT GLOB '*-')",
  'CREATE INDEX idx_tenant_branding_tenant_status ON tenant_branding(tenant_id, publication_status, brand_key)',
  'CREATE INDEX idx_tenant_branding_audit_tenant_created ON tenant_branding_audit_events(tenant_id, created_at)',
]) {
  assertIncludes(migration, fragment);
}

const tenantScopedStatements = queries
  .split(';')
  .map((statement) => stripSqlComments(statement))
  .filter((statement) => /^(SELECT|UPDATE)\b/i.test(statement));

assert.ok(tenantScopedStatements.length >= 4, 'CRUD contract must declare tenant-scoped read/update statements');
for (const statement of tenantScopedStatements) {
  assert.match(statement, /WHERE\s+[\s\S]*tenant_id\s*=\s*:tenant_id/i, `Statement must keep tenant_id boundary: ${statement}`);
}

assertIncludes(seed, "'tenant_lia_demo_0001'");
assertIncludes(seed, "'lia-demo'");
assertNoForbiddenSecrets('migration', stripSqlComments(migration));
assertNoForbiddenSecrets('seed', stripSqlComments(seed));
assertNoForbiddenSecrets('queries', stripSqlComments(queries));

console.log('tenant-white-label D1 contract is structurally valid');
console.log(join('aneety-platform', 'apps', 'tenant-white-label', 'db-tenant-white-label'));

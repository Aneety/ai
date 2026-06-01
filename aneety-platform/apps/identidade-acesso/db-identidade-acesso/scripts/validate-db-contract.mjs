import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripSqlComments = (sql) => sql.replace(/^\s*--.*$/gm, '').trim();
const migration = read('migrations/0001_identidade_acesso_d1.sql');
const rollback = read('rollbacks/0001_identidade_acesso_d1.sql');
const seed = read('seeds/0001_lia_demo_identity.sql');
const queries = read('queries/crud-contract.sql');
const fixture = read('tests/identity-access-fixture.sql');
const storageContract = JSON.parse(read('contracts/storage-contract.json'));

const forbiddenSeedValues = /(secret|api[_-]?key|private[_-]?key|bearer|cloudflare_api|account_id|https?:\/\/)/i;

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message ?? `Expected to find ${needle}`);
}

function assertNoForbiddenRuntimeSecrets(label, value) {
  assert.equal(forbiddenSeedValues.test(value), false, `${label} must not expose runtime secrets or external endpoints`);
}

assert.equal(storageContract.responsibility, 'identidade-acesso');
assert.equal(storageContract.cycle, 'banco');
assert.equal(storageContract.runtime, 'cloudflare-workers');
assert.equal(storageContract.storage.type, 'd1');
assert.equal(storageContract.storage.binding, 'IDENTIDADE_ACESSO_DB');

for (const table of [
  'app_identities',
  'auth_credentials',
  'auth_sessions',
  'access_profiles',
  'app_users',
  'permissions',
  'access_profile_permissions',
  'identity_audit_events',
]) {
  assertIncludes(migration, `CREATE TABLE ${table}`);
  assertIncludes(rollback, `DROP TABLE IF EXISTS ${table}`);
}

for (const fragment of [
  'credential_hash TEXT NOT NULL',
  "hash_algorithm TEXT NOT NULL DEFAULT 'argon2id'",
  'access_token_hash TEXT NOT NULL',
  'refresh_token_hash TEXT NOT NULL',
  'expires_at TEXT NOT NULL',
  'refresh_expires_at TEXT NOT NULL',
  'revoked_at TEXT',
  'CHECK (expires_at > issued_at)',
  'CHECK (refresh_expires_at >= expires_at)',
  'UNIQUE (tenant_id, profile_key)',
  'UNIQUE (tenant_id, access_profile_id, permission_id)',
  'CREATE INDEX idx_auth_sessions_tenant_identity_expiration ON auth_sessions(tenant_id, identity_id, expires_at, revoked_at)',
  'CREATE INDEX idx_access_profile_permissions_tenant_profile ON access_profile_permissions(tenant_id, access_profile_id, deleted_at)',
]) {
  assertIncludes(migration, fragment);
}

for (const rawColumn of [' raw_password', ' plaintext_password', ' access_token TEXT', ' refresh_token TEXT', ' token TEXT']) {
  assert.equal(migration.includes(rawColumn), false, `Migration must not declare raw secret column ${rawColumn}`);
}

const tenantScopedStatements = queries
  .split(';')
  .map((statement) => stripSqlComments(statement))
  .filter((statement) => /^(SELECT|UPDATE)\b/i.test(statement));

assert.ok(tenantScopedStatements.length >= 6, 'CRUD contract must declare tenant-scoped read/update statements');
for (const statement of tenantScopedStatements) {
  assert.match(statement, /WHERE\s+[\s\S]*tenant_id\s*=\s*:tenant_id/i, `Statement must keep tenant_id boundary: ${statement}`);
}

assertIncludes(queries, 'access_token_hash = :access_token_hash');
assertIncludes(queries, 'expires_at > :now');
assertIncludes(queries, 'revoked_at IS NULL');
assertIncludes(seed, "'tenant_lia_demo_0001'");
assertIncludes(seed, "'identity_lia_admin_0001'");
assertIncludes(seed, 'argon2id:v=19:m=65536:t=3:p=1');
assertIncludes(seed, 'session_lia_admin_0001');
assertIncludes(fixture, 'revoked_session_rows');
assertIncludes(fixture, 'cross_tenant_identity_rows');
assertNoForbiddenRuntimeSecrets('seed', stripSqlComments(seed));
assertNoForbiddenRuntimeSecrets('fixture', stripSqlComments(fixture));

console.log('identidade-acesso D1 contract is structurally valid');
console.log(join('aneety-platform', 'apps', 'identidade-acesso', 'db-identidade-acesso'));

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripSqlComments = (sql) => sql.replace(/^\s*--.*$/gm, '').trim();
const assertIncludes = (content, fragment) => assert.ok(content.includes(fragment), `Missing required fragment: ${fragment}`);

const migration = read('migrations/0001_onboarding_acesso_d1.sql');
const rollback = read('rollbacks/0001_onboarding_acesso_d1.sql');
const seed = read('seeds/0001_lia_demo_onboarding.sql');
const queries = read('queries/crud-contract.sql');
const fixture = read('tests/onboarding-access-fixture.sql');
const contract = JSON.parse(read('contracts/storage-contract.json'));

assert.equal(contract.runtime, 'cloudflare-workers');
assert.equal(contract.storage.type, 'd1');
assert.equal(contract.storage.binding, 'ONBOARDING_ACESSO_DB');
assert.ok(contract.acceptanceEvidenceRequired.some((item) => item.includes('Cloudflare D1-backed')));

for (const fragment of [
  'CREATE TABLE onboarding_invites',
  'CREATE TABLE onboarding_first_access_sessions',
  'CREATE TABLE onboarding_contact_confirmations',
  'CREATE TABLE onboarding_recovery_requests',
  'CREATE TABLE onboarding_lifecycle_events',
  'tenant_id TEXT NOT NULL',
  'invitation_token_hash TEXT NOT NULL',
  'session_token_hash TEXT NOT NULL',
  'confirmation_token_hash TEXT NOT NULL',
  'recovery_token_hash TEXT NOT NULL',
  'expires_at TEXT NOT NULL',
  'revoked_at TEXT',
  'CREATE UNIQUE INDEX idx_onboarding_invites_tenant_token_hash',
  'CREATE UNIQUE INDEX idx_first_access_tenant_session_hash',
  'CREATE UNIQUE INDEX idx_contact_confirmations_tenant_token_hash',
  'CREATE UNIQUE INDEX idx_recovery_requests_tenant_token_hash',
  'CREATE INDEX idx_onboarding_lifecycle_events_tenant_occurred',
]) {
  assertIncludes(migration, fragment);
}

for (const table of [
  'onboarding_lifecycle_events',
  'onboarding_recovery_requests',
  'onboarding_contact_confirmations',
  'onboarding_first_access_sessions',
  'onboarding_invites',
]) {
  assertIncludes(rollback, `DROP TABLE IF EXISTS ${table}`);
}

const tenantScopedStatements = queries
  .split(';')
  .map((statement) => stripSqlComments(statement))
  .filter((statement) => /^(SELECT|UPDATE)\b/i.test(statement));

assert.ok(tenantScopedStatements.length >= 8, 'CRUD contract must declare tenant-scoped read/update statements');
for (const statement of tenantScopedStatements) {
  assert.match(statement, /WHERE\s+[\s\S]*tenant_id\s*=\s*:tenant_id/i, `Statement must keep tenant_id boundary: ${statement}`);
}

for (const content of [migration, seed, queries, fixture]) {
  assert.doesNotMatch(stripSqlComments(content), /\b(raw_token|plain_token|token_value|plaintext)\b/i);
  assert.doesNotMatch(stripSqlComments(content), /(api[_-]?key|private[_-]?key|bearer|https?:\/\/)/i);
}

assertIncludes(seed, 'tenant_lia_demo_0001');
assertIncludes(seed, 'invite_lia_demo_admin_0001');
assertIncludes(seed, 'hash_invitation_lia_demo_0001');
assertIncludes(seed, 'hash_recovery_lia_demo_0001');
assertIncludes(fixture, 'cross_tenant_invites');
assertIncludes(fixture, 'revoked_recovery_rows');

console.log('onboarding-acesso D1 contract is structurally valid');
console.log(join('aneety-platform', 'apps', 'onboarding-acesso', 'db-onboarding-acesso'));

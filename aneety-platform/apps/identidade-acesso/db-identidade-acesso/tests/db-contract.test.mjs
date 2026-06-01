import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripSqlComments = (sql) => sql.replace(/^\s*--.*$/gm, '').trim();

test('D1 migration declares identity, credential, session and permission boundaries', () => {
  const migration = read('migrations/0001_identidade_acesso_d1.sql');

  assert.match(migration, /CREATE TABLE app_identities/);
  assert.match(migration, /CREATE TABLE auth_credentials/);
  assert.match(migration, /CREATE TABLE auth_sessions/);
  assert.match(migration, /CREATE TABLE access_profiles/);
  assert.match(migration, /CREATE TABLE permissions/);
  assert.match(migration, /tenant_id TEXT NOT NULL/);
  assert.match(migration, /credential_hash TEXT NOT NULL/);
  assert.match(migration, /access_token_hash TEXT NOT NULL/);
  assert.match(migration, /refresh_token_hash TEXT NOT NULL/);
  assert.match(migration, /CHECK \(expires_at > issued_at\)/);
  assert.match(migration, /idx_auth_sessions_tenant_identity_expiration ON auth_sessions\(tenant_id, identity_id, expires_at, revoked_at\)/);
});

test('CRUD query contract keeps tenant-scoped reads and mutations', () => {
  const queries = read('queries/crud-contract.sql');
  const statements = queries
    .split(';')
    .map((statement) => stripSqlComments(statement))
    .filter((statement) => /^(SELECT|UPDATE)\b/i.test(statement));

  assert.ok(statements.length >= 6);
  for (const statement of statements) {
    assert.match(statement, /WHERE\s+[\s\S]*tenant_id\s*=\s*:tenant_id/i);
  }
  assert.match(queries, /expires_at > :now/);
  assert.match(queries, /revoked_at IS NULL/);
});

test('seed data is sanitized but proves hash, session and permission contracts', () => {
  const seed = read('seeds/0001_lia_demo_identity.sql');

  assert.match(seed, /tenant_lia_demo_0001/);
  assert.match(seed, /identity_lia_admin_0001/);
  assert.match(seed, /argon2id:v=19:m=65536:t=3:p=1/);
  assert.match(seed, /session_lia_admin_0001/);
  assert.match(seed, /permission_session_revoke_0001/);
  assert.doesNotMatch(stripSqlComments(seed), /(secret|api[_-]?key|private[_-]?key|bearer|https?:\/\/)/i);
});

test('negative fixture covers revocation and cross-tenant denial evidence', () => {
  const fixture = read('tests/identity-access-fixture.sql');

  assert.match(fixture, /revoked_session_rows/);
  assert.match(fixture, /cross_tenant_identity_rows/);
  assert.match(fixture, /revoked_at IS NULL/);
});

test('storage contract points to Cloudflare D1 without local fallback', () => {
  const contract = JSON.parse(read('contracts/storage-contract.json'));

  assert.equal(contract.runtime, 'cloudflare-workers');
  assert.equal(contract.storage.type, 'd1');
  assert.equal(contract.storage.binding, 'IDENTIDADE_ACESSO_DB');
  assert.equal(contract.acceptanceEvidenceRequired.includes('Cloudflare D1-backed'), true);
  assert.equal(contract.securityContract.frontendBoundary.includes('Microfrontends never access D1 directly'), true);
});

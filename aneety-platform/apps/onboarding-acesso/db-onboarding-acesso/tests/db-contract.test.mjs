import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const stripSqlComments = (sql) => sql.replace(/^\s*--.*$/gm, '').trim();

test('D1 migration declares onboarding lifecycle tables and token hash boundaries', () => {
  const migration = read('migrations/0001_onboarding_acesso_d1.sql');

  assert.match(migration, /CREATE TABLE onboarding_invites/);
  assert.match(migration, /CREATE TABLE onboarding_first_access_sessions/);
  assert.match(migration, /CREATE TABLE onboarding_contact_confirmations/);
  assert.match(migration, /CREATE TABLE onboarding_recovery_requests/);
  assert.match(migration, /CREATE TABLE onboarding_lifecycle_events/);
  assert.match(migration, /tenant_id TEXT NOT NULL/);
  assert.match(migration, /invitation_token_hash TEXT NOT NULL/);
  assert.match(migration, /session_token_hash TEXT NOT NULL/);
  assert.match(migration, /confirmation_token_hash TEXT NOT NULL/);
  assert.match(migration, /recovery_token_hash TEXT NOT NULL/);
  assert.match(migration, /expires_at TEXT NOT NULL/);
  assert.match(migration, /revoked_at TEXT/);
  assert.doesNotMatch(stripSqlComments(migration), /\b(raw_token|plaintext|password)\b/i);
});

test('CRUD query contract keeps tenant-scoped reads and mutations', () => {
  const queries = read('queries/crud-contract.sql');
  const statements = queries
    .split(';')
    .map((statement) => stripSqlComments(statement))
    .filter((statement) => /^(SELECT|UPDATE)\b/i.test(statement));

  assert.ok(statements.length >= 8);
  for (const statement of statements) {
    assert.match(statement, /WHERE\s+[\s\S]*tenant_id\s*=\s*:tenant_id/i);
  }
});

test('seed data is sanitized and stores only hashed challenges', () => {
  const seed = read('seeds/0001_lia_demo_onboarding.sql');
  const stripped = stripSqlComments(seed);

  assert.match(seed, /tenant_lia_demo_0001/);
  assert.match(seed, /invite_lia_demo_admin_0001/);
  assert.match(seed, /hash_invitation_lia_demo_0001/);
  assert.match(seed, /hash_recovery_lia_demo_0001/);
  assert.doesNotMatch(stripped, /(secret|api[_-]?key|private[_-]?key|bearer|https?:\/\/)/i);
  assert.doesNotMatch(stripped, /\b(token_value|raw_token|plain_token)\b/i);
});

test('storage contract points to Cloudflare D1 without local fallback', () => {
  const contract = JSON.parse(read('contracts/storage-contract.json'));

  assert.equal(contract.runtime, 'cloudflare-workers');
  assert.equal(contract.storage.type, 'd1');
  assert.equal(contract.storage.binding, 'ONBOARDING_ACESSO_DB');
  assert.equal(contract.acceptanceEvidenceRequired.some((item) => item.includes('Cloudflare D1-backed')), true);
});

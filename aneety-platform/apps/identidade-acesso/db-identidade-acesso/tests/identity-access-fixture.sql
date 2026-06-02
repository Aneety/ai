-- Cloudflare D1-backed validation fixture for remote acceptance.
-- Precondition: apply migrations/0001_identidade_acesso_d1.sql and seeds/0001_lia_demo_identity.sql first.
-- The assertion table fails the fixture if active/revoked session semantics, cross-tenant isolation or FK integrity drift.
PRAGMA foreign_keys = ON;

INSERT INTO app_identities (identity_id, tenant_id, email_hash, display_name, status)
VALUES ('identity_other_admin_0001', 'tenant_other_demo_0001', 'sha256:other-demo-email-hash-0001', 'Outra Identidade Demonstração', 'active');

INSERT INTO access_profiles (access_profile_id, tenant_id, profile_key, name, role, status, is_system)
VALUES ('profile_other_admin_0001', 'tenant_other_demo_0001', 'admin-operacional', 'Administrador operacional', 'admin', 'active', 1);

INSERT INTO auth_sessions (session_id, tenant_id, identity_id, access_token_hash, refresh_token_hash, effective_profile_id, issued_at, expires_at, refresh_expires_at, revoked_at, revoked_reason)
VALUES (
  'session_lia_admin_revoked_0001',
  'tenant_lia_demo_0001',
  'identity_lia_admin_0001',
  'sha256:synthetic-revoked-access-hash-lia-admin-0001',
  'sha256:synthetic-revoked-refresh-hash-lia-admin-0001',
  'profile_lia_admin_0001',
  '2026-06-01T00:00:00.000Z',
  '2026-06-01T01:00:00.000Z',
  '2026-06-08T00:00:00.000Z',
  '2026-06-01T00:30:00.000Z',
  'fixture-revocation'
);

CREATE TABLE identity_access_fixture_assertions (
  assertion_name TEXT PRIMARY KEY,
  actual_count INTEGER NOT NULL,
  expected_count INTEGER NOT NULL,
  CHECK (actual_count = expected_count)
);

INSERT INTO identity_access_fixture_assertions (assertion_name, actual_count, expected_count)
SELECT 'active_session_rows', COUNT(*), 1
FROM auth_sessions
WHERE tenant_id = 'tenant_lia_demo_0001'
  AND access_token_hash = 'sha256:synthetic-access-hash-lia-admin-0001-demo-only-value'
  AND expires_at > '2026-06-01T00:30:00.000Z'
  AND revoked_at IS NULL;

INSERT INTO identity_access_fixture_assertions (assertion_name, actual_count, expected_count)
SELECT 'revoked_session_rows', COUNT(*), 0
FROM auth_sessions
WHERE tenant_id = 'tenant_lia_demo_0001'
  AND access_token_hash = 'sha256:synthetic-revoked-access-hash-lia-admin-0001'
  AND expires_at > '2026-06-01T00:30:00.000Z'
  AND revoked_at IS NULL;

INSERT INTO identity_access_fixture_assertions (assertion_name, actual_count, expected_count)
SELECT 'cross_tenant_identity_rows', COUNT(*), 0
FROM app_identities
WHERE tenant_id = 'tenant_lia_demo_0001' AND identity_id = 'identity_other_admin_0001';

INSERT INTO identity_access_fixture_assertions (assertion_name, actual_count, expected_count)
SELECT 'foreign_key_violations', COUNT(*), 0
FROM pragma_foreign_key_check;

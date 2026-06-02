-- Sanitized seed for the first demonstrative identity tenant. Values are synthetic and contain no real customer data or runtime secrets.
INSERT INTO app_identities (identity_id, tenant_id, email_hash, phone_hash, display_name, status, created_at, updated_at)
VALUES (
  'identity_lia_admin_0001',
  'tenant_lia_demo_0001',
  'sha256:6e7a-demo-email-hash-for-lia-admin-0001',
  'sha256:6e7a-demo-phone-hash-for-lia-admin-0001',
  'Admin Lia Demonstração',
  'active',
  '2026-06-01T00:00:00.000Z',
  '2026-06-01T00:00:00.000Z'
);

INSERT INTO auth_credentials (credential_id, tenant_id, identity_id, credential_type, credential_hash, hash_algorithm, password_updated_at, created_at)
VALUES (
  'credential_lia_admin_0001',
  'tenant_lia_demo_0001',
  'identity_lia_admin_0001',
  'password',
  'argon2id:v=19:m=65536:t=3:p=1:synthetic-demo-salt:synthetic-demo-hash-not-a-real-credential',
  'argon2id',
  '2026-06-01T00:00:00.000Z',
  '2026-06-01T00:00:00.000Z'
);

INSERT INTO access_profiles (access_profile_id, tenant_id, profile_key, name, role, status, is_system, created_at, updated_at)
VALUES ('profile_lia_admin_0001', 'tenant_lia_demo_0001', 'admin-operacional', 'Administrador operacional', 'admin', 'active', 1, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');

INSERT INTO app_users (app_user_id, tenant_id, identity_id, access_profile_id, full_name, contact_label, role, is_active, created_at, updated_at)
VALUES ('user_lia_admin_0001', 'tenant_lia_demo_0001', 'identity_lia_admin_0001', 'profile_lia_admin_0001', 'Admin Lia Demonstração', 'admin-demo', 'admin', 1, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');

INSERT INTO permissions (permission_id, permission_key, description, scope, created_at)
VALUES
  ('permission_identity_read_0001', 'identity:read', 'Ler identidades do tenant via BFF autorizado.', 'identity', '2026-06-01T00:00:00.000Z'),
  ('permission_session_revoke_0001', 'session:revoke', 'Revogar sessões próprias do tenant via BFF autorizado.', 'session', '2026-06-01T00:00:00.000Z'),
  ('permission_profile_manage_0001', 'profile:manage', 'Gerir perfis e permissões do tenant via BFF autorizado.', 'profile', '2026-06-01T00:00:00.000Z');

INSERT INTO access_profile_permissions (profile_permission_id, tenant_id, access_profile_id, permission_id, created_at)
VALUES
  ('profile_permission_lia_identity_read_0001', 'tenant_lia_demo_0001', 'profile_lia_admin_0001', 'permission_identity_read_0001', '2026-06-01T00:00:00.000Z'),
  ('profile_permission_lia_session_revoke_0001', 'tenant_lia_demo_0001', 'profile_lia_admin_0001', 'permission_session_revoke_0001', '2026-06-01T00:00:00.000Z'),
  ('profile_permission_lia_profile_manage_0001', 'tenant_lia_demo_0001', 'profile_lia_admin_0001', 'permission_profile_manage_0001', '2026-06-01T00:00:00.000Z');

INSERT INTO auth_sessions (
  session_id,
  tenant_id,
  identity_id,
  access_token_hash,
  refresh_token_hash,
  effective_profile_id,
  issued_at,
  expires_at,
  refresh_expires_at,
  created_at
)
VALUES (
  'session_lia_admin_0001',
  'tenant_lia_demo_0001',
  'identity_lia_admin_0001',
  'sha256:synthetic-access-hash-lia-admin-0001-demo-only-value',
  'sha256:synthetic-refresh-hash-lia-admin-0001-demo-only-value',
  'profile_lia_admin_0001',
  '2026-06-01T00:00:00.000Z',
  '2026-06-01T01:00:00.000Z',
  '2026-06-08T00:00:00.000Z',
  '2026-06-01T00:00:00.000Z'
);

INSERT INTO identity_audit_events (audit_event_id, tenant_id, identity_id, app_user_id, event_type, actor_ref, reason, occurred_at, created_at)
VALUES ('audit_lia_identity_seed_0001', 'tenant_lia_demo_0001', 'identity_lia_admin_0001', 'user_lia_admin_0001', 'identity_created', 'system-seed', 'Seed sanitizado de identidade inicial de demonstração.', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');

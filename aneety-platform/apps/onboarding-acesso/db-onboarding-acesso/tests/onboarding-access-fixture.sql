-- Cloudflare D1-backed validation fixture for remote acceptance.
-- Precondition: apply migrations/0001_onboarding_acesso_d1.sql and seeds/0001_lia_demo_onboarding.sql first.
-- Expected result: cross-tenant and revoked/expired challenge lookups return zero rows.
PRAGMA foreign_keys = ON;

INSERT INTO onboarding_invites (invite_id, tenant_id, invitee_contact_hash, invitee_contact_hint, invited_role, invited_profile_key, status, invitation_token_hash, expires_at, created_by_actor_ref)
VALUES (
  'invite_other_demo_0001',
  'tenant_other_demo_0001',
  'hash_contact_other_demo_0001_ffffffffffffffffffffffffffffffff',
  'contato demonstrativo mascarado',
  'operador',
  'operador-demo',
  'sent',
  'hash_invitation_other_demo_0001_999999999999999999999999999999',
  '2026-06-08T00:00:00.000Z',
  'system-fixture'
);

INSERT INTO onboarding_recovery_requests (recovery_request_id, tenant_id, contact_hash, identity_ref, recovery_token_hash, status, requested_at, expires_at)
VALUES (
  'recovery_lia_demo_revoked_0001',
  'tenant_lia_demo_0001',
  'hash_contact_lia_demo_admin_0001_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'identity_lia_demo_admin_0001',
  'hash_recovery_lia_demo_revoked_ffffffffffffffffffffffffffffffff',
  'revoked',
  '2026-06-01T04:00:00.000Z',
  '2026-06-01T05:00:00.000Z'
);

UPDATE onboarding_recovery_requests
SET revoked_at = '2026-06-01T04:10:00.000Z', deleted_at = '2026-06-01T04:10:00.000Z'
WHERE tenant_id = 'tenant_lia_demo_0001' AND recovery_request_id = 'recovery_lia_demo_revoked_0001';

SELECT invite_id, tenant_id
FROM onboarding_invites
WHERE tenant_id = 'tenant_lia_demo_0001' AND invitation_token_hash = 'hash_invitation_lia_demo_0001_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' AND expires_at > '2026-06-01T00:30:00.000Z' AND status IN ('pending', 'sent') AND deleted_at IS NULL;

SELECT COUNT(*) AS cross_tenant_invites
FROM onboarding_invites
WHERE tenant_id = 'tenant_lia_demo_0001' AND invitation_token_hash = 'hash_invitation_other_demo_0001_999999999999999999999999999999';

SELECT COUNT(*) AS revoked_recovery_rows
FROM onboarding_recovery_requests
WHERE tenant_id = 'tenant_lia_demo_0001' AND recovery_token_hash = 'hash_recovery_lia_demo_revoked_ffffffffffffffffffffffffffffffff' AND status IN ('pending', 'verified') AND deleted_at IS NULL;

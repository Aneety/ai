-- Sanitized seed for demonstrative onboarding lifecycle. No real contacts, no raw challenges and no secrets.
INSERT INTO onboarding_invites (
  invite_id,
  tenant_id,
  invitee_contact_hash,
  invitee_contact_hint,
  invited_role,
  invited_profile_key,
  status,
  invitation_token_hash,
  token_hash_algorithm,
  expires_at,
  created_by_actor_ref,
  created_at,
  updated_at
)
VALUES (
  'invite_lia_demo_admin_0001',
  'tenant_lia_demo_0001',
  'hash_contact_lia_demo_admin_0001_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'contato demonstrativo mascarado',
  'admin',
  'admin-operacional',
  'sent',
  'hash_invitation_lia_demo_0001_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'sha256-hmac',
  '2026-06-08T00:00:00.000Z',
  'system-seed',
  '2026-06-01T00:00:00.000Z',
  '2026-06-01T00:00:00.000Z'
);

INSERT INTO onboarding_first_access_sessions (
  first_access_session_id,
  tenant_id,
  invite_id,
  identity_ref,
  session_token_hash,
  token_hash_algorithm,
  status,
  required_terms_version,
  started_at,
  expires_at,
  accepted_terms_at,
  completed_at,
  created_at,
  updated_at
)
VALUES (
  'first_access_lia_demo_0001',
  'tenant_lia_demo_0001',
  'invite_lia_demo_admin_0001',
  'identity_lia_demo_admin_0001',
  'hash_first_access_lia_demo_0001_cccccccccccccccccccccccccccccccc',
  'sha256-hmac',
  'completed',
  'terms-2026-06-01',
  '2026-06-01T00:05:00.000Z',
  '2026-06-02T00:05:00.000Z',
  '2026-06-01T00:08:00.000Z',
  '2026-06-01T00:10:00.000Z',
  '2026-06-01T00:05:00.000Z',
  '2026-06-01T00:10:00.000Z'
);

INSERT INTO onboarding_contact_confirmations (
  confirmation_id,
  tenant_id,
  invite_id,
  first_access_session_id,
  contact_channel,
  contact_hash,
  confirmation_token_hash,
  token_hash_algorithm,
  status,
  attempts_count,
  expires_at,
  confirmed_at,
  created_at,
  updated_at
)
VALUES (
  'confirm_lia_demo_0001',
  'tenant_lia_demo_0001',
  'invite_lia_demo_admin_0001',
  'first_access_lia_demo_0001',
  'email',
  'hash_contact_lia_demo_admin_0001_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'hash_confirmation_lia_demo_0001_dddddddddddddddddddddddddddddddd',
  'sha256-hmac',
  'confirmed',
  1,
  '2026-06-01T01:05:00.000Z',
  '2026-06-01T00:09:00.000Z',
  '2026-06-01T00:06:00.000Z',
  '2026-06-01T00:09:00.000Z'
);

INSERT INTO onboarding_recovery_requests (
  recovery_request_id,
  tenant_id,
  contact_hash,
  identity_ref,
  recovery_token_hash,
  token_hash_algorithm,
  status,
  attempts_count,
  requested_at,
  expires_at,
  verified_at,
  completed_at,
  created_at,
  updated_at
)
VALUES (
  'recovery_lia_demo_completed_0001',
  'tenant_lia_demo_0001',
  'hash_contact_lia_demo_admin_0001_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'identity_lia_demo_admin_0001',
  'hash_recovery_lia_demo_0001_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  'sha256-hmac',
  'completed',
  1,
  '2026-06-01T02:00:00.000Z',
  '2026-06-01T03:00:00.000Z',
  '2026-06-01T02:08:00.000Z',
  '2026-06-01T02:10:00.000Z',
  '2026-06-01T02:00:00.000Z',
  '2026-06-01T02:10:00.000Z'
);

INSERT INTO onboarding_lifecycle_events (lifecycle_event_id, tenant_id, invite_id, first_access_session_id, confirmation_id, recovery_request_id, event_type, actor_ref, reason, occurred_at)
VALUES
  ('onboarding_audit_lia_invite_0001', 'tenant_lia_demo_0001', 'invite_lia_demo_admin_0001', NULL, NULL, NULL, 'invite_sent', 'system-seed', 'Seed sanitizado de convite demonstrativo.', '2026-06-01T00:00:00.000Z'),
  ('onboarding_audit_lia_first_access_0001', 'tenant_lia_demo_0001', 'invite_lia_demo_admin_0001', 'first_access_lia_demo_0001', 'confirm_lia_demo_0001', NULL, 'first_access_completed', 'system-seed', 'Seed sanitizado de primeiro acesso concluído.', '2026-06-01T00:10:00.000Z'),
  ('onboarding_audit_lia_recovery_0001', 'tenant_lia_demo_0001', NULL, NULL, NULL, 'recovery_lia_demo_completed_0001', 'recovery_completed', 'system-seed', 'Seed sanitizado de recuperação concluída.', '2026-06-01T02:10:00.000Z');

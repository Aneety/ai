-- Query contract for the banco cycle. Backend/BFF may call only tenant-scoped statements and must pass only hashes for invitation, first-access, confirmation and recovery challenges.
-- Create invitation and audit event
INSERT INTO onboarding_invites (invite_id, tenant_id, invitee_contact_hash, invitee_contact_hint, invited_role, invited_profile_key, status, invitation_token_hash, token_hash_algorithm, expires_at, created_by_actor_ref)
VALUES (:invite_id, :tenant_id, :invitee_contact_hash, :invitee_contact_hint, :invited_role, :invited_profile_key, :status, :invitation_token_hash, :token_hash_algorithm, :expires_at, :created_by_actor_ref);

INSERT INTO onboarding_lifecycle_events (lifecycle_event_id, tenant_id, invite_id, event_type, actor_ref, reason)
VALUES (:lifecycle_event_id, :tenant_id, :invite_id, :event_type, :actor_ref, :reason);

-- Read a still-valid invitation by hash inside tenant boundary
SELECT invite_id, tenant_id, invitee_contact_hint, invited_role, invited_profile_key, status, expires_at, accepted_at, revoked_at
FROM onboarding_invites
WHERE tenant_id = :tenant_id AND invitation_token_hash = :invitation_token_hash AND expires_at > :now AND status IN ('pending', 'sent') AND deleted_at IS NULL;

-- Accept invitation and start first access with a hashed session challenge
UPDATE onboarding_invites
SET status = 'accepted',
    accepted_at = :accepted_at,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE tenant_id = :tenant_id AND invite_id = :invite_id AND status IN ('pending', 'sent') AND expires_at > :now AND deleted_at IS NULL;

INSERT INTO onboarding_first_access_sessions (first_access_session_id, tenant_id, invite_id, identity_ref, session_token_hash, token_hash_algorithm, status, required_terms_version, started_at, expires_at)
VALUES (:first_access_session_id, :tenant_id, :invite_id, :identity_ref, :session_token_hash, :token_hash_algorithm, :status, :required_terms_version, :started_at, :expires_at);

-- Complete first access after profile data, terms and confirmation are fulfilled
SELECT first_access_session_id, tenant_id, invite_id, identity_ref, status, required_terms_version, accepted_terms_at, expires_at
FROM onboarding_first_access_sessions
WHERE tenant_id = :tenant_id AND session_token_hash = :session_token_hash AND expires_at > :now AND revoked_at IS NULL AND deleted_at IS NULL;

UPDATE onboarding_first_access_sessions
SET status = :status,
    accepted_terms_at = :accepted_terms_at,
    completed_at = :completed_at,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE tenant_id = :tenant_id AND first_access_session_id = :first_access_session_id AND status IN ('started', 'profile_completed', 'contact_confirmed') AND expires_at > :now AND revoked_at IS NULL;

-- Request and confirm contact ownership using hashes only
INSERT INTO onboarding_contact_confirmations (confirmation_id, tenant_id, invite_id, first_access_session_id, contact_channel, contact_hash, confirmation_token_hash, token_hash_algorithm, status, expires_at)
VALUES (:confirmation_id, :tenant_id, :invite_id, :first_access_session_id, :contact_channel, :contact_hash, :confirmation_token_hash, :token_hash_algorithm, :status, :expires_at);

SELECT confirmation_id, tenant_id, invite_id, first_access_session_id, contact_channel, status, attempts_count, expires_at
FROM onboarding_contact_confirmations
WHERE tenant_id = :tenant_id AND confirmation_token_hash = :confirmation_token_hash AND expires_at > :now AND status = 'pending' AND deleted_at IS NULL;

UPDATE onboarding_contact_confirmations
SET status = 'confirmed',
    confirmed_at = :confirmed_at,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE tenant_id = :tenant_id AND confirmation_id = :confirmation_id AND status = 'pending' AND expires_at > :now;

-- Recovery lifecycle with expiration and revocation
INSERT INTO onboarding_recovery_requests (recovery_request_id, tenant_id, contact_hash, identity_ref, recovery_token_hash, token_hash_algorithm, status, requested_at, expires_at)
VALUES (:recovery_request_id, :tenant_id, :contact_hash, :identity_ref, :recovery_token_hash, :token_hash_algorithm, :status, :requested_at, :expires_at);

SELECT recovery_request_id, tenant_id, identity_ref, status, attempts_count, expires_at, verified_at
FROM onboarding_recovery_requests
WHERE tenant_id = :tenant_id AND recovery_token_hash = :recovery_token_hash AND expires_at > :now AND status IN ('pending', 'verified') AND deleted_at IS NULL;

UPDATE onboarding_recovery_requests
SET status = :status,
    verified_at = :verified_at,
    completed_at = :completed_at,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE tenant_id = :tenant_id AND recovery_request_id = :recovery_request_id AND status IN ('pending', 'verified') AND expires_at > :now AND revoked_at IS NULL;

UPDATE onboarding_recovery_requests
SET status = 'revoked',
    revoked_at = :revoked_at,
    deleted_at = COALESCE(deleted_at, :revoked_at),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE tenant_id = :tenant_id AND recovery_request_id = :recovery_request_id AND revoked_at IS NULL;

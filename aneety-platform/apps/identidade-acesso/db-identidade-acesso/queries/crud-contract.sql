-- Query contract for the banco cycle. BFF/backend may call only tenant-scoped statements and only store hashes, never raw credentials or raw session tokens.
-- Create identity, credential hash, profile and user
INSERT INTO app_identities (identity_id, tenant_id, email_hash, phone_hash, display_name, status)
VALUES (:identity_id, :tenant_id, :email_hash, :phone_hash, :display_name, :status);

INSERT INTO auth_credentials (credential_id, tenant_id, identity_id, credential_type, credential_hash, hash_algorithm, password_updated_at, expires_at)
VALUES (:credential_id, :tenant_id, :identity_id, :credential_type, :credential_hash, :hash_algorithm, :password_updated_at, :expires_at);

INSERT INTO access_profiles (access_profile_id, tenant_id, profile_key, name, role, status, is_system)
VALUES (:access_profile_id, :tenant_id, :profile_key, :name, :role, :status, :is_system);

INSERT INTO app_users (app_user_id, tenant_id, identity_id, access_profile_id, full_name, contact_label, role, is_active)
VALUES (:app_user_id, :tenant_id, :identity_id, :access_profile_id, :full_name, :contact_label, :role, :is_active);

-- Read active identity and effective permissions inside tenant boundary
SELECT identity_id, tenant_id, display_name, status, created_at, updated_at
FROM app_identities
WHERE tenant_id = :tenant_id AND identity_id = :identity_id AND deleted_at IS NULL;

SELECT credential_id, tenant_id, identity_id, credential_type, credential_hash, hash_algorithm, password_updated_at, expires_at, revoked_at
FROM auth_credentials
WHERE tenant_id = :tenant_id AND identity_id = :identity_id AND credential_type = :credential_type AND revoked_at IS NULL AND deleted_at IS NULL;

SELECT s.session_id, s.tenant_id, s.identity_id, s.effective_profile_id, s.expires_at, s.refresh_expires_at, s.revoked_at
FROM auth_sessions s
WHERE s.tenant_id = :tenant_id AND s.access_token_hash = :access_token_hash AND s.expires_at > :now AND s.revoked_at IS NULL AND s.deleted_at IS NULL;

SELECT p.permission_key, p.scope
FROM access_profile_permissions app
JOIN permissions p ON p.permission_id = app.permission_id
WHERE app.tenant_id = :tenant_id AND app.access_profile_id = :access_profile_id AND app.deleted_at IS NULL AND p.deleted_at IS NULL
ORDER BY p.permission_key ASC;

-- Issue, rotate and revoke sessions with explicit expiration/revocation
INSERT INTO auth_sessions (session_id, tenant_id, identity_id, access_token_hash, refresh_token_hash, effective_profile_id, issued_at, expires_at, refresh_expires_at, rotated_from_session_id)
VALUES (:session_id, :tenant_id, :identity_id, :access_token_hash, :refresh_token_hash, :effective_profile_id, :issued_at, :expires_at, :refresh_expires_at, :rotated_from_session_id);

UPDATE auth_sessions
SET revoked_at = :revoked_at,
    revoked_reason = :revoked_reason,
    deleted_at = COALESCE(deleted_at, :revoked_at)
WHERE tenant_id = :tenant_id AND session_id = :session_id AND revoked_at IS NULL;

UPDATE auth_credentials
SET revoked_at = :revoked_at,
    deleted_at = COALESCE(deleted_at, :revoked_at)
WHERE tenant_id = :tenant_id AND identity_id = :identity_id AND credential_type = :credential_type AND revoked_at IS NULL;

UPDATE app_users
SET is_active = :is_active,
    blocked_at = :blocked_at,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE tenant_id = :tenant_id AND app_user_id = :app_user_id;

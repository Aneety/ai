-- D1 rollback: identidade-acesso banco cycle
PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_identity_audit_events_tenant_occurred;
DROP INDEX IF EXISTS idx_access_profile_permissions_tenant_profile;
DROP INDEX IF EXISTS idx_permissions_scope_key;
DROP INDEX IF EXISTS idx_app_users_tenant_profile_status;
DROP INDEX IF EXISTS idx_access_profiles_tenant_status;
DROP INDEX IF EXISTS idx_auth_sessions_tenant_identity_expiration;
DROP INDEX IF EXISTS idx_auth_sessions_refresh_hash;
DROP INDEX IF EXISTS idx_auth_sessions_access_hash;
DROP INDEX IF EXISTS idx_auth_credentials_identity_active;
DROP INDEX IF EXISTS idx_app_identities_tenant_status;
DROP INDEX IF EXISTS idx_app_identities_tenant_phone_hash;
DROP INDEX IF EXISTS idx_app_identities_tenant_email_hash;
DROP TABLE IF EXISTS identity_audit_events;
DROP TABLE IF EXISTS access_profile_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS app_users;
DROP TABLE IF EXISTS access_profiles;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS auth_credentials;
DROP TABLE IF EXISTS app_identities;

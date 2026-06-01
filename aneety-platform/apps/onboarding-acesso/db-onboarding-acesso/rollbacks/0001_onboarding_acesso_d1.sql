-- Rollback for onboarding-acesso D1 migration 0001.
PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_onboarding_lifecycle_events_invite;
DROP INDEX IF EXISTS idx_onboarding_lifecycle_events_tenant_occurred;
DROP INDEX IF EXISTS idx_recovery_requests_tenant_contact_status;
DROP INDEX IF EXISTS idx_recovery_requests_tenant_token_hash;
DROP INDEX IF EXISTS idx_contact_confirmations_tenant_contact_status;
DROP INDEX IF EXISTS idx_contact_confirmations_tenant_token_hash;
DROP INDEX IF EXISTS idx_first_access_tenant_invite_status;
DROP INDEX IF EXISTS idx_first_access_tenant_session_hash;
DROP INDEX IF EXISTS idx_onboarding_invites_tenant_profile_status;
DROP INDEX IF EXISTS idx_onboarding_invites_tenant_contact_status;
DROP INDEX IF EXISTS idx_onboarding_invites_tenant_token_hash;

DROP TABLE IF EXISTS onboarding_lifecycle_events;
DROP TABLE IF EXISTS onboarding_recovery_requests;
DROP TABLE IF EXISTS onboarding_contact_confirmations;
DROP TABLE IF EXISTS onboarding_first_access_sessions;
DROP TABLE IF EXISTS onboarding_invites;

PRAGMA foreign_keys = ON;

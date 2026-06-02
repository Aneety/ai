-- D1 migration: identidade-acesso banco cycle
-- Runtime target: Cloudflare D1 via Workers binding IDENTIDADE_ACESSO_DB.
-- Scope: identity, credential hashes, sessions, profiles and permissions only; no plaintext credentials or raw session tokens.
PRAGMA foreign_keys = ON;

CREATE TABLE app_identities (
  identity_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email_hash TEXT,
  phone_hash TEXT,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'blocked', 'revoked', 'archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  CHECK (length(identity_id) BETWEEN 12 AND 80),
  CHECK (length(tenant_id) BETWEEN 12 AND 80),
  CHECK (email_hash IS NOT NULL OR phone_hash IS NOT NULL),
  CHECK (email_hash IS NULL OR length(email_hash) BETWEEN 32 AND 160),
  CHECK (phone_hash IS NULL OR length(phone_hash) BETWEEN 32 AND 160),
  CHECK (deleted_at IS NULL OR status = 'archived')
);

CREATE TABLE auth_credentials (
  credential_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('password', 'recovery', 'temporary')),
  credential_hash TEXT NOT NULL,
  hash_algorithm TEXT NOT NULL DEFAULT 'argon2id' CHECK (hash_algorithm IN ('argon2id', 'scrypt')),
  password_updated_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (identity_id) REFERENCES app_identities(identity_id) ON DELETE RESTRICT,
  CHECK (length(credential_hash) BETWEEN 48 AND 512),
  CHECK (expires_at IS NULL OR expires_at > created_at),
  CHECK (deleted_at IS NULL OR revoked_at IS NOT NULL)
);

CREATE TABLE auth_sessions (
  session_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  access_token_hash TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  effective_profile_id TEXT,
  issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  refresh_expires_at TEXT NOT NULL,
  rotated_from_session_id TEXT,
  revoked_at TEXT,
  revoked_reason TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (identity_id) REFERENCES app_identities(identity_id) ON DELETE RESTRICT,
  CHECK (length(access_token_hash) BETWEEN 48 AND 512),
  CHECK (length(refresh_token_hash) BETWEEN 48 AND 512),
  CHECK (expires_at > issued_at),
  CHECK (refresh_expires_at >= expires_at),
  CHECK (deleted_at IS NULL OR revoked_at IS NOT NULL)
);

CREATE TABLE access_profiles (
  access_profile_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  profile_key TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operador', 'produtor', 'entregador', 'consumidor', 'suporte')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'disabled', 'archived')),
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  UNIQUE (tenant_id, profile_key),
  CHECK (profile_key = lower(profile_key)),
  CHECK (profile_key GLOB '[a-z0-9][a-z0-9-]*'),
  CHECK (deleted_at IS NULL OR status = 'archived')
);

CREATE TABLE app_users (
  app_user_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  access_profile_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  contact_label TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operador', 'produtor', 'entregador', 'consumidor', 'suporte')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  blocked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (identity_id) REFERENCES app_identities(identity_id) ON DELETE RESTRICT,
  FOREIGN KEY (access_profile_id) REFERENCES access_profiles(access_profile_id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, identity_id),
  CHECK (blocked_at IS NULL OR is_active = 0)
);

CREATE TABLE permissions (
  permission_id TEXT PRIMARY KEY,
  permission_key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('identity', 'session', 'profile', 'permission', 'admin')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  CHECK (permission_key = lower(permission_key)),
  CHECK (permission_key GLOB '[a-z][a-z0-9:.-]*')
);

CREATE TABLE access_profile_permissions (
  profile_permission_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  access_profile_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (access_profile_id) REFERENCES access_profiles(access_profile_id) ON DELETE RESTRICT,
  FOREIGN KEY (permission_id) REFERENCES permissions(permission_id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, access_profile_id, permission_id)
);

CREATE TABLE identity_audit_events (
  audit_event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  identity_id TEXT,
  app_user_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('identity_created', 'credential_rotated', 'session_issued', 'session_revoked', 'access_denied', 'profile_changed', 'permission_granted', 'permission_revoked')),
  actor_ref TEXT NOT NULL,
  reason TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (identity_id) REFERENCES app_identities(identity_id) ON DELETE RESTRICT,
  FOREIGN KEY (app_user_id) REFERENCES app_users(app_user_id) ON DELETE RESTRICT,
  CHECK (identity_id IS NOT NULL OR app_user_id IS NOT NULL),
  CHECK (length(actor_ref) BETWEEN 3 AND 120),
  CHECK (length(reason) BETWEEN 3 AND 240)
);

CREATE UNIQUE INDEX idx_app_identities_tenant_email_hash ON app_identities(tenant_id, email_hash) WHERE email_hash IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX idx_app_identities_tenant_phone_hash ON app_identities(tenant_id, phone_hash) WHERE phone_hash IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_app_identities_tenant_status ON app_identities(tenant_id, status, updated_at);
CREATE INDEX idx_auth_credentials_identity_active ON auth_credentials(tenant_id, identity_id, credential_type, revoked_at, expires_at);
CREATE UNIQUE INDEX idx_auth_sessions_access_hash ON auth_sessions(access_token_hash);
CREATE UNIQUE INDEX idx_auth_sessions_refresh_hash ON auth_sessions(refresh_token_hash);
CREATE INDEX idx_auth_sessions_tenant_identity_expiration ON auth_sessions(tenant_id, identity_id, expires_at, revoked_at);
CREATE INDEX idx_access_profiles_tenant_status ON access_profiles(tenant_id, status, profile_key);
CREATE INDEX idx_app_users_tenant_profile_status ON app_users(tenant_id, access_profile_id, is_active, updated_at);
CREATE INDEX idx_permissions_scope_key ON permissions(scope, permission_key);
CREATE INDEX idx_access_profile_permissions_tenant_profile ON access_profile_permissions(tenant_id, access_profile_id, deleted_at);
CREATE INDEX idx_identity_audit_events_tenant_occurred ON identity_audit_events(tenant_id, occurred_at);

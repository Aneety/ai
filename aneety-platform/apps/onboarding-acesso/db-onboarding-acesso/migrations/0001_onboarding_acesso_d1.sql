-- D1 migration: onboarding-acesso banco cycle
-- Runtime target: Cloudflare D1 via Workers binding ONBOARDING_ACESSO_DB.
-- Scope: invitations, first access, contact confirmation, recovery and lifecycle audit. Raw tokens are never persisted.
PRAGMA foreign_keys = ON;

CREATE TABLE onboarding_invites (
  invite_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invitee_contact_hash TEXT NOT NULL,
  invitee_contact_hint TEXT NOT NULL,
  invited_role TEXT NOT NULL CHECK (invited_role IN ('admin', 'operador', 'produtor', 'entregador', 'consumidor', 'suporte')),
  invited_profile_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'expired', 'revoked', 'blocked')),
  invitation_token_hash TEXT NOT NULL,
  token_hash_algorithm TEXT NOT NULL DEFAULT 'sha256-hmac' CHECK (token_hash_algorithm IN ('sha256-hmac', 'sha512-hmac')),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  blocked_at TEXT,
  created_by_actor_ref TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  CHECK (length(tenant_id) BETWEEN 12 AND 80),
  CHECK (length(invitee_contact_hash) BETWEEN 48 AND 160),
  CHECK (length(invitation_token_hash) BETWEEN 48 AND 160),
  CHECK (expires_at > created_at),
  CHECK (accepted_at IS NULL OR status = 'accepted'),
  CHECK (revoked_at IS NULL OR status = 'revoked'),
  CHECK (blocked_at IS NULL OR status = 'blocked'),
  CHECK (deleted_at IS NULL OR status IN ('revoked', 'blocked', 'expired'))
);

CREATE TABLE onboarding_first_access_sessions (
  first_access_session_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invite_id TEXT NOT NULL,
  identity_ref TEXT,
  session_token_hash TEXT NOT NULL,
  token_hash_algorithm TEXT NOT NULL DEFAULT 'sha256-hmac' CHECK (token_hash_algorithm IN ('sha256-hmac', 'sha512-hmac')),
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'profile_completed', 'contact_confirmed', 'completed', 'expired', 'revoked')),
  required_terms_version TEXT,
  accepted_terms_at TEXT,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  completed_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (invite_id) REFERENCES onboarding_invites(invite_id) ON DELETE RESTRICT,
  CHECK (length(session_token_hash) BETWEEN 48 AND 160),
  CHECK (expires_at > started_at),
  CHECK (completed_at IS NULL OR status = 'completed'),
  CHECK (revoked_at IS NULL OR status = 'revoked'),
  CHECK (deleted_at IS NULL OR status IN ('completed', 'expired', 'revoked'))
);

CREATE TABLE onboarding_contact_confirmations (
  confirmation_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invite_id TEXT NOT NULL,
  first_access_session_id TEXT,
  contact_channel TEXT NOT NULL CHECK (contact_channel IN ('email', 'phone', 'whatsapp', 'internal')),
  contact_hash TEXT NOT NULL,
  confirmation_token_hash TEXT NOT NULL,
  token_hash_algorithm TEXT NOT NULL DEFAULT 'sha256-hmac' CHECK (token_hash_algorithm IN ('sha256-hmac', 'sha512-hmac')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'revoked', 'blocked')),
  attempts_count INTEGER NOT NULL DEFAULT 0 CHECK (attempts_count BETWEEN 0 AND 10),
  expires_at TEXT NOT NULL,
  confirmed_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (invite_id) REFERENCES onboarding_invites(invite_id) ON DELETE RESTRICT,
  FOREIGN KEY (first_access_session_id) REFERENCES onboarding_first_access_sessions(first_access_session_id) ON DELETE RESTRICT,
  CHECK (length(contact_hash) BETWEEN 48 AND 160),
  CHECK (length(confirmation_token_hash) BETWEEN 48 AND 160),
  CHECK (expires_at > created_at),
  CHECK (confirmed_at IS NULL OR status = 'confirmed'),
  CHECK (revoked_at IS NULL OR status = 'revoked'),
  CHECK (deleted_at IS NULL OR status IN ('confirmed', 'expired', 'revoked', 'blocked'))
);

CREATE TABLE onboarding_recovery_requests (
  recovery_request_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  contact_hash TEXT NOT NULL,
  identity_ref TEXT,
  recovery_token_hash TEXT NOT NULL,
  token_hash_algorithm TEXT NOT NULL DEFAULT 'sha256-hmac' CHECK (token_hash_algorithm IN ('sha256-hmac', 'sha512-hmac')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'completed', 'expired', 'revoked', 'blocked')),
  attempts_count INTEGER NOT NULL DEFAULT 0 CHECK (attempts_count BETWEEN 0 AND 10),
  requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  completed_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  CHECK (length(contact_hash) BETWEEN 48 AND 160),
  CHECK (length(recovery_token_hash) BETWEEN 48 AND 160),
  CHECK (expires_at > requested_at),
  CHECK (verified_at IS NULL OR status IN ('verified', 'completed')),
  CHECK (completed_at IS NULL OR status = 'completed'),
  CHECK (revoked_at IS NULL OR status = 'revoked'),
  CHECK (deleted_at IS NULL OR status IN ('completed', 'expired', 'revoked', 'blocked'))
);

CREATE TABLE onboarding_lifecycle_events (
  lifecycle_event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invite_id TEXT,
  first_access_session_id TEXT,
  confirmation_id TEXT,
  recovery_request_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('invite_created', 'invite_sent', 'invite_accepted', 'invite_expired', 'invite_revoked', 'first_access_started', 'first_access_completed', 'contact_confirmation_requested', 'contact_confirmed', 'recovery_requested', 'recovery_completed', 'lifecycle_blocked')),
  actor_ref TEXT NOT NULL,
  reason TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  FOREIGN KEY (invite_id) REFERENCES onboarding_invites(invite_id) ON DELETE RESTRICT,
  FOREIGN KEY (first_access_session_id) REFERENCES onboarding_first_access_sessions(first_access_session_id) ON DELETE RESTRICT,
  FOREIGN KEY (confirmation_id) REFERENCES onboarding_contact_confirmations(confirmation_id) ON DELETE RESTRICT,
  FOREIGN KEY (recovery_request_id) REFERENCES onboarding_recovery_requests(recovery_request_id) ON DELETE RESTRICT,
  CHECK (invite_id IS NOT NULL OR first_access_session_id IS NOT NULL OR confirmation_id IS NOT NULL OR recovery_request_id IS NOT NULL),
  CHECK (length(actor_ref) BETWEEN 3 AND 120),
  CHECK (length(reason) BETWEEN 3 AND 240)
);

CREATE UNIQUE INDEX idx_onboarding_invites_tenant_token_hash ON onboarding_invites(tenant_id, invitation_token_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_onboarding_invites_tenant_contact_status ON onboarding_invites(tenant_id, invitee_contact_hash, status, expires_at);
CREATE INDEX idx_onboarding_invites_tenant_profile_status ON onboarding_invites(tenant_id, invited_profile_key, status, updated_at);
CREATE UNIQUE INDEX idx_first_access_tenant_session_hash ON onboarding_first_access_sessions(tenant_id, session_token_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_first_access_tenant_invite_status ON onboarding_first_access_sessions(tenant_id, invite_id, status, expires_at);
CREATE UNIQUE INDEX idx_contact_confirmations_tenant_token_hash ON onboarding_contact_confirmations(tenant_id, confirmation_token_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_contact_confirmations_tenant_contact_status ON onboarding_contact_confirmations(tenant_id, contact_hash, status, expires_at);
CREATE UNIQUE INDEX idx_recovery_requests_tenant_token_hash ON onboarding_recovery_requests(tenant_id, recovery_token_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_recovery_requests_tenant_contact_status ON onboarding_recovery_requests(tenant_id, contact_hash, status, expires_at);
CREATE INDEX idx_onboarding_lifecycle_events_tenant_occurred ON onboarding_lifecycle_events(tenant_id, occurred_at);
CREATE INDEX idx_onboarding_lifecycle_events_invite ON onboarding_lifecycle_events(tenant_id, invite_id, occurred_at);

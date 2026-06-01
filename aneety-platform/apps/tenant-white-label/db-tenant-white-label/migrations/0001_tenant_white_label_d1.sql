-- D1 migration: tenant-white-label banco cycle
-- Runtime target: Cloudflare D1 via Workers binding TENANT_WHITE_LABEL_DB.
-- Scope: tenant and brand configuration metadata only; no secrets, DNS tokens or CDN credentials.
PRAGMA foreign_keys = ON;

CREATE TABLE tenants (
  tenant_id TEXT PRIMARY KEY,
  tenant_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'suspended', 'archived')),
  default_locale TEXT NOT NULL DEFAULT 'pt-BR',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  archived_at TEXT,
  CHECK (length(tenant_id) BETWEEN 12 AND 80),
  CHECK (tenant_key = lower(tenant_key)),
  CHECK (tenant_key GLOB '[a-z0-9][a-z0-9-]*'),
  CHECK (archived_at IS NULL OR status = 'archived')
);

CREATE TABLE tenant_branding (
  branding_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  brand_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  logo_asset_ref TEXT,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  surface_color TEXT NOT NULL DEFAULT '#FFFFFF',
  text_color TEXT NOT NULL DEFAULT '#111827',
  support_copy TEXT NOT NULL,
  publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'ready', 'published', 'paused', 'archived')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  active_from TEXT,
  active_until TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, brand_key),
  CHECK (brand_key = lower(brand_key)),
  CHECK (brand_key GLOB '[a-z0-9][a-z0-9-]*'),
  CHECK (primary_color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  CHECK (secondary_color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  CHECK (accent_color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  CHECK (surface_color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  CHECK (text_color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  CHECK (active_until IS NULL OR active_from IS NULL OR active_until > active_from)
);

CREATE TABLE tenant_branding_audit_events (
  audit_event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branding_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'published', 'paused', 'archived')),
  actor_ref TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (branding_id) REFERENCES tenant_branding(branding_id) ON DELETE RESTRICT,
  CHECK (length(actor_ref) BETWEEN 3 AND 120),
  CHECK (length(reason) BETWEEN 3 AND 240)
);

CREATE INDEX idx_tenants_status ON tenants(status, tenant_key);
CREATE INDEX idx_tenant_branding_tenant_status ON tenant_branding(tenant_id, publication_status, brand_key);
CREATE INDEX idx_tenant_branding_active_window ON tenant_branding(tenant_id, active_from, active_until);
CREATE INDEX idx_tenant_branding_audit_tenant_created ON tenant_branding_audit_events(tenant_id, created_at);

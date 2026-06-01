-- D1 rollback: tenant-white-label banco cycle
PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_tenant_branding_audit_tenant_created;
DROP INDEX IF EXISTS idx_tenant_branding_active_window;
DROP INDEX IF EXISTS idx_tenant_branding_tenant_status;
DROP INDEX IF EXISTS idx_tenants_status;
DROP TABLE IF EXISTS tenant_branding_audit_events;
DROP TABLE IF EXISTS tenant_branding;
DROP TABLE IF EXISTS tenants;

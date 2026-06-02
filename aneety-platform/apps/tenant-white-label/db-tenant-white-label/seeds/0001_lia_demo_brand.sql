-- Sanitized seed for the first demonstrative tenant/brand. No real customer data or secrets.
INSERT INTO tenants (tenant_id, tenant_key, display_name, status, default_locale, created_at, updated_at)
VALUES ('tenant_lia_demo_0001', 'lia-demo', 'Lia Demonstração', 'active', 'pt-BR', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');

INSERT INTO tenant_branding (
  branding_id,
  tenant_id,
  brand_key,
  display_name,
  logo_asset_ref,
  primary_color,
  secondary_color,
  accent_color,
  surface_color,
  text_color,
  support_copy,
  publication_status,
  version,
  active_from,
  created_at,
  updated_at
)
VALUES (
  'branding_lia_demo_0001',
  'tenant_lia_demo_0001',
  'lia-demo',
  'Lia Demonstração',
  'assets/brands/lia-demo/logo.svg',
  '#6D5DFB',
  '#18A999',
  '#F59E0B',
  '#FFFFFF',
  '#111827',
  'Configure marca, cores e textos antes de publicar a experiência.',
  'ready',
  1,
  '2026-06-01T00:00:00.000Z',
  '2026-06-01T00:00:00.000Z',
  '2026-06-01T00:00:00.000Z'
);

INSERT INTO tenant_branding_audit_events (audit_event_id, tenant_id, branding_id, event_type, actor_ref, reason, created_at)
VALUES ('audit_lia_demo_brand_created_0001', 'tenant_lia_demo_0001', 'branding_lia_demo_0001', 'created', 'system-seed', 'Seed sanitizado do tenant inicial de demonstração.', '2026-06-01T00:00:00.000Z');

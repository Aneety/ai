-- Cloudflare D1-backed validation fixture for remote acceptance.
-- Precondition: apply migrations/0001_tenant_white_label_d1.sql and seeds/0001_lia_demo_brand.sql first.
-- Expected result: the final SELECT returns zero rows for the other tenant brand under tenant_lia_demo_0001.
PRAGMA foreign_keys = ON;

INSERT INTO tenants (tenant_id, tenant_key, display_name, status, default_locale)
VALUES ('tenant_other_demo_0001', 'other-demo', 'Outra Demonstração', 'active', 'pt-BR');

INSERT INTO tenant_branding (branding_id, tenant_id, brand_key, display_name, primary_color, secondary_color, accent_color, support_copy, publication_status)
VALUES ('branding_other_demo_0001', 'tenant_other_demo_0001', 'other-demo', 'Outra Demonstração', '#111111', '#222222', '#333333', 'Massa sanitizada de isolamento.', 'ready');

SELECT branding_id, tenant_id, brand_key
FROM tenant_branding
WHERE tenant_id = 'tenant_lia_demo_0001' AND brand_key = 'lia-demo';

SELECT COUNT(*) AS cross_tenant_rows
FROM tenant_branding
WHERE tenant_id = 'tenant_lia_demo_0001' AND brand_key = 'other-demo';

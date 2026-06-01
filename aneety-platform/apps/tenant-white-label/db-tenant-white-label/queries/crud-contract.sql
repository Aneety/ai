-- Query contract for the banco cycle. BFF/backend may call only tenant-scoped statements.
-- Create tenant and branding
INSERT INTO tenants (tenant_id, tenant_key, display_name, status, default_locale)
VALUES (:tenant_id, :tenant_key, :display_name, :status, :default_locale);

INSERT INTO tenant_branding (branding_id, tenant_id, brand_key, display_name, primary_color, secondary_color, accent_color, support_copy)
VALUES (:branding_id, :tenant_id, :brand_key, :display_name, :primary_color, :secondary_color, :accent_color, :support_copy);

-- Read by id/key
SELECT tenant_id, tenant_key, display_name, status, default_locale
FROM tenants
WHERE tenant_id = :tenant_id;

SELECT branding_id, tenant_id, brand_key, display_name, publication_status, version
FROM tenant_branding
WHERE tenant_id = :tenant_id AND brand_key = :brand_key;

-- Read list paginated by tenant boundary
SELECT branding_id, tenant_id, brand_key, display_name, publication_status, version
FROM tenant_branding
WHERE tenant_id = :tenant_id AND publication_status = :publication_status
ORDER BY brand_key ASC
LIMIT :limit OFFSET :offset;

-- Update by tenant boundary
UPDATE tenant_branding
SET display_name = :display_name,
    primary_color = :primary_color,
    secondary_color = :secondary_color,
    accent_color = :accent_color,
    support_copy = :support_copy,
    version = version + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE tenant_id = :tenant_id AND brand_key = :brand_key;

-- Soft delete/archive by tenant boundary
UPDATE tenant_branding
SET publication_status = 'archived',
    active_until = COALESCE(active_until, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    version = version + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE tenant_id = :tenant_id AND brand_key = :brand_key;

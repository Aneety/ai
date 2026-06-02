const CONTRACT_VERSION = '2026-06-02.tenant-white-label.backend.v1';
const CONTRACT_VERSION_HEADER = 'x-aneety-contract-version';
const REQUEST_ID_HEADER = 'x-aneety-request-id';
const TENANT_ID_HEADER = 'x-aneety-tenant-id';
const PERMISSIONS_HEADER = 'x-aneety-permissions';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const ALLOWED_METHODS = ['GET', 'OPTIONS'];
const ALLOWED_HEADERS = [
  'authorization',
  'content-type',
  CONTRACT_VERSION_HEADER,
  REQUEST_ID_HEADER,
  TENANT_ID_HEADER,
  PERMISSIONS_HEADER,
];
const READ_PERMISSION = 'tenant-white-label:read';
const BRAND_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

function requestId(request) {
  return request.headers.get(REQUEST_ID_HEADER) || crypto.randomUUID();
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': ALLOWED_METHODS.join(', '),
    'access-control-allow-headers': ALLOWED_HEADERS.join(', '),
    'access-control-expose-headers': [CONTRACT_VERSION_HEADER, REQUEST_ID_HEADER].join(', '),
  };
}

function contractVersion(env = {}) {
  return env.ANEETY_CONTRACT_VERSION || CONTRACT_VERSION;
}

function jsonResponse(request, env, status, body) {
  const id = body?.error?.requestId || requestId(request);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(),
      [CONTRACT_VERSION_HEADER]: contractVersion(env),
      [REQUEST_ID_HEADER]: id,
    },
  });
}

function publicError(request, env, status, code, message) {
  return jsonResponse(request, env, status, {
    error: {
      code,
      message,
      status,
      requestId: requestId(request),
    },
  });
}

function validateContract(request, env) {
  const actual = request.headers.get(CONTRACT_VERSION_HEADER);
  const expected = contractVersion(env);

  if (!actual) {
    return {
      ok: false,
      status: 428,
      code: 'contract_version_required',
      message: 'Versão de contrato pública obrigatória.',
    };
  }

  if (actual !== expected) {
    return {
      ok: false,
      status: 412,
      code: 'contract_version_unsupported',
      message: 'Versão de contrato pública não suportada.',
    };
  }

  return { ok: true };
}

function contractBody(env) {
  return {
    service: 'worker-tenant-white-label',
    responsibility: 'tenant-white-label',
    contractVersion: contractVersion(env),
    runtime: 'cloudflare-workers',
    cycle: 'backend',
    routes: [
      {
        id: 'health',
        method: 'GET',
        path: '/health',
        requiresContractVersion: false,
        requiresTenantContext: false,
      },
      {
        id: 'contract',
        method: 'GET',
        path: '/contract',
        requiresContractVersion: true,
        requiresTenantContext: false,
      },
      {
        id: 'tenant.branding.read',
        method: 'GET',
        path: '/branding',
        requiresContractVersion: true,
        requiresTenantContext: true,
        requiredPermission: READ_PERMISSION,
      },
    ],
    bffContract: {
      storageBinding: 'TENANT_WHITE_LABEL_DB',
      tenantHeader: TENANT_ID_HEADER,
      permissionsHeader: PERMISSIONS_HEADER,
      responseShape: 'tenant-scoped-public-branding',
      isolation: 'Every query is bound by tenant_id from the gateway/BFF context; brand_key is never resolved globally.',
    },
    dataBoundaries: ['tenant', 'tenant_branding'],
  };
}

function permissionsFrom(request) {
  return new Set(
    (request.headers.get(PERMISSIONS_HEADER) || '')
      .split(',')
      .map((permission) => permission.trim())
      .filter(Boolean),
  );
}

function validateAccess(request) {
  const tenantId = request.headers.get(TENANT_ID_HEADER)?.trim();

  if (!tenantId) {
    return {
      ok: false,
      status: 401,
      code: 'tenant_context_required',
      message: 'Sessão ou contexto de tenant ausente.',
    };
  }

  if (!permissionsFrom(request).has(READ_PERMISSION)) {
    return {
      ok: false,
      status: 403,
      code: 'permission_required',
      message: 'Permissão insuficiente para consultar marca do tenant.',
    };
  }

  return { ok: true, tenantId };
}

function validateBrandKey(brandKey) {
  if (!brandKey) {
    return { ok: true, brandKey: 'lia-demo' };
  }

  if (!BRAND_KEY_PATTERN.test(brandKey)) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_brand_key',
      message: 'Identificador público de marca inválido.',
    };
  }

  return { ok: true, brandKey };
}

function requireDatabase(env) {
  return env?.TENANT_WHITE_LABEL_DB && typeof env.TENANT_WHITE_LABEL_DB.prepare === 'function';
}

async function readBranding(env, tenantId, brandKey) {
  const tenant = await env.TENANT_WHITE_LABEL_DB.prepare(
    `SELECT tenant_id, tenant_key, display_name, status, default_locale
     FROM tenants
     WHERE tenant_id = ? AND status IN ('active', 'draft')`,
  )
    .bind(tenantId)
    .first();

  if (!tenant) {
    return null;
  }

  const branding = await env.TENANT_WHITE_LABEL_DB.prepare(
    `SELECT branding_id, tenant_id, brand_key, display_name, logo_asset_ref, primary_color,
            secondary_color, accent_color, surface_color, text_color, support_copy,
            publication_status, version, active_from, active_until
     FROM tenant_branding
     WHERE tenant_id = ? AND brand_key = ? AND publication_status IN ('draft', 'ready', 'published')`,
  )
    .bind(tenantId, brandKey)
    .first();

  if (!branding) {
    return null;
  }

  return {
    tenant: {
      id: tenant.tenant_id,
      key: tenant.tenant_key,
      name: tenant.display_name,
      status: tenant.status,
      locale: tenant.default_locale,
    },
    branding: {
      id: branding.branding_id,
      key: branding.brand_key,
      name: branding.display_name,
      logoAssetRef: branding.logo_asset_ref,
      colors: {
        primary: branding.primary_color,
        secondary: branding.secondary_color,
        accent: branding.accent_color,
        surface: branding.surface_color,
        text: branding.text_color,
      },
      supportCopy: branding.support_copy,
      publicationStatus: branding.publication_status,
      version: branding.version,
      activeWindow: {
        from: branding.active_from,
        until: branding.active_until,
      },
    },
  };
}

async function handleBranding(request, env) {
  const access = validateAccess(request);
  if (!access.ok) {
    return publicError(request, env, access.status, access.code, access.message);
  }

  const url = new URL(request.url);
  const brandKey = validateBrandKey(url.searchParams.get('brandKey'));
  if (!brandKey.ok) {
    return publicError(request, env, brandKey.status, brandKey.code, brandKey.message);
  }

  if (!requireDatabase(env)) {
    return publicError(
      request,
      env,
      503,
      'backend_storage_unavailable',
      'Contrato de dados do white-label indisponível no momento.',
    );
  }

  const branding = await readBranding(env, access.tenantId, brandKey.brandKey);
  if (!branding) {
    return publicError(request, env, 404, 'branding_not_found', 'Marca não encontrada para o tenant informado.');
  }

  return jsonResponse(request, env, 200, {
    responsibility: 'tenant-white-label',
    contractVersion: contractVersion(env),
    tenantBoundary: access.tenantId,
    ...branding,
  });
}

async function handleRequest(request, env = {}) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/health') {
    return jsonResponse(request, env, 200, {
      ok: true,
      service: 'worker-tenant-white-label',
      responsibility: 'tenant-white-label',
      contractVersion: contractVersion(env),
    });
  }

  const contract = validateContract(request, env);
  if (!contract.ok) {
    return publicError(request, env, contract.status, contract.code, contract.message);
  }

  if (request.method === 'GET' && url.pathname === '/contract') {
    return jsonResponse(request, env, 200, contractBody(env));
  }

  if (request.method === 'GET' && url.pathname === '/branding') {
    return handleBranding(request, env);
  }

  if (!ALLOWED_METHODS.includes(request.method)) {
    return publicError(request, env, 405, 'method_not_allowed', 'Método não permitido para este contrato.');
  }

  return publicError(request, env, 404, 'route_not_found', 'Rota pública não encontrada.');
}

export {
  CONTRACT_VERSION,
  CONTRACT_VERSION_HEADER,
  PERMISSIONS_HEADER,
  READ_PERMISSION,
  REQUEST_ID_HEADER,
  TENANT_ID_HEADER,
  handleRequest,
};

export default {
  fetch: handleRequest,
};

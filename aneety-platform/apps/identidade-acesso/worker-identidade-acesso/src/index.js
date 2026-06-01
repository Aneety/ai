const CONTRACT_VERSION = '2026-06-01.identidade-acesso.deploy.v1';
const CONTRACT_VERSION_HEADER = 'x-aneety-contract-version';
const REQUEST_ID_HEADER = 'x-aneety-request-id';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const ALLOWED_METHODS = ['GET', 'OPTIONS'];
const ALLOWED_HEADERS = ['authorization', 'content-type', CONTRACT_VERSION_HEADER, REQUEST_ID_HEADER];

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
    service: 'worker-identidade-acesso',
    responsibility: 'identidade-acesso',
    contractVersion: contractVersion(env),
    runtime: 'cloudflare-workers',
    cycle: 'deploy',
    routes: [
      {
        id: 'health',
        method: 'GET',
        path: '/health',
        requiresContractVersion: false,
      },
      {
        id: 'contract',
        method: 'GET',
        path: '/contract',
        requiresContractVersion: true,
      },
    ],
    dataBoundaries: ['app_identities', 'auth_credentials', 'auth_sessions', 'app_users', 'access_profiles', 'permissions'],
  };
}

async function handleRequest(request, env = {}) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/health') {
    return jsonResponse(request, env, 200, {
      ok: true,
      service: 'worker-identidade-acesso',
      responsibility: 'identidade-acesso',
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

  if (!ALLOWED_METHODS.includes(request.method)) {
    return publicError(request, env, 405, 'method_not_allowed', 'Método não permitido para este contrato.');
  }

  return publicError(request, env, 404, 'route_not_found', 'Rota pública não encontrada.');
}

export { CONTRACT_VERSION, CONTRACT_VERSION_HEADER, REQUEST_ID_HEADER, handleRequest };

export default {
  fetch: handleRequest,
};

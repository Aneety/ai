import {
  CONTRACT_VERSION,
  CONTRACT_VERSION_HEADER,
  DEFAULT_ALLOWED_HEADERS,
  DEFAULT_ALLOWED_METHODS,
  ERROR_CODES,
  PUBLIC_ROUTES,
  PUBLIC_SESSION_HEADER,
  REQUEST_ID_HEADER,
  ROUTE_HEADER,
  publicError,
} from '../../pkg-contratos-publicos/index.js';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function requestId(request) {
  return request.headers.get(REQUEST_ID_HEADER) || crypto.randomUUID();
}

function corsHeaders(request, env = {}) {
  const allowedOrigins = splitList(env.ANEETY_ALLOWED_ORIGINS);
  const origin = request.headers.get('origin');
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || '*';

  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': DEFAULT_ALLOWED_METHODS.join(', '),
    'access-control-allow-headers': DEFAULT_ALLOWED_HEADERS.join(', '),
    'access-control-expose-headers': [CONTRACT_VERSION_HEADER, REQUEST_ID_HEADER, ROUTE_HEADER].join(', '),
    vary: 'Origin',
  };
}

function jsonResponse(request, env, status, body, extraHeaders = {}) {
  const headers = {
    ...JSON_HEADERS,
    ...corsHeaders(request, env),
    [CONTRACT_VERSION_HEADER]: env.ANEETY_CONTRACT_VERSION || CONTRACT_VERSION,
    [REQUEST_ID_HEADER]: body?.error?.requestId || requestId(request),
    ...extraHeaders,
  };
  return new Response(JSON.stringify(body), { status, headers });
}

function edgeError(request, env, status, code, message) {
  return jsonResponse(request, env, status, publicError(code, message, status, requestId(request)));
}

function routeFor(request) {
  const url = new URL(request.url);
  return Object.values(PUBLIC_ROUTES).find((route) => route.method === request.method && route.path === url.pathname);
}

function validateContract(request, env) {
  const expected = env.ANEETY_CONTRACT_VERSION || CONTRACT_VERSION;
  const actual = request.headers.get(CONTRACT_VERSION_HEADER);

  if (!actual) {
    return { ok: false, status: 428, code: ERROR_CODES.contractVersionRequired, message: 'Versão de contrato pública obrigatória.' };
  }

  if (actual !== expected) {
    return { ok: false, status: 412, code: ERROR_CODES.contractVersionUnsupported, message: 'Versão de contrato pública não suportada.' };
  }

  return { ok: true };
}

function validateSession(request, route) {
  if (!route.requiresSession) {
    return { ok: true };
  }

  const publicSession = request.headers.get(PUBLIC_SESSION_HEADER);
  if (!publicSession) {
    return { ok: false, status: 401, code: ERROR_CODES.publicSessionRequired, message: 'Sessão pública Aneety obrigatória.' };
  }

  return { ok: true };
}

async function forwardToBinding(request, env, route) {
  const binding = env[route.binding];
  if (!binding || typeof binding.fetch !== 'function') {
    return edgeError(request, env, 503, ERROR_CODES.upstreamUnavailable, 'Serviço Aneety indisponível para esta rota.');
  }

  const upstreamUrl = new URL(request.url);
  upstreamUrl.pathname = route.upstreamPath;

  const upstreamRequest = new Request(upstreamUrl, request);
  const upstreamResponse = await binding.fetch(upstreamRequest);
  const responseHeaders = new Headers(upstreamResponse.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) {
    responseHeaders.set(key, value);
  }
  responseHeaders.set(CONTRACT_VERSION_HEADER, env.ANEETY_CONTRACT_VERSION || CONTRACT_VERSION);
  responseHeaders.set(REQUEST_ID_HEADER, requestId(request));
  responseHeaders.set(ROUTE_HEADER, route.id);

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

async function handleRequest(request, env = {}) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
    return jsonResponse(request, env, 200, { ok: true, service: 'worker-gateway', contractVersion: env.ANEETY_CONTRACT_VERSION || CONTRACT_VERSION });
  }

  const contract = validateContract(request, env);
  if (!contract.ok) {
    return edgeError(request, env, contract.status, contract.code, contract.message);
  }

  if (request.method === 'GET' && new URL(request.url).pathname === '/contract') {
    return jsonResponse(request, env, 200, {
      contractVersion: env.ANEETY_CONTRACT_VERSION || CONTRACT_VERSION,
      routes: Object.values(PUBLIC_ROUTES).map(({ id, method, path, requiresSession }) => ({ id, method, path, requiresSession })),
    });
  }

  const route = routeFor(request);
  if (!route) {
    return edgeError(request, env, 404, ERROR_CODES.routeNotFound, 'Rota pública não encontrada.');
  }

  const session = validateSession(request, route);
  if (!session.ok) {
    return edgeError(request, env, session.status, session.code, session.message);
  }

  return forwardToBinding(request, env, route);
}

export { handleRequest };

export default {
  fetch: handleRequest,
};

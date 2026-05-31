export const CONTRACT_VERSION = '2026-05-31.gateway-borda.v1';

export const CONTRACT_VERSION_HEADER = 'x-aneety-contract-version';
export const PUBLIC_SESSION_HEADER = 'x-aneety-public-session';
export const REQUEST_ID_HEADER = 'x-aneety-request-id';
export const ROUTE_HEADER = 'x-aneety-route';

export const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

export const DEFAULT_ALLOWED_HEADERS = [
  'authorization',
  'content-type',
  CONTRACT_VERSION_HEADER,
  PUBLIC_SESSION_HEADER,
  REQUEST_ID_HEADER,
];

export const SERVICE_BINDINGS = Object.freeze({
  identidadeAcesso: {
    binding: 'IDENTIDADE_ACESSO',
    service: 'worker-identidade-acesso',
  },
  tenantWhiteLabel: {
    binding: 'TENANT_WHITE_LABEL',
    service: 'worker-tenant-white-label',
  },
  onboardingAcesso: {
    binding: 'ONBOARDING_ACESSO',
    service: 'worker-onboarding-acesso',
  },
});

export const PUBLIC_ROUTES = Object.freeze({
  health: {
    id: 'health',
    method: 'GET',
    path: '/health',
    requiresSession: false,
  },
  contract: {
    id: 'contract',
    method: 'GET',
    path: '/contract',
    requiresSession: false,
  },
  identitySession: {
    id: 'identity.session',
    method: 'POST',
    path: '/bff/identidade-acesso/session',
    binding: SERVICE_BINDINGS.identidadeAcesso.binding,
    upstreamPath: '/session',
    requiresSession: false,
  },
  tenantBranding: {
    id: 'tenant.branding',
    method: 'GET',
    path: '/bff/tenant-white-label/branding',
    binding: SERVICE_BINDINGS.tenantWhiteLabel.binding,
    upstreamPath: '/branding',
    requiresSession: true,
  },
  onboardingInvitations: {
    id: 'onboarding.invitations',
    method: 'POST',
    path: '/bff/onboarding-acesso/invitations',
    binding: SERVICE_BINDINGS.onboardingAcesso.binding,
    upstreamPath: '/invitations',
    requiresSession: true,
  },
});

export const ERROR_CODES = Object.freeze({
  contractVersionRequired: 'contract_version_required',
  contractVersionUnsupported: 'contract_version_unsupported',
  publicSessionRequired: 'public_session_required',
  routeNotFound: 'route_not_found',
  upstreamUnavailable: 'upstream_unavailable',
  methodNotAllowed: 'method_not_allowed',
});

export function publicError(code, message, status, requestId) {
  return {
    error: {
      code,
      message,
      status,
      requestId: requestId || null,
    },
  };
}

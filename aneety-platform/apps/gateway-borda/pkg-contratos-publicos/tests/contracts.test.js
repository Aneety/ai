import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTRACT_VERSION,
  CONTRACT_VERSION_HEADER,
  PUBLIC_ROUTES,
  SERVICE_BINDINGS,
  publicError,
} from '../index.js';

test('public contract exposes gateway version header and route catalog', () => {
  assert.equal(CONTRACT_VERSION_HEADER, 'x-aneety-contract-version');
  assert.match(CONTRACT_VERSION, /^2026-05-31\.gateway-borda\.v1$/);
  assert.equal(PUBLIC_ROUTES.identitySession.binding, SERVICE_BINDINGS.identidadeAcesso.binding);
  assert.equal(PUBLIC_ROUTES.tenantBranding.binding, SERVICE_BINDINGS.tenantWhiteLabel.binding);
  assert.equal(PUBLIC_ROUTES.onboardingInvitations.binding, SERVICE_BINDINGS.onboardingAcesso.binding);
  assert.equal(PUBLIC_ROUTES.tenantBranding.requiresSession, true);
});

test('public errors do not expose technical details', () => {
  assert.deepEqual(publicError('route_not_found', 'Rota pública não encontrada.', 404, 'req-1'), {
    error: {
      code: 'route_not_found',
      message: 'Rota pública não encontrada.',
      status: 404,
      requestId: 'req-1',
    },
  });
});

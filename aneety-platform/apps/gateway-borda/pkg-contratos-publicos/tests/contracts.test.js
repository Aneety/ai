import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTRACT_VERSION,
  CONTRACT_VERSION_HEADER,
  PUBLIC_ROUTES,
  publicError,
} from '../index.js';

test('public contract exposes gateway version header and route catalog', () => {
  assert.equal(CONTRACT_VERSION_HEADER, 'x-aneety-contract-version');
  assert.match(CONTRACT_VERSION, /^2026-05-31\.gateway-borda\.v1$/);
  assert.equal(PUBLIC_ROUTES.identitySession.binding, 'IDENTIDADE_ACESSO');
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

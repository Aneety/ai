import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChecksPayload, shouldFallbackToAllChecks } from '../reconcile-controller-pr.mjs';

test('fallback quando gh informa ausencia de required checks', () => {
  assert.equal(
    shouldFallbackToAllChecks("no required checks reported on the 'codex/repositorio-pedidos-customizados-2026-05-31' branch"),
    true,
  );
});

test('nao faz fallback para stderr generico', () => {
  assert.equal(shouldFallbackToAllChecks('authentication failed'), false);
});

test('aproveita json de checks mesmo com exit nao-zero', () => {
  assert.deepEqual(parseChecksPayload('[{"name":"CodeQL analysis","state":"IN_PROGRESS"}]'), [
    { name: 'CodeQL analysis', state: 'IN_PROGRESS' },
  ]);
});

test('rejeita payload invalido de checks', () => {
  assert.equal(parseChecksPayload('authentication failed'), null);
});

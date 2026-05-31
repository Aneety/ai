import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldFallbackToAllChecks } from '../reconcile-controller-pr.mjs';

test('fallback quando gh informa ausencia de required checks', () => {
  assert.equal(
    shouldFallbackToAllChecks("no required checks reported on the 'codex/repositorio-pedidos-customizados-2026-05-31' branch"),
    true,
  );
});

test('nao faz fallback para stderr generico', () => {
  assert.equal(shouldFallbackToAllChecks('authentication failed'), false);
});

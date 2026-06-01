import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChecksPayload,
  resolveMergeFailure,
  shouldFallbackToAllChecks,
} from '../reconcile-controller-pr.mjs';

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

test('merge failure vira merged quando refresh encontra PR ja mergeada', () => {
  const resolved = resolveMergeFailure(
    {
      number: '56',
      url: 'https://github.com/Aneety/ai/pull/56',
      branch: 'codex/publicacao-tenant-white-label-2026-06-01',
      headRefOid: 'abc123',
    },
    { state: 'none' },
    {
      number: 56,
      url: 'https://github.com/Aneety/ai/pull/56',
      state: 'MERGED',
      headRefName: 'codex/publicacao-tenant-white-label-2026-06-01',
      mergeCommit: { oid: 'deadbeef' },
    },
  );

  assert.equal(resolved.state, 'merged');
  assert.equal(resolved.mergedSha, 'deadbeef');
});

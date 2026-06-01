import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { shouldUseEnvGhToken as shouldUseEnvGhTokenRemoteGate } from '../remote-gate.mjs';
import { shouldUseEnvGhToken as shouldUseEnvGhTokenReconcile } from '../reconcile-controller-pr.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publishTaskDiffScript = readFileSync(path.resolve(currentDir, '../publish-task-diff.sh'), 'utf8');
const publishOperationalScript = readFileSync(path.resolve(currentDir, '../publish-operational-update.sh'), 'utf8');

test('auto auth usa GH_TOKEN do ambiente quando presente', () => {
  const env = { GH_TOKEN: 'present' };
  assert.equal(shouldUseEnvGhTokenRemoteGate(env), true);
  assert.equal(shouldUseEnvGhTokenReconcile(env), true);
});

test('flag zero continua forçando auth local sem GH_TOKEN do ambiente', () => {
  const env = { GH_TOKEN: 'present', CODEX_CLOUD_PUBLISH_USE_ENV_GH_TOKEN: '0' };
  assert.equal(shouldUseEnvGhTokenRemoteGate(env), false);
  assert.equal(shouldUseEnvGhTokenReconcile(env), false);
});

test('scripts shell de publish também preferem GH_TOKEN quando presente', () => {
  assert.match(publishTaskDiffScript, /CODEX_CLOUD_PUBLISH_USE_ENV_GH_TOKEN:-auto/);
  assert.match(publishTaskDiffScript, /\[ -n "\$\{GH_TOKEN:-\}" \]/);
  assert.match(publishOperationalScript, /CODEX_CLOUD_PUBLISH_USE_ENV_GH_TOKEN:-auto/);
  assert.match(publishOperationalScript, /\[ -n "\$\{GH_TOKEN:-\}" \]/);
});

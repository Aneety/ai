import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publishScriptPath = path.resolve(currentDir, '../publish-task-diff.sh');

test('publish-task-diff nao cria PR draft', () => {
  const script = readFileSync(publishScriptPath, 'utf8');
  assert.match(script, /gh pr create/);
  assert.doesNotMatch(script, /gh pr create[\s\S]*--draft/);
});

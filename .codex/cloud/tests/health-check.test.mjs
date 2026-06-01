import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  docsReflectSchedulerOnlyContract,
  promptReflectsSchedulerOnlyContract,
  submitScriptReflectsSchedulerOnlyContract,
} from '../health-check.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');

test('prompt cloud nao instrui criar PR ou merge e reflete contrato scheduler-only', () => {
  const prompt = readFileSync(path.join(repoRoot, '.codex', 'cloud', 'controller-prompt.md'), 'utf8');
  assert.equal(promptReflectsSchedulerOnlyContract(prompt), true);
  assert.match(prompt, /Modelo oficial: \*\*scheduler-only\*\*/);
  assert.match(prompt, /Não tente criar branch, fazer commit, fazer push, abrir PR ou fazer merge dentro desta task\./);
});

test('doc operacional reflete scheduler como writer oficial', () => {
  const markdown = readFileSync(
    path.join(repoRoot, 'docs', 'operations', 'codex-cloud-controller.md'),
    'utf8',
  );
  assert.equal(docsReflectSchedulerOnlyContract(markdown), true);
});

test('submit log explicita mutation surface scheduler-only', () => {
  const script = readFileSync(path.join(repoRoot, '.codex', 'cloud', 'submit-controller-task.sh'), 'utf8');
  assert.equal(submitScriptReflectsSchedulerOnlyContract(script), true);
});

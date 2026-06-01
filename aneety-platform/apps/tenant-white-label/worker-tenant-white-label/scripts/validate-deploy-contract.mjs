import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTRACT_VERSION } from '../src/index.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(scriptDir, '..');
const wrangler = await readFile(resolve(workerDir, 'wrangler.toml'), 'utf8');

function readScalar(name) {
  const match = wrangler.match(new RegExp(`^${name}\\s*=\\s*"([^"]+)"`, 'm'));
  return match?.[1] || '';
}

function readVars() {
  const vars = {};
  let inVars = false;
  for (const rawLine of wrangler.split('\n')) {
    const line = rawLine.trim();
    if (line === '[vars]') {
      inVars = true;
      continue;
    }
    if (inVars && line.startsWith('[')) {
      break;
    }
    if (!inVars || !line) {
      continue;
    }
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"$/);
    if (match) {
      vars[match[1]] = match[2];
    }
  }
  return vars;
}

assert.equal(readScalar('name'), 'worker-tenant-white-label', 'Cloudflare service name must match gateway binding target.');
assert.equal(readScalar('main'), 'src/index.js', 'Worker entrypoint must remain versioned.');
assert.equal(readScalar('compatibility_date'), '2024-11-01', 'Compatibility date drift must be reviewed explicitly.');
assert.match(wrangler, /^workers_dev\s*=\s*true$/m, 'workers_dev must stay enabled for remote dry-run/deploy gate.');
assert.match(wrangler, /^\[observability\]\nenabled\s*=\s*true$/m, 'Observability must stay enabled without repository secrets.');

const vars = readVars();
assert.equal(vars.ANEETY_CONTRACT_VERSION, CONTRACT_VERSION, 'Wrangler contract version must match src/index.js.');
assert.equal(vars.ANEETY_SERVICE_NAME, 'worker-tenant-white-label', 'Service identity must stay canonical.');

const secretNamePattern = /(?:TOKEN|SECRET|KEY|PASSWORD|PRIVATE|CREDENTIAL)/i;
for (const name of Object.keys(vars)) {
  assert.equal(secretNamePattern.test(name), false, `Variable ${name} looks like a secret and must not be versioned.`);
}

assert.equal(/\[\[services\]\]/.test(wrangler), false, 'Deploy shell must not introduce upstream service bindings before backend contracts exist.');

console.log('tenant-white-label deploy contract validated for Cloudflare Workers dry-run.');

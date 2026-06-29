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

function readArray(name) {
  const match = wrangler.match(new RegExp(`^${name}\\s*=\\s*\\[([^\\]]*)\\]`, 'm'));
  if (!match) return [];
  return match[1]
    .split(',')
    .map((item) => item.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function readSectionScalar(section, name) {
  const sectionMatch = wrangler.match(new RegExp(`^\\[${section}\\]\\n([\\s\\S]*?)(?:\\n\\[|$)`, 'm'));
  const body = sectionMatch?.[1] || '';
  const match = body.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\n]+)"?`, 'm'));
  return match?.[1]?.trim() || '';
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
    if (!inVars) continue;
    if (!line || line.startsWith('#')) continue;
    const matchLine = line.match(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"$/);
    if (matchLine) vars[matchLine[1]] = matchLine[2];
  }
  return vars;
}

assert.equal(readScalar('name'), 'worker-relatorios', 'Cloudflare Worker name must stay canonical.');
assert.equal(readScalar('main'), 'src/index.js', 'Worker entrypoint must remain versioned.');
assert.equal(readScalar('compatibility_date'), '2026-06-28', 'Compatibility date drift must be reviewed explicitly.');
assert.deepEqual(readArray('compatibility_flags'), ['nodejs_compat'], 'nodejs_compat must stay enabled for the Worker runtime.');
assert.match(wrangler, /^workers_dev\s*=\s*true$/m, 'workers_dev must stay enabled for remote deploy/smoke gate.');
assert.equal(readSectionScalar('observability', 'enabled'), 'true', 'Observability must stay enabled without repository secrets.');
assert.equal(readSectionScalar('browser', 'binding'), 'BROWSER', 'Browser Run binding must stay canonical.');

const vars = readVars();
assert.equal(vars.ANEETY_CONTRACT_VERSION, CONTRACT_VERSION, 'Wrangler contract version must match src/index.js.');
assert.equal(vars.ANEETY_SERVICE_NAME, 'worker-relatorios', 'Service identity must stay canonical.');
assert.equal(vars.ANEETY_REPORTS_MAX_HTML_BYTES, '1048576', 'HTML byte limit must stay explicit.');
assert.equal(vars.ANEETY_REPORTS_MAX_BROWSER_MS_PER_SMOKE, '60000', 'Smoke browser-time limit must stay explicit.');

const secretNamePattern = /(?:TOKEN|SECRET|KEY|PASSWORD|PRIVATE|CREDENTIAL)/i;
for (const name of Object.keys(vars)) {
  assert.equal(secretNamePattern.test(name), false, `Variable ${name} looks like a secret and must not be versioned.`);
}

for (const forbidden of ['[[services]]', '[[d1_databases]]', '[[r2_buckets]]', '[[queues.producers]]', '[[queues.consumers]]', 'kv_namespaces']) {
  assert.equal(wrangler.includes(forbidden), false, `${forbidden} is out of scope for report PDF v1.`);
}

console.log('relatorios-operacionais deploy contract validated for Cloudflare Workers + Browser Run Quick Actions.');

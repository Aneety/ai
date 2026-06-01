import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { CONTRACT_VERSION, SERVICE_BINDINGS } from '../../pkg-contratos-publicos/index.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(scriptDir, '..');
const wranglerPath = resolve(workerDir, 'wrangler.toml');
const wrangler = await readFile(wranglerPath, 'utf8');

const secretNamePattern = /(?:TOKEN|SECRET|KEY|PASSWORD|PRIVATE|CREDENTIAL)/i;

function readScalar(name) {
  const match = wrangler.match(new RegExp(`^${name}\\s*=\\s*"([^"]+)"`, 'm'));
  return match?.[1] ?? null;
}

function sectionBody(header) {
  const lines = wrangler.split('\n');
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) {
    return [];
  }

  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('[')) {
      break;
    }
    body.push(line);
  }

  return body;
}

function readVars() {
  return new Map(
    sectionBody('[vars]')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const [, key, value] = line.match(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"$/) || [];
        assert.ok(key, `Invalid [vars] entry in wrangler.toml: ${line}`);
        return [key, value];
      }),
  );
}

function serviceBlocks() {
  const blocks = [];
  const lines = wrangler.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== '[[services]]') {
      continue;
    }

    const body = [];
    for (const line of lines.slice(index + 1)) {
      if (line.startsWith('[')) {
        break;
      }
      body.push(line);
    }
    blocks.push(body);
  }

  return blocks;
}

function readServices() {
  const services = [];

  for (const block of serviceBlocks()) {
    const entries = Object.fromEntries(
      block
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const [, key, value] = line.match(/^([a-z_]+)\s*=\s*"([^"]*)"$/) || [];
          assert.ok(key, `Invalid [[services]] entry in wrangler.toml: ${line}`);
          return [key, value];
        }),
    );
    services.push(entries);
  }

  return services;
}

assert.equal(readScalar('main'), 'src/index.js', 'Cloudflare Worker entrypoint must stay on src/index.js.');
assert.equal(readScalar('workers_dev'), null, 'workers_dev must be parsed as boolean, not quoted.');
assert.match(wrangler, /^workers_dev\s*=\s*true$/m, 'Deploy dry-run must target Cloudflare Workers without external runtime fallback.');
assert.match(readScalar('compatibility_date') || '', /^\d{4}-\d{2}-\d{2}$/, 'compatibility_date must be pinned.');

const vars = readVars();
assert.equal(vars.get('ANEETY_CONTRACT_VERSION'), CONTRACT_VERSION, 'Wrangler contract version must match pkg-contratos-publicos.');
assert.ok(vars.has('ANEETY_ALLOWED_ORIGINS'), 'Wrangler must declare public allowed origins.');
for (const key of vars.keys()) {
  assert.ok(!secretNamePattern.test(key), `Wrangler [vars] must not contain secret-like key ${key}.`);
}

const expectedServices = Object.values(SERVICE_BINDINGS).sort((a, b) => a.binding.localeCompare(b.binding));
const actualServices = readServices().sort((a, b) => a.binding.localeCompare(b.binding));
assert.deepEqual(actualServices, expectedServices, 'Wrangler service bindings must match public gateway contract.');

console.log('Deploy contract validation OK for worker-gateway.');

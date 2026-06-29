import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const moduleRoot = resolve(import.meta.dirname, '..');
const wrangler = JSON.parse(stripJsonComments(await readFile(resolve(moduleRoot, 'wrangler.jsonc'), 'utf8')));
const pkg = JSON.parse(await readFile(resolve(moduleRoot, 'package.json'), 'utf8'));
const source = await readFile(resolve(moduleRoot, 'src/index.js'), 'utf8');
const template = await readFile(resolve(moduleRoot, 'templates/invoice-template.html'), 'utf8');

assert.equal(wrangler.name, 'worker-pagamentos', 'Worker name must be worker-pagamentos.');
assert.equal(wrangler.main, 'src/index.js', 'Worker main must be src/index.js.');
assert.ok(wrangler.compatibility_flags?.includes('nodejs_compat'), 'nodejs_compat must be enabled.');
assert.equal(wrangler.observability?.enabled, true, 'Observability must be enabled.');
assert.equal(wrangler.assets?.binding, 'ASSETS', 'ASSETS binding must be configured.');
assert.equal(wrangler.assets?.directory, '../mfe-pagamentos/dist', 'Static assets must come from mfe-pagamentos build.');
assert.equal(wrangler.assets?.not_found_handling, 'single-page-application', 'SPA fallback must be enabled.');
assert.equal(wrangler.vars?.ANEETY_CONTRACT_VERSION, '2026-06-28.pagamentos.invoice-dashboard.v1');
assert.equal(wrangler.vars?.ANEETY_REPORTS_PDF_URL, 'https://worker-relatorios.ricardomalnati.workers.dev');
assert.equal(wrangler.vars?.ANEETY_REPORTS_CONTRACT_VERSION, '2026-06-28.relatorios-operacionais.pdf.v1');
assert.ok(!JSON.stringify(wrangler.vars).includes('ANEETY_REPORTS_PDF_TOKEN'), 'PDF token must not be versioned in vars.');
assert.ok(pkg.scripts?.['smoke:published'], 'Published smoke script is required.');
assert.ok(pkg.scripts?.['assets:build'], 'Assets build script is required for Cloudflare gate.');
assert.match(source, /env\.ASSETS\.fetch\(request\)/, 'Worker must serve static assets through ASSETS binding.');
assert.match(source, /\/api\/invoices\/pdf/, 'Invoice PDF route must be implemented.');
assert.ok(template.includes('{{{itemsRowsHtml}}}'), 'Invoice template must include controlled items HTML placeholder.');

console.log('pagamentos deploy contract validated for static React assets and invoice PDF BFF.');

function stripJsonComments(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
}

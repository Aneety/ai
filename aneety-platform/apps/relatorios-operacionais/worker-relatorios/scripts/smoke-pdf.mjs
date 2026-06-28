import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRACT_VERSION_HEADER = 'x-aneety-contract-version';
const REQUEST_ID_HEADER = 'x-aneety-request-id';
const BROWSER_MS_HEADER = 'x-browser-ms-used';
const DAILY_FREE_ALLOWANCE_MS = 600000;
const DEFAULT_MAX_BROWSER_MS_PER_SMOKE = 60000;
const PROJECTED_DAILY_MS = 300000;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(scriptDir, '..');

function requireEnv(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name}_missing`);
  return value;
}

async function contractVersionFromWrangler() {
  const wrangler = await readFile(resolve(workerDir, 'wrangler.toml'), 'utf8');
  const match = wrangler.match(/^\s*ANEETY_CONTRACT_VERSION\s*=\s*"([^"]+)"\s*$/m);
  if (!match) throw new Error('contract_version_not_found');
  return match[1];
}

function route(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

async function readJson(response, label) {
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label}_invalid_json`);
  }
  return { text, json };
}

function assertStatus(response, expected, label) {
  if (response.status !== expected) {
    throw new Error(`${label}_status_${response.status}`);
  }
}

function assertContractHeaders(response, contractVersion, label) {
  if (response.headers.get(CONTRACT_VERSION_HEADER) !== contractVersion) {
    throw new Error(`${label}_contract_header_mismatch`);
  }
  if (!response.headers.get(REQUEST_ID_HEADER)) {
    throw new Error(`${label}_request_id_missing`);
  }
}

export async function runPdfSmoke({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const publishedUrl = requireEnv('ANEETY_PUBLICATION_SMOKE_URL', env);
  const token = requireEnv('ANEETY_REPORTS_PDF_TOKEN', env);
  const contractVersion = env.ANEETY_CONTRACT_VERSION?.trim() || (await contractVersionFromWrangler());
  const maxBrowserMsPerSmoke = Number.parseInt(
    env.ANEETY_REPORTS_MAX_BROWSER_MS_PER_SMOKE || `${DEFAULT_MAX_BROWSER_MS_PER_SMOKE}`,
    10,
  );
  const baseUrl = new URL(publishedUrl).toString();

  const healthResponse = await fetchImpl(route(baseUrl, '/health'), {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  assertStatus(healthResponse, 200, 'health');
  assertContractHeaders(healthResponse, contractVersion, 'health');
  const health = await readJson(healthResponse, 'health');
  if (health.json?.ok !== true) throw new Error('health_not_ok');

  const contractResponse = await fetchImpl(route(baseUrl, '/contract'), {
    method: 'GET',
    headers: { accept: 'application/json', [CONTRACT_VERSION_HEADER]: contractVersion },
  });
  assertStatus(contractResponse, 200, 'contract');
  assertContractHeaders(contractResponse, contractVersion, 'contract');
  const contract = await readJson(contractResponse, 'contract');
  if (contract.json?.contractVersion !== contractVersion) throw new Error('contract_body_mismatch');

  const reportHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      @page { size: A4; margin: 24mm; }
      body { font-family: Arial, sans-serif; }
    </style>
  </head>
  <body>
    <h1>Relatório de validação Aneety</h1>
    <p>Smoke remoto de geração PDF.</p>
  </body>
</html>`;

  const pdfResponse = await fetchImpl(route(baseUrl, '/reports/pdf'), {
    method: 'POST',
    headers: {
      accept: 'application/pdf',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      [CONTRACT_VERSION_HEADER]: contractVersion,
    },
    body: JSON.stringify({
      html: reportHtml,
      filename: 'relatorio-validacao-aneety.pdf',
      pdfOptions: {
        format: 'A4',
        landscape: false,
        printBackground: true,
        preferCSSPageSize: true,
      },
    }),
  });
  assertStatus(pdfResponse, 200, 'pdf');
  assertContractHeaders(pdfResponse, contractVersion, 'pdf');
  const contentType = (pdfResponse.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/pdf') throw new Error(`pdf_content_type_${contentType || 'missing'}`);
  const bytes = new Uint8Array(await pdfResponse.arrayBuffer());
  const startsWithPdfMagic = new TextDecoder().decode(bytes.slice(0, 4)) === '%PDF';
  if (!startsWithPdfMagic) throw new Error('pdf_magic_missing');
  const browserMsRaw = pdfResponse.headers.get(BROWSER_MS_HEADER) || pdfResponse.headers.get('X-Browser-Ms-Used') || '';
  const browserMsUsed = Number.parseInt(browserMsRaw, 10);
  if (!Number.isFinite(browserMsUsed) || browserMsUsed < 0) throw new Error('browser_ms_used_missing');
  if (browserMsUsed > maxBrowserMsPerSmoke) throw new Error('browser_ms_used_over_smoke_limit');

  return {
    pdfSmoke: {
      status: 'success',
      contentType,
      startsWithPdfMagic,
      browserMsUsed,
      browserDailyFreeAllowanceMs: DAILY_FREE_ALLOWANCE_MS,
      browserProjectedDailyMs: PROJECTED_DAILY_MS,
      bytes: bytes.byteLength,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPdfSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error.message || String(error));
      process.exit(1);
    });
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const CONTRACT_VERSION_HEADER = 'x-aneety-contract-version';
const REQUEST_ID_HEADER = 'x-aneety-request-id';

function assertNonEmpty(value, label) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw new Error(`${label}_missing`);
  }
  return normalized;
}

export function extractContractVersionFromWrangler(source) {
  const match = String(source).match(/^\s*ANEETY_CONTRACT_VERSION\s*=\s*"([^"]+)"\s*$/m);
  if (!match) {
    throw new Error('contract_version_not_found');
  }
  return match[1].trim();
}

export async function resolveSmokeContext({ publishedUrl, modulePath, repoRoot = process.cwd() }) {
  const normalizedUrl = assertNonEmpty(publishedUrl, 'published_url');
  const normalizedModulePath = assertNonEmpty(modulePath, 'module_path');
  const wranglerPath = path.join(repoRoot, normalizedModulePath, 'wrangler.toml');
  const wrangler = await readFile(wranglerPath, 'utf8');
  const contractVersion = extractContractVersionFromWrangler(wrangler);
  const origin = new URL(normalizedUrl).toString();
  return {
    publishedUrl: origin,
    modulePath: normalizedModulePath,
    contractVersion,
    healthUrl: new URL('/health', origin).toString(),
    contractUrl: new URL('/contract', origin).toString(),
  };
}

export async function moduleHasPublishedSmokeScript({ modulePath, repoRoot = process.cwd() }) {
  const normalizedModulePath = assertNonEmpty(modulePath, 'module_path');
  const packagePath = path.join(repoRoot, normalizedModulePath, 'package.json');
  try {
    const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
    return Boolean(pkg?.scripts?.['smoke:published']);
  } catch {
    return false;
  }
}

async function readJsonResponse(response, label) {
  const bodyText = await response.text();
  let bodyJson = null;
  if (bodyText) {
    try {
      bodyJson = JSON.parse(bodyText);
    } catch {
      bodyJson = null;
    }
  }

  return {
    label,
    status: response.status,
    contractVersionHeader: response.headers.get(CONTRACT_VERSION_HEADER) || '',
    requestIdHeader: response.headers.get(REQUEST_ID_HEADER) || '',
    bodyText,
    bodyJson,
    bodyBytes: Buffer.byteLength(bodyText, 'utf8'),
  };
}

function assertOkRoute(route, expectedStatus, expectedContractVersion, requireBodyContractVersion = false) {
  if (route.status !== expectedStatus) {
    throw new Error(`${route.label}_status_${route.status}`);
  }
  if (route.contractVersionHeader !== expectedContractVersion) {
    throw new Error(`${route.label}_contract_header_mismatch`);
  }
  if (!route.requestIdHeader) {
    throw new Error(`${route.label}_request_id_missing`);
  }
  if (route.bodyJson?.ok === false) {
    throw new Error(`${route.label}_body_not_ok`);
  }
  if (requireBodyContractVersion && route.bodyJson?.contractVersion !== expectedContractVersion) {
    throw new Error(`${route.label}_body_contract_mismatch`);
  }
}

export async function runPublicationSmoke({ publishedUrl, modulePath, repoRoot = process.cwd(), fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch_unavailable');
  }

  const context = await resolveSmokeContext({ publishedUrl, modulePath, repoRoot });

  const healthResponse = await fetchImpl(context.healthUrl, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
    },
  });
  const health = await readJsonResponse(healthResponse, 'health');
  assertOkRoute(health, 200, context.contractVersion, true);

  const contractResponse = await fetchImpl(context.contractUrl, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      [CONTRACT_VERSION_HEADER]: context.contractVersion,
    },
  });
  const contract = await readJsonResponse(contractResponse, 'contract');
  assertOkRoute(contract, 200, context.contractVersion, true);

  return {
    ...context,
    routes: {
      health: {
        status: health.status,
        bytes: health.bodyBytes,
      },
      contract: {
        status: contract.status,
        bytes: contract.bodyBytes,
      },
    },
  };
}

async function main(argv = process.argv.slice(2)) {
  const [publishedUrl, modulePath] = argv;
  const result = await runPublicationSmoke({ publishedUrl, modulePath });
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}

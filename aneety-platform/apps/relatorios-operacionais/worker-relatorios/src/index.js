export const CONTRACT_VERSION = '2026-06-28.relatorios-operacionais.pdf.v1';
export const CONTRACT_VERSION_HEADER = 'x-aneety-contract-version';
export const REQUEST_ID_HEADER = 'x-aneety-request-id';
export const BROWSER_MS_HEADER = 'x-browser-ms-used';

const SERVICE_NAME = 'worker-relatorios';
const RESPONSIBILITY = 'relatorios-operacionais';
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const ALLOWED_METHODS = ['GET', 'POST', 'OPTIONS'];
const ALLOWED_HEADERS = ['authorization', 'content-type', CONTRACT_VERSION_HEADER, REQUEST_ID_HEADER];
const EXPOSED_HEADERS = [CONTRACT_VERSION_HEADER, REQUEST_ID_HEADER, BROWSER_MS_HEADER, 'content-disposition'];
const DEFAULT_MAX_HTML_BYTES = 1_048_576;
const DEFAULT_MAX_REQUEST_BYTES = DEFAULT_MAX_HTML_BYTES + 65_536;
const DEFAULT_FILENAME = 'relatorio.pdf';
const DEFAULT_PDF_OPTIONS = Object.freeze({
  format: 'a4',
  landscape: false,
  printBackground: true,
  preferCSSPageSize: true,
});
const ALLOWED_FORMATS = new Set(['a3', 'a4', 'a5', 'letter', 'legal']);
const encoder = new TextEncoder();

const DANGEROUS_HTML_PATTERNS = [
  { pattern: /<\s*script\b/i, code: 'script_tag' },
  { pattern: /\son[a-z0-9_-]+\s*=/i, code: 'inline_event_handler' },
  { pattern: /javascript\s*:/i, code: 'javascript_url' },
  { pattern: /data\s*:\s*text\/html/i, code: 'html_data_url' },
  { pattern: /@import\b/i, code: 'css_import' },
  { pattern: /url\(\s*['"]?https?:\/\//i, code: 'external_css_url' },
  { pattern: /url\(\s*['"]?\/\//i, code: 'protocol_relative_css_url' },
  { pattern: /<\s*(?:iframe|object|embed)\b/i, code: 'embedded_external_content' },
  { pattern: /<\s*link\b[^>]*\brel\s*=\s*['"]?stylesheet/i, code: 'external_stylesheet' },
  { pattern: /\b(?:src|href|poster)\s*=\s*['"]?https?:\/\//i, code: 'external_resource' },
  { pattern: /\b(?:src|href|poster)\s*=\s*['"]?\/\//i, code: 'protocol_relative_resource' },
  { pattern: /\bsrc\s*=\s*['"]?data:(?!image\/(?:png|jpe?g|gif|webp);base64,)/i, code: 'unsupported_data_resource' },
];

function requestId(request) {
  return request.headers.get(REQUEST_ID_HEADER) || crypto.randomUUID();
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': ALLOWED_METHODS.join(', '),
    'access-control-allow-headers': ALLOWED_HEADERS.join(', '),
    'access-control-expose-headers': EXPOSED_HEADERS.join(', '),
  };
}

function contractVersion(env = {}) {
  return env.ANEETY_CONTRACT_VERSION || CONTRACT_VERSION;
}

function maxHtmlBytes(env = {}) {
  const parsed = Number.parseInt(env.ANEETY_REPORTS_MAX_HTML_BYTES || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_HTML_BYTES;
}

function jsonResponse(request, env, status, body, extraHeaders = {}) {
  const id = body?.error?.requestId || requestId(request);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(),
      [CONTRACT_VERSION_HEADER]: contractVersion(env),
      [REQUEST_ID_HEADER]: id,
      ...extraHeaders,
    },
  });
}

function publicError(request, env, status, code, message) {
  return jsonResponse(request, env, status, {
    error: {
      code,
      message,
      status,
      requestId: requestId(request),
    },
  });
}

function validationFailure(status, code, message) {
  const error = new Error(message);
  error.publicStatus = status;
  error.publicCode = code;
  error.publicMessage = message;
  return error;
}

function validateContract(request, env) {
  const actual = request.headers.get(CONTRACT_VERSION_HEADER);
  const expected = contractVersion(env);

  if (!actual) {
    return {
      ok: false,
      status: 428,
      code: 'contract_version_required',
      message: 'Versão de contrato pública obrigatória.',
    };
  }

  if (actual !== expected) {
    return {
      ok: false,
      status: 412,
      code: 'contract_version_unsupported',
      message: 'Versão de contrato pública não suportada.',
    };
  }

  return { ok: true };
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function timingSafeTokenEqual(actual, expected) {
  if (!actual || !expected) return false;
  const [actualDigest, expectedDigest] = await Promise.all([sha256(actual), sha256(expected)]);
  let diff = actual.length === expected.length ? 0 : 1;
  for (let index = 0; index < actualDigest.length; index += 1) {
    diff |= actualDigest[index] ^ expectedDigest[index];
  }
  return diff === 0;
}

async function validateBearerToken(request, env) {
  const expected = String(env.ANEETY_REPORTS_PDF_TOKEN || '').trim();
  if (!expected) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Acesso operacional não autorizado.',
    };
  }

  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !(await timingSafeTokenEqual(match[1].trim(), expected))) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Acesso operacional não autorizado.',
    };
  }

  return { ok: true };
}

function contractBody(env) {
  return {
    ok: true,
    service: SERVICE_NAME,
    responsibility: RESPONSIBILITY,
    contractVersion: contractVersion(env),
    runtime: 'cloudflare-workers',
    cycle: 'publicacao',
    reportContract: {
      output: 'application/pdf',
      delivery: 'direct-response',
      persistence: 'none-v1',
      maxHtmlBytes: maxHtmlBytes(env),
      externalResources: 'blocked-v1',
      templateEngine: 'simple-token-replacement-v1',
      browserMsHeader: BROWSER_MS_HEADER,
    },
    routes: [
      {
        id: 'health',
        method: 'GET',
        path: '/health',
        requiresContractVersion: false,
        requiresBearerToken: false,
        callsPdfRenderer: false,
      },
      {
        id: 'contract',
        method: 'GET',
        path: '/contract',
        requiresContractVersion: true,
        requiresBearerToken: false,
        callsPdfRenderer: false,
      },
      {
        id: 'reports.pdf.create',
        method: 'POST',
        path: '/reports/pdf',
        requiresContractVersion: true,
        requiresBearerToken: true,
        contentType: 'application/json',
        callsPdfRenderer: true,
      },
    ],
  };
}

async function readRequestTextWithinLimit(request, byteLimit) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && Number.parseInt(contentLength, 10) > byteLimit) {
    throw validationFailure(413, 'payload_too_large', 'O relatório enviado ultrapassa o limite permitido.');
  }

  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > byteLimit) {
      throw validationFailure(413, 'payload_too_large', 'O relatório enviado ultrapassa o limite permitido.');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function parseJsonPayload(raw) {
  try {
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('payload_not_object');
    }
    return payload;
  } catch {
    throw validationFailure(400, 'invalid_report_payload', 'Não foi possível ler os dados do relatório.');
  }
}

function readContentField(content, path) {
  if (!content || typeof content !== 'object') return '';
  const parts = String(path).split('.').filter(Boolean);
  let value = content;
  for (const part of parts) {
    if (!value || typeof value !== 'object' || !(part in value)) return '';
    value = value[part];
  }
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function assertSafeHtml(html) {
  const source = String(html);
  for (const { pattern } of DANGEROUS_HTML_PATTERNS) {
    if (pattern.test(source)) {
      throw validationFailure(400, 'invalid_report_html', 'Não foi possível preparar o relatório com o conteúdo enviado.');
    }
  }
  return source;
}

function renderTemplate(templateHtml, content) {
  let rendered = String(templateHtml).replace(/\{\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}\}/g, (_match, key) => {
    return assertSafeHtml(readContentField(content, key));
  });

  rendered = rendered.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, key) => {
    return escapeHtml(readContentField(content, key));
  });

  return rendered;
}

function normalizeFilename(value) {
  const fallback = DEFAULT_FILENAME;
  const raw = typeof value === 'string' ? value.trim() : '';
  const withoutQuery = raw.split(/[?#]/)[0];
  const leaf = withoutQuery.split(/[\\/]/).pop() || fallback;
  const normalized = leaf
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 120);
  const base = normalized || 'relatorio';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

function normalizePdfOptions(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const requestedFormat = typeof source.format === 'string' ? source.format.trim().toLowerCase() : '';
  const format = ALLOWED_FORMATS.has(requestedFormat) ? requestedFormat : DEFAULT_PDF_OPTIONS.format;
  return {
    format,
    landscape: typeof source.landscape === 'boolean' ? source.landscape : DEFAULT_PDF_OPTIONS.landscape,
    printBackground: typeof source.printBackground === 'boolean' ? source.printBackground : DEFAULT_PDF_OPTIONS.printBackground,
    preferCSSPageSize:
      typeof source.preferCSSPageSize === 'boolean' ? source.preferCSSPageSize : DEFAULT_PDF_OPTIONS.preferCSSPageSize,
  };
}

function prepareReport(payload, env) {
  const hasHtml = typeof payload.html === 'string' && payload.html.trim().length > 0;
  const hasTemplate = typeof payload.templateHtml === 'string' && payload.templateHtml.trim().length > 0;

  if ((hasHtml && hasTemplate) || (!hasHtml && !hasTemplate)) {
    throw validationFailure(400, 'invalid_report_payload', 'Informe HTML final ou template com conteúdo do relatório.');
  }

  if (hasTemplate && (!payload.content || typeof payload.content !== 'object' || Array.isArray(payload.content))) {
    throw validationFailure(400, 'invalid_report_payload', 'Informe o conteúdo do relatório para o template enviado.');
  }

  const renderedHtml = hasHtml ? String(payload.html) : renderTemplate(payload.templateHtml, payload.content);
  assertSafeHtml(renderedHtml);

  const bytes = encoder.encode(renderedHtml).byteLength;
  if (bytes > maxHtmlBytes(env)) {
    throw validationFailure(413, 'payload_too_large', 'O relatório enviado ultrapassa o limite permitido.');
  }

  return {
    renderedHtml,
    filename: normalizeFilename(payload.filename),
    pdfOptions: normalizePdfOptions(payload.pdfOptions),
    htmlBytes: bytes,
  };
}

async function handleHealth(request, env) {
  return jsonResponse(request, env, 200, {
    ok: true,
    service: SERVICE_NAME,
    responsibility: RESPONSIBILITY,
    contractVersion: contractVersion(env),
  });
}

async function handleContract(request, env) {
  const contract = validateContract(request, env);
  if (!contract.ok) {
    return publicError(request, env, contract.status, contract.code, contract.message);
  }

  return jsonResponse(request, env, 200, contractBody(env));
}

async function callPdfRenderer(env, renderedHtml, pdfOptions) {
  if (!env?.BROWSER || typeof env.BROWSER.quickAction !== 'function') {
    throw new Error('pdf_renderer_unavailable');
  }

  return await env.BROWSER.quickAction('pdf', {
    html: renderedHtml,
    pdfOptions,
  });
}

async function normalizePdfResult(result) {
  if (result instanceof Response) {
    if (!result.ok) throw new Error('pdf_renderer_failed');
    return {
      body: result.body ?? (await result.arrayBuffer()),
      headers: result.headers,
    };
  }

  if (result instanceof ArrayBuffer || ArrayBuffer.isView(result) || result instanceof Blob || result instanceof ReadableStream) {
    return {
      body: result,
      headers: new Headers(),
    };
  }

  throw new Error('pdf_renderer_invalid_response');
}

async function handlePdf(request, env) {
  const contract = validateContract(request, env);
  if (!contract.ok) {
    return publicError(request, env, contract.status, contract.code, contract.message);
  }

  const token = await validateBearerToken(request, env);
  if (!token.ok) {
    return publicError(request, env, token.status, token.code, token.message);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return publicError(request, env, 400, 'invalid_report_payload', 'Envie os dados do relatório em formato JSON.');
  }

  let report;
  try {
    const raw = await readRequestTextWithinLimit(request, maxHtmlBytes(env) + 65_536 || DEFAULT_MAX_REQUEST_BYTES);
    const payload = parseJsonPayload(raw);
    report = prepareReport(payload, env);
  } catch (error) {
    if (error.publicCode) {
      return publicError(request, env, error.publicStatus, error.publicCode, error.publicMessage);
    }
    return publicError(request, env, 400, 'invalid_report_payload', 'Não foi possível ler os dados do relatório.');
  }

  try {
    const pdfResult = await callPdfRenderer(env, report.renderedHtml, report.pdfOptions);
    const normalized = await normalizePdfResult(pdfResult);
    const browserMsUsed = normalized.headers.get(BROWSER_MS_HEADER) || normalized.headers.get('X-Browser-Ms-Used') || '';
    const headers = {
      ...corsHeaders(),
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${report.filename}"`,
      [CONTRACT_VERSION_HEADER]: contractVersion(env),
      [REQUEST_ID_HEADER]: requestId(request),
    };
    if (browserMsUsed) {
      headers[BROWSER_MS_HEADER] = browserMsUsed;
    }
    return new Response(normalized.body, { status: 200, headers });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'pdf_generation_failed',
        requestId: requestId(request),
        errorName: error?.name || 'Error',
        errorMessage: error?.message || 'PDF generation failed',
      }),
    );
    return publicError(request, env, 502, 'pdf_generation_failed', 'Não foi possível gerar o PDF neste momento.');
  }
}

export async function handleRequest(request, env = {}) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/health') {
    return handleHealth(request, env);
  }

  if (request.method === 'GET' && url.pathname === '/contract') {
    return handleContract(request, env);
  }

  if (request.method === 'POST' && url.pathname === '/reports/pdf') {
    return handlePdf(request, env);
  }

  if (['GET', 'POST'].includes(request.method)) {
    return publicError(request, env, 404, 'route_not_found', 'Rota não encontrada.');
  }

  return publicError(request, env, 405, 'method_not_allowed', 'Método não permitido para este serviço.');
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

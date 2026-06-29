import { INVOICE_TEMPLATE } from './invoice-template.js';

const CONTRACT_VERSION = '2026-06-28.pagamentos.invoice-dashboard.v1';
const DEFAULT_REPORTS_CONTRACT_VERSION = '2026-06-28.relatorios-operacionais.pdf.v1';
const DEFAULT_REPORTS_URL = 'https://worker-relatorios.ricardomalnati.workers.dev';
const DEFAULT_MAX_ITEMS = 20;
const DEFAULT_MAX_REQUEST_BYTES = 65_536;
const BROWSER_MS_HEADER = 'x-browser-ms-used';

const PAYMENT_METHOD_LABELS = Object.freeze({
  pix: 'PIX',
  card: 'Cartão',
  bank_slip: 'Boleto',
  transfer: 'Transferência',
  cash: 'Dinheiro',
});

const STATUS_LABELS = Object.freeze({
  draft: 'Rascunho',
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencida',
});

const PUBLIC_ROUTES = Object.freeze([
  { method: 'GET', path: '/health', auth: 'none' },
  { method: 'GET', path: '/contract', auth: 'contract-version' },
  { method: 'POST', path: '/api/invoices/pdf', auth: 'public-form' },
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsResponse(request);
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return jsonResponse(
        {
          ok: true,
          service: 'pagamentos',
          contractVersion: contractVersion(env),
          routes: ['/health', '/contract', '/api/invoices/pdf'],
        },
        successHeaders(request, env),
      );
    }

    if (url.pathname === '/contract' && request.method === 'GET') {
      const gate = requireContractVersion(request, env);
      if (gate) return gate;
      return jsonResponse(
        {
          service: 'pagamentos',
          contractVersion: contractVersion(env),
          purpose: 'Geração operacional de faturas em PDF',
          routes: PUBLIC_ROUTES,
          limits: {
            maxItems: maxItems(env),
            maxRequestBytes: maxRequestBytes(env),
            persistence: 'none',
          },
        },
        successHeaders(request, env),
      );
    }

    if (url.pathname === '/api/invoices/pdf') {
      if (request.method !== 'POST') {
        return publicError(request, env, 405, 'method_not_allowed', 'Esta ação não está disponível por este caminho.');
      }
      return handleInvoicePdf(request, env);
    }

    if (url.pathname.startsWith('/api/')) {
      return publicError(request, env, 404, 'route_not_found', 'Não encontramos a ação solicitada.');
    }

    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Interface de faturas indisponível.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};

export async function handleInvoicePdf(request, env) {
  const gate = requireContractVersion(request, env);
  if (gate) return gate;

  if (!hasJsonContentType(request)) {
    return publicError(request, env, 400, 'invalid_invoice_payload', 'Revise os dados da fatura antes de gerar o PDF.');
  }

  if (!env.ANEETY_REPORTS_PDF_TOKEN) {
    return publicError(request, env, 503, 'invoice_pdf_unavailable', 'A geração de PDF está temporariamente indisponível.');
  }

  let payload;
  try {
    payload = await readJsonBody(request, maxRequestBytes(env));
  } catch (error) {
    const status = error?.code === 'payload_too_large' ? 413 : 400;
    const code = error?.code === 'payload_too_large' ? 'payload_too_large' : 'invalid_invoice_payload';
    return publicError(request, env, status, code, 'Revise os dados da fatura antes de gerar o PDF.');
  }

  let normalized;
  try {
    normalized = normalizeInvoice(payload, { maxItems: maxItems(env) });
  } catch {
    return publicError(request, env, 400, 'invalid_invoice_payload', 'Revise os dados da fatura antes de gerar o PDF.');
  }

  const reportPayload = buildReportPayload(normalized);
  const reportsUrl = normalizeReportsUrl(env.ANEETY_REPORTS_PDF_URL || DEFAULT_REPORTS_URL);
  const reportsContractVersion = env.ANEETY_REPORTS_CONTRACT_VERSION || DEFAULT_REPORTS_CONTRACT_VERSION;
  const requestIdValue = requestId(request);

  let reportResponse;
  try {
    reportResponse = await fetch(`${reportsUrl}/reports/pdf`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.ANEETY_REPORTS_PDF_TOKEN}`,
        'content-type': 'application/json',
        'x-aneety-contract-version': reportsContractVersion,
        'x-aneety-request-id': requestIdValue,
      },
      body: JSON.stringify(reportPayload),
    });
  } catch (error) {
    logPdfFailure(requestIdValue, error);
    return publicError(request, env, 502, 'invoice_pdf_failed', 'Não foi possível gerar o PDF neste momento.');
  }

  if (!reportResponse.ok || !isPdfResponse(reportResponse)) {
    logPdfFailure(requestIdValue, new Error(`pdf_response_${reportResponse.status}`));
    return publicError(request, env, 502, 'invoice_pdf_failed', 'Não foi possível gerar o PDF neste momento.');
  }

  const headers = {
    'content-type': 'application/pdf',
    'content-disposition': `attachment; filename="${reportPayload.filename}"`,
    'x-aneety-contract-version': contractVersion(env),
    'x-aneety-request-id': requestIdValue,
    'cache-control': 'no-store',
  };
  const browserMsUsed = reportResponse.headers.get(BROWSER_MS_HEADER);
  if (browserMsUsed) headers[BROWSER_MS_HEADER] = browserMsUsed;

  return new Response(reportResponse.body, { status: 200, headers });
}

export function buildReportPayload(invoice) {
  const rows = invoice.items
    .map((item) => {
      const total = item.quantity * item.unitAmount;
      return `<tr><td>${escapeHtml(item.description)}</td><td class="number">${formatQuantity(item.quantity)}</td><td class="number">${formatCurrency(item.unitAmount)}</td><td class="number">${formatCurrency(total)}</td></tr>`;
    })
    .join('');

  const subtotal = calculateSubtotal(invoice.items);
  const total = Math.max(0, subtotal - invoice.discountAmount + invoice.surchargeAmount);

  return {
    templateHtml: INVOICE_TEMPLATE,
    content: {
      invoiceNumber: invoice.invoice.number,
      issuedAt: formatDate(invoice.invoice.issuedAt),
      dueAt: formatDate(invoice.invoice.dueAt),
      paymentMethodLabel: PAYMENT_METHOD_LABELS[invoice.invoice.paymentMethod] || invoice.invoice.paymentMethod,
      statusLabel: STATUS_LABELS[invoice.invoice.status] || invoice.invoice.status,
      customerName: invoice.customer.name,
      customerDocument: invoice.customer.document,
      customerEmail: invoice.customer.email,
      customerAddress: invoice.customer.address,
      itemsRowsHtml: rows,
      subtotalFormatted: formatCurrency(subtotal),
      discountFormatted: formatCurrency(invoice.discountAmount),
      surchargeFormatted: formatCurrency(invoice.surchargeAmount),
      totalFormatted: formatCurrency(total),
      notes: invoice.invoice.notes || 'Sem observações.',
    },
    filename: normalizeFilename(`fatura-${invoice.invoice.number}.pdf`),
    pdfOptions: {
      format: 'A4',
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
    },
  };
}

export function normalizeInvoice(payload, { maxItems = DEFAULT_MAX_ITEMS } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid');
  const customer = payload.customer && typeof payload.customer === 'object' ? payload.customer : {};
  const invoice = payload.invoice && typeof payload.invoice === 'object' ? payload.invoice : {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length < 1 || items.length > maxItems) throw new Error('invalid');

  const normalized = {
    customer: {
      name: requiredText(customer.name, 120),
      document: requiredText(customer.document, 64),
      email: optionalText(customer.email, 160),
      address: requiredText(customer.address, 240),
    },
    invoice: {
      number: requiredText(invoice.number, 48),
      issuedAt: requiredDate(invoice.issuedAt),
      dueAt: requiredDate(invoice.dueAt),
      paymentMethod: allowedValue(invoice.paymentMethod, Object.keys(PAYMENT_METHOD_LABELS)),
      status: allowedValue(invoice.status, Object.keys(STATUS_LABELS)),
      notes: optionalText(invoice.notes, 600),
    },
    items: items.map((item) => normalizeItem(item)),
    discountAmount: moneyValue(payload.discountAmount ?? 0, 0),
    surchargeAmount: moneyValue(payload.surchargeAmount ?? 0, 0),
  };

  if (new Date(normalized.invoice.dueAt).getTime() < new Date(normalized.invoice.issuedAt).getTime()) throw new Error('invalid');
  return normalized;
}

function normalizeItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('invalid');
  return {
    description: requiredText(item.description, 160),
    quantity: moneyValue(item.quantity, 0.01),
    unitAmount: moneyValue(item.unitAmount, 0),
  };
}

function requiredText(value, maxLength) {
  const text = optionalText(value, maxLength).trim();
  if (!text) throw new Error('invalid');
  return text;
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new Error('invalid');
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length > maxLength) throw new Error('invalid');
  return text;
}

function requiredDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('invalid');
  const time = new Date(`${value}T00:00:00Z`).getTime();
  if (!Number.isFinite(time)) throw new Error('invalid');
  return value;
}

function allowedValue(value, allowed) {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error('invalid');
  return value;
}

function moneyValue(value, min) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > 999_999_999) throw new Error('invalid');
  return Math.round(number * 100) / 100;
}

function calculateSubtotal(items) {
  return Math.round(items.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0) * 100) / 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatQuantity(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function normalizeFilename(value) {
  const cleaned = String(value || '')
    .replace(/[\\/?:*"<>|#%{}~&]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
  const base = cleaned || 'fatura.pdf';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

async function readJsonBody(request, maxBytes) {
  const length = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (Number.isFinite(length) && length > maxBytes) {
    const error = new Error('payload too large');
    error.code = 'payload_too_large';
    throw error;
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    const error = new Error('payload too large');
    error.code = 'payload_too_large';
    throw error;
  }
  return JSON.parse(body);
}

function hasJsonContentType(request) {
  return (request.headers.get('content-type') || '').toLowerCase().includes('application/json');
}

function isPdfResponse(response) {
  return (response.headers.get('content-type') || '').toLowerCase().includes('application/pdf');
}

function requireContractVersion(request, env) {
  const received = request.headers.get('x-aneety-contract-version');
  if (!received) {
    return publicError(request, env, 428, 'contract_version_required', 'Atualize a página e tente novamente.');
  }
  if (received !== contractVersion(env)) {
    return publicError(request, env, 412, 'contract_version_unsupported', 'Atualize a página e tente novamente.');
  }
  return null;
}

function contractVersion(env) {
  return env.ANEETY_CONTRACT_VERSION || CONTRACT_VERSION;
}

function maxItems(env) {
  const value = Number.parseInt(env.ANEETY_INVOICE_MAX_ITEMS || '', 10);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_ITEMS;
}

function maxRequestBytes(env) {
  const value = Number.parseInt(env.ANEETY_INVOICE_MAX_REQUEST_BYTES || '', 10);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_REQUEST_BYTES;
}

function normalizeReportsUrl(value) {
  let normalized = String(value || DEFAULT_REPORTS_URL);
  while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
}

function requestId(request) {
  return request.headers.get('x-aneety-request-id') || crypto.randomUUID();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function publicError(request, env, status, code, message) {
  const id = requestId(request);
  return jsonResponse(
    {
      error: {
        code,
        message,
        status,
        requestId: id,
      },
    },
    { status, headers: { 'x-aneety-contract-version': contractVersion(env), 'x-aneety-request-id': id } },
  );
}

function successHeaders(request, env) {
  return {
    headers: {
      'x-aneety-contract-version': contractVersion(env),
      'x-aneety-request-id': requestId(request),
    },
  };
}

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, x-aneety-contract-version, x-aneety-request-id',
      'access-control-max-age': '600',
    },
  });
}

function logPdfFailure(requestIdValue, error) {
  console.error(
    JSON.stringify({
      event: 'invoice_pdf_failed',
      requestId: requestIdValue,
      errorName: error?.name || 'Error',
      errorMessage: error?.message || 'PDF generation failed',
    }),
  );
}

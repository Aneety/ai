import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { buildReportPayload, normalizeInvoice } from '../src/index.js';

const CONTRACT_VERSION = '2026-06-28.pagamentos.invoice-dashboard.v1';
const baseEnv = {
  ANEETY_CONTRACT_VERSION: CONTRACT_VERSION,
  ANEETY_REPORTS_PDF_TOKEN: 'secret-test-token',
  ANEETY_REPORTS_PDF_URL: 'https://worker-relatorios.example',
  ANEETY_REPORTS_CONTRACT_VERSION: '2026-06-28.relatorios-operacionais.pdf.v1',
  ANEETY_INVOICE_MAX_ITEMS: '20',
  ANEETY_INVOICE_MAX_REQUEST_BYTES: '65536',
};

const validPayload = Object.freeze({
  customer: {
    name: 'Cliente Teste',
    document: '123.456.789-00',
    email: 'cliente@example.com',
    address: 'Rua Exemplo, 123',
  },
  invoice: {
    number: 'INV-001',
    issuedAt: '2026-06-29',
    dueAt: '2026-07-06',
    paymentMethod: 'pix',
    status: 'pending',
    notes: 'Observação da fatura.',
  },
  items: [
    { description: 'Serviço A', quantity: 2, unitAmount: 50 },
    { description: 'Serviço B', quantity: 1, unitAmount: 25 },
  ],
  discountAmount: 5,
  surchargeAmount: 10,
});

test('health route is public and does not call PDF service', async () => {
  const calls = [];
  const restore = mockFetch(calls, new Response('%PDF-test', { headers: { 'content-type': 'application/pdf' } }));
  try {
    const response = await worker.fetch(new Request('https://example.com/health'), baseEnv);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-aneety-contract-version'), CONTRACT_VERSION);
    assert.ok(response.headers.get('x-aneety-request-id'));
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});

test('contract route requires contract version and lists invoice endpoint', async () => {
  const missing = await worker.fetch(new Request('https://example.com/contract'), baseEnv);
  assert.equal(missing.status, 428);

  const response = await worker.fetch(new Request('https://example.com/contract', { headers: contractHeaders() }), baseEnv);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-aneety-contract-version'), CONTRACT_VERSION);
  assert.ok(response.headers.get('x-aneety-request-id'));
  const body = await response.json();
  assert.equal(body.contractVersion, CONTRACT_VERSION);
  assert.ok(body.routes.some((route) => route.path === '/api/invoices/pdf'));
});

test('invoice endpoint validates contract and JSON content type', async () => {
  const noContract = await worker.fetch(new Request('https://example.com/api/invoices/pdf', { method: 'POST' }), baseEnv);
  assert.equal(noContract.status, 428);

  const wrongType = await worker.fetch(new Request('https://example.com/api/invoices/pdf', { method: 'POST', headers: contractHeaders(), body: 'x' }), baseEnv);
  assert.equal(wrongType.status, 400);
});

test('invoice endpoint validates payload before calling PDF service', async () => {
  const calls = [];
  const restore = mockFetch(calls, new Response('%PDF-test', { headers: { 'content-type': 'application/pdf' } }));
  try {
    const response = await worker.fetch(jsonRequest({ ...validPayload, items: [] }), baseEnv);
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});

test('invoice endpoint rejects too many items', async () => {
  const payload = { ...validPayload, items: Array.from({ length: 21 }, (_, index) => ({ description: `Item ${index}`, quantity: 1, unitAmount: 1 })) };
  const response = await worker.fetch(jsonRequest(payload), baseEnv);
  assert.equal(response.status, 400);
});

test('invoice endpoint calls report worker server-side and streams PDF', async () => {
  const calls = [];
  const restore = mockFetch(calls, new Response('%PDF-test', { headers: { 'content-type': 'application/pdf', 'x-browser-ms-used': '96' } }));
  try {
    const response = await worker.fetch(jsonRequest(validPayload), baseEnv);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('x-browser-ms-used'), '96');
    assert.match(response.headers.get('content-disposition') || '', /fatura-INV-001\.pdf/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://worker-relatorios.example/reports/pdf');
    assert.equal(calls[0].headers.authorization, 'Bearer secret-test-token');
    assert.equal(calls[0].headers['x-aneety-contract-version'], '2026-06-28.relatorios-operacionais.pdf.v1');
    const body = JSON.parse(calls[0].body);
    assert.equal(body.filename, 'fatura-INV-001.pdf');
    assert.equal(body.content.totalFormatted, 'R$ 130,00');
    assert.ok(body.content.itemsRowsHtml.includes('Serviço A'));
    assert.ok(!body.content.itemsRowsHtml.includes('<script'));
  } finally {
    restore();
  }
});

test('invoice endpoint hides downstream failures behind product error', async () => {
  const calls = [];
  const restore = mockFetch(calls, new Response(JSON.stringify({ error: 'nope' }), { status: 502, headers: { 'content-type': 'application/json' } }));
  try {
    const response = await worker.fetch(jsonRequest(validPayload), baseEnv);
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.error.code, 'invoice_pdf_failed');
    assert.ok(!body.error.message.toLowerCase().includes('cloudflare'));
    assert.ok(!body.error.message.toLowerCase().includes('worker'));
  } finally {
    restore();
  }
});

test('invoice endpoint returns unavailable when secret is missing', async () => {
  const response = await worker.fetch(jsonRequest(validPayload), { ...baseEnv, ANEETY_REPORTS_PDF_TOKEN: '' });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, 'invoice_pdf_unavailable');
});

test('non-api routes fall back to static assets binding', async () => {
  const calls = [];
  const env = {
    ...baseEnv,
    ASSETS: {
      fetch(request) {
        calls.push(new URL(request.url).pathname);
        return new Response('<main>Gerar fatura</main>', { headers: { 'content-type': 'text/html' } });
      },
    },
  };
  const response = await worker.fetch(new Request('https://example.com/faturas/nova'), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '<main>Gerar fatura</main>');
  assert.deepEqual(calls, ['/faturas/nova']);
});

test('normalizeInvoice sanitizes control characters and computes report payload', () => {
  const normalized = normalizeInvoice({
    ...validPayload,
    customer: { ...validPayload.customer, name: ' Cliente\nTeste ' },
    items: [{ description: '<Produto>', quantity: '2', unitAmount: '10.5' }],
  });
  assert.equal(normalized.customer.name, 'Cliente Teste');
  const report = buildReportPayload(normalized);
  assert.ok(report.content.itemsRowsHtml.includes('&lt;Produto&gt;'));
  assert.equal(report.content.totalFormatted, 'R$ 26,00');
});

function contractHeaders(extra = {}) {
  return { 'x-aneety-contract-version': CONTRACT_VERSION, ...extra };
}

function jsonRequest(payload) {
  return new Request('https://example.com/api/invoices/pdf', {
    method: 'POST',
    headers: contractHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify(payload),
  });
}

function mockFetch(calls, response) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method,
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: init.body,
    });
    return response.clone();
  };
  return () => {
    globalThis.fetch = original;
  };
}

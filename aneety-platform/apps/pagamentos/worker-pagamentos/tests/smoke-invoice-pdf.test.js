import assert from 'node:assert/strict';
import test from 'node:test';
import { runInvoiceSmoke } from '../scripts/smoke-invoice-pdf.mjs';

test('runInvoiceSmoke validates shell, PDF magic and Browser Run time', async () => {
  const calls = [];
  const result = await runInvoiceSmoke({
    baseUrl: 'https://worker-pagamentos.example',
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      const path = new URL(url).pathname;
      if (path === '/health') return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
      if (path === '/contract') return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
      if (path === '/') return new Response('<div>Gerar fatura</div>', { headers: { 'content-type': 'text/html' } });
      if (path === '/api/invoices/pdf') return new Response('%PDF-smoke', { headers: { 'content-type': 'application/pdf', 'x-browser-ms-used': '97' } });
      throw new Error('unexpected path');
    },
  });

  assert.equal(result.invoiceSmoke.status, 'success');
  assert.equal(result.invoiceSmoke.browserMsUsed, 97);
  assert.equal(result.invoiceSmoke.htmlLoaded, true);
  assert.equal(calls.at(-1).init.headers['x-aneety-contract-version'], '2026-06-28.pagamentos.invoice-dashboard.v1');
});

test('runInvoiceSmoke fails when Browser Run time is missing', async () => {
  await assert.rejects(
    runInvoiceSmoke({
      baseUrl: 'https://worker-pagamentos.example',
      fetchImpl: async (url) => {
        const path = new URL(url).pathname;
        if (path === '/health' || path === '/contract') return new Response('{}');
        if (path === '/') return new Response('Gerar fatura');
        return new Response('%PDF-smoke', { headers: { 'content-type': 'application/pdf' } });
      },
    }),
    /browser_ms_missing/,
  );
});

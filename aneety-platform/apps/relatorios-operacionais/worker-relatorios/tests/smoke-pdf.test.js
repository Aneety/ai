import test from 'node:test';
import assert from 'node:assert/strict';

import { runPdfSmoke } from '../scripts/smoke-pdf.mjs';

const CONTRACT_VERSION = '2026-06-28.relatorios-operacionais.pdf.v1';

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-aneety-contract-version': CONTRACT_VERSION,
      'x-aneety-request-id': 'req-smoke',
    },
  });
}

test('runPdfSmoke validates health, contract, PDF magic and X-Browser-Ms-Used', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith('/health')) {
      return jsonResponse({ ok: true, contractVersion: CONTRACT_VERSION });
    }
    if (url.endsWith('/contract')) {
      return jsonResponse({ ok: true, contractVersion: CONTRACT_VERSION, routes: [] });
    }
    if (url.endsWith('/reports/pdf')) {
      return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'x-aneety-contract-version': CONTRACT_VERSION,
          'x-aneety-request-id': 'req-pdf',
          'x-browser-ms-used': '2345',
        },
      });
    }
    throw new Error(`unexpected_url:${url}`);
  };

  const result = await runPdfSmoke({
    env: {
      ANEETY_PUBLICATION_SMOKE_URL: 'https://worker-relatorios.example.workers.dev',
      ANEETY_REPORTS_PDF_TOKEN: 'sample-auth-value',
      ANEETY_CONTRACT_VERSION: CONTRACT_VERSION,
      ANEETY_REPORTS_MAX_BROWSER_MS_PER_SMOKE: '60000',
    },
    fetchImpl,
  });

  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, 'https://worker-relatorios.example.workers.dev/health');
  assert.equal(calls[1].url, 'https://worker-relatorios.example.workers.dev/contract');
  assert.equal(calls[2].url, 'https://worker-relatorios.example.workers.dev/reports/pdf');
  assert.equal(calls[1].init.headers['x-aneety-contract-version'], CONTRACT_VERSION);
  assert.equal(calls[2].init.headers.authorization, 'Bearer sample-auth-value');
  assert.equal(result.pdfSmoke.status, 'success');
  assert.equal(result.pdfSmoke.contentType, 'application/pdf');
  assert.equal(result.pdfSmoke.startsWithPdfMagic, true);
  assert.equal(result.pdfSmoke.browserMsUsed, 2345);
  assert.equal(result.pdfSmoke.browserDailyFreeAllowanceMs, 600000);
  assert.equal(result.pdfSmoke.browserProjectedDailyMs, 300000);
});

test('runPdfSmoke fails when Browser Run time exceeds smoke limit', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/health')) return jsonResponse({ ok: true, contractVersion: CONTRACT_VERSION });
    if (url.endsWith('/contract')) return jsonResponse({ ok: true, contractVersion: CONTRACT_VERSION, routes: [] });
    return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'x-aneety-contract-version': CONTRACT_VERSION,
        'x-aneety-request-id': 'req-pdf',
        'x-browser-ms-used': '60001',
      },
    });
  };

  await assert.rejects(
    () =>
      runPdfSmoke({
        env: {
          ANEETY_PUBLICATION_SMOKE_URL: 'https://worker-relatorios.example.workers.dev',
          ANEETY_REPORTS_PDF_TOKEN: 'sample-auth-value',
          ANEETY_CONTRACT_VERSION: CONTRACT_VERSION,
          ANEETY_REPORTS_MAX_BROWSER_MS_PER_SMOKE: '60000',
        },
        fetchImpl,
      }),
    /browser_ms_used_over_smoke_limit/,
  );
});

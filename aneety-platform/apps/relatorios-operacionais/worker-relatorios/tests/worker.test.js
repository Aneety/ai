import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BROWSER_MS_HEADER,
  CONTRACT_VERSION,
  CONTRACT_VERSION_HEADER,
  REQUEST_ID_HEADER,
  handleRequest,
} from '../src/index.js';

const TOKEN = 'sample-auth-value';

function request(path, init = {}) {
  return new Request(`https://worker-relatorios.aneety.example${path}`, init);
}

function pdfHeaders(overrides = {}) {
  return {
    [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION,
    authorization: `Bearer ${TOKEN}`,
    'content-type': 'application/json',
    ...overrides,
  };
}

function env(overrides = {}) {
  const calls = [];
  return {
    ANEETY_REPORTS_PDF_TOKEN: TOKEN,
    ANEETY_CONTRACT_VERSION: CONTRACT_VERSION,
    ANEETY_REPORTS_MAX_HTML_BYTES: '1048576',
    BROWSER: {
      calls,
      async quickAction(action, payload) {
        calls.push({ action, payload });
        return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]), {
          status: 200,
          headers: {
            'content-type': 'application/pdf',
            'X-Browser-Ms-Used': '1234',
          },
        });
      },
    },
    ...overrides,
  };
}

const minimalHtml = '<!doctype html><html><head><style>body{font-family:Arial}</style></head><body><h1>Relatório</h1></body></html>';

test('health route is public and does not call Browser Run', async () => {
  const runtime = env();
  const response = await handleRequest(request('/health'), runtime);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'worker-relatorios');
  assert.equal(body.responsibility, 'relatorios-operacionais');
  assert.equal(response.headers.get(CONTRACT_VERSION_HEADER), CONTRACT_VERSION);
  assert.equal(runtime.BROWSER.calls.length, 0);
});

test('contract route requires contract version', async () => {
  const response = await handleRequest(request('/contract'), env());
  const body = await response.json();

  assert.equal(response.status, 428);
  assert.equal(body.error.code, 'contract_version_required');
});

test('contract route lists PDF endpoint and public limits', async () => {
  const response = await handleRequest(
    request('/contract', { headers: { [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION } }),
    env(),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.contractVersion, CONTRACT_VERSION);
  assert.equal(body.reportContract.output, 'application/pdf');
  assert.equal(body.reportContract.maxHtmlBytes, 1048576);
  assert.equal(body.routes.some((route) => route.path === '/reports/pdf' && route.requiresBearerToken), true);
});

test('PDF endpoint requires supported contract version before token', async () => {
  const response = await handleRequest(
    request('/reports/pdf', {
      method: 'POST',
      headers: pdfHeaders({ [CONTRACT_VERSION_HEADER]: '2026-06-01.old.v0' }),
      body: JSON.stringify({ html: minimalHtml }),
    }),
    env(),
  );
  const body = await response.json();

  assert.equal(response.status, 412);
  assert.equal(body.error.code, 'contract_version_unsupported');
});

test('PDF endpoint requires bearer token', async () => {
  const response = await handleRequest(
    request('/reports/pdf', {
      method: 'POST',
      headers: { [CONTRACT_VERSION_HEADER]: CONTRACT_VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({ html: minimalHtml }),
    }),
    env(),
  );
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'unauthorized');
});

test('PDF endpoint rejects payload without HTML or template', async () => {
  const response = await handleRequest(
    request('/reports/pdf', {
      method: 'POST',
      headers: pdfHeaders(),
      body: JSON.stringify({ filename: 'relatorio.pdf' }),
    }),
    env(),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'invalid_report_payload');
});

test('PDF endpoint rejects payload with HTML and template simultaneously', async () => {
  const response = await handleRequest(
    request('/reports/pdf', {
      method: 'POST',
      headers: pdfHeaders(),
      body: JSON.stringify({ html: minimalHtml, templateHtml: minimalHtml, content: {} }),
    }),
    env(),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'invalid_report_payload');
});

test('PDF endpoint rejects template without content', async () => {
  const response = await handleRequest(
    request('/reports/pdf', {
      method: 'POST',
      headers: pdfHeaders(),
      body: JSON.stringify({ templateHtml: '<html><body>{{title}}</body></html>' }),
    }),
    env(),
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'invalid_report_payload');
});

test('PDF endpoint rejects dangerous HTML before Browser Run', async () => {
  const runtime = env();
  const response = await handleRequest(
    request('/reports/pdf', {
      method: 'POST',
      headers: pdfHeaders(),
      body: JSON.stringify({ html: '<!doctype html><html><body><script>alert(1)</script></body></html>' }),
    }),
    runtime,
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, 'invalid_report_html');
  assert.equal(runtime.BROWSER.calls.length, 0);
});

test('PDF endpoint rejects external resources and inline handlers', async () => {
  for (const html of [
    '<html><body onclick="x()">Relatório</body></html>',
    '<html><head><style>@import url("/x.css")</style></head><body></body></html>',
    '<html><body><img src="https://example.com/a.png"></body></html>',
    '<html><body><iframe src="about:blank"></iframe></body></html>',
  ]) {
    const response = await handleRequest(
      request('/reports/pdf', {
        method: 'POST',
        headers: pdfHeaders(),
        body: JSON.stringify({ html }),
      }),
      env(),
    );
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'invalid_report_html');
  }
});

test('PDF endpoint enforces HTML byte limit', async () => {
  const response = await handleRequest(
    request('/reports/pdf', {
      method: 'POST',
      headers: pdfHeaders(),
      body: JSON.stringify({ html: '<html><body>12345678901</body></html>' }),
    }),
    env({ ANEETY_REPORTS_MAX_HTML_BYTES: '10' }),
  );
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.error.code, 'payload_too_large');
});

test('PDF endpoint renders HTML mode and returns PDF headers', async () => {
  const runtime = env();
  const response = await handleRequest(
    request('/reports/pdf', {
      method: 'POST',
      headers: pdfHeaders({ [REQUEST_ID_HEADER]: 'req-pdf-1' }),
      body: JSON.stringify({
        html: minimalHtml,
        filename: '../relatório final?token=secret',
        pdfOptions: { format: 'A4', landscape: false, printBackground: true, preferCSSPageSize: true },
      }),
    }),
    runtime,
  );
  const bytes = new Uint8Array(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="relatorio-final.pdf"');
  assert.equal(response.headers.get(CONTRACT_VERSION_HEADER), CONTRACT_VERSION);
  assert.equal(response.headers.get(REQUEST_ID_HEADER), 'req-pdf-1');
  assert.equal(response.headers.get(BROWSER_MS_HEADER), '1234');
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), '%PDF');
  assert.equal(runtime.BROWSER.calls.length, 1);
  assert.equal(runtime.BROWSER.calls[0].action, 'pdf');
  assert.equal(runtime.BROWSER.calls[0].payload.pdfOptions.format, 'a4');
});

test('PDF endpoint renders template mode with escaped text and controlled HTML', async () => {
  const runtime = env();
  const response = await handleRequest(
    request('/reports/pdf', {
      method: 'POST',
      headers: pdfHeaders(),
      body: JSON.stringify({
        templateHtml: '<!doctype html><html><body><h1>{{title}}</h1>{{{bodyHtml}}}</body></html>',
        content: {
          title: '<Relatório & teste>',
          bodyHtml: '<section><p>Conteúdo controlado.</p></section>',
        },
      }),
    }),
    runtime,
  );

  assert.equal(response.status, 200);
  const renderedHtml = runtime.BROWSER.calls[0].payload.html;
  assert.match(renderedHtml, /&lt;Relatório &amp; teste&gt;/);
  assert.match(renderedHtml, /<section><p>Conteúdo controlado\.<\/p><\/section>/);
});

test('PDF endpoint maps Browser Run failures to public product error', async () => {
  const runtime = env({
    BROWSER: {
      async quickAction() {
        throw new Error('limit from provider must not leak');
      },
    },
  });
  const response = await handleRequest(
    request('/reports/pdf', {
      method: 'POST',
      headers: pdfHeaders(),
      body: JSON.stringify({ html: minimalHtml }),
    }),
    runtime,
  );
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.error.code, 'pdf_generation_failed');
  assert.equal(JSON.stringify(body).includes('provider'), false);
});

test('unknown routes and methods return public errors', async () => {
  const notFound = await handleRequest(request('/internal'), env());
  const method = await handleRequest(request('/health', { method: 'DELETE' }), env());

  assert.equal(notFound.status, 404);
  assert.equal((await notFound.json()).error.code, 'route_not_found');
  assert.equal(method.status, 405);
  assert.equal((await method.json()).error.code, 'method_not_allowed');
});

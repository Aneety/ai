const CONTRACT_VERSION = process.env.ANEETY_CONTRACT_VERSION || '2026-06-28.pagamentos.invoice-dashboard.v1';
const SMOKE_URL = process.env.ANEETY_PUBLICATION_SMOKE_URL;
const MAX_BROWSER_MS = Number.parseInt(process.env.ANEETY_REPORTS_MAX_BROWSER_MS_PER_SMOKE || '60000', 10);

export async function runInvoiceSmoke({ baseUrl = SMOKE_URL, fetchImpl = fetch } = {}) {
  if (!baseUrl) throw new Error('ANEETY_PUBLICATION_SMOKE_URL is required.');
  const origin = baseUrl.replace(/\/+$/, '');

  const health = await fetchImpl(`${origin}/health`);
  if (!health.ok) throw new Error(`health_status_${health.status}`);

  const contract = await fetchImpl(`${origin}/contract`, { headers: { 'x-aneety-contract-version': CONTRACT_VERSION } });
  if (!contract.ok) throw new Error(`contract_status_${contract.status}`);

  const page = await fetchImpl(`${origin}/`);
  const html = await page.text();
  if (!page.ok || !html.includes('Gerar fatura')) throw new Error('html_shell_missing');

  const pdf = await fetchImpl(`${origin}/api/invoices/pdf`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-aneety-contract-version': CONTRACT_VERSION,
      'x-aneety-request-id': 'invoice-smoke',
    },
    body: JSON.stringify({
      customer: {
        name: 'Cliente Validação',
        document: '123.456.789-00',
        email: 'validacao@example.com',
        address: 'Rua de Validação, 100',
      },
      invoice: {
        number: 'SMOKE-001',
        issuedAt: '2026-06-29',
        dueAt: '2026-07-06',
        paymentMethod: 'pix',
        status: 'pending',
        notes: 'Smoke remoto de fatura operacional.',
      },
      items: [{ description: 'Item de validação', quantity: 1, unitAmount: 120 }],
      discountAmount: 0,
      surchargeAmount: 0,
    }),
  });

  if (!pdf.ok) throw new Error(`invoice_pdf_status_${pdf.status}`);
  const contentType = pdf.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/pdf')) throw new Error('invoice_pdf_content_type');
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  const startsWithPdfMagic = new TextDecoder().decode(bytes.slice(0, 4)) === '%PDF';
  if (!startsWithPdfMagic) throw new Error('invoice_pdf_magic');
  const browserMsUsed = Number.parseInt(pdf.headers.get('x-browser-ms-used') || '', 10);
  if (!Number.isFinite(browserMsUsed)) throw new Error('browser_ms_missing');
  if (browserMsUsed > MAX_BROWSER_MS) throw new Error('browser_ms_over_limit');

  return {
    invoiceSmoke: {
      status: 'success',
      contentType: 'application/pdf',
      startsWithPdfMagic,
      browserMsUsed,
      browserDailyFreeAllowanceMs: 600000,
      browserProjectedDailyMs: 300000,
      bytes: bytes.length,
      htmlLoaded: true,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runInvoiceSmoke()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(JSON.stringify({ error: error.message }, null, 2));
      process.exit(1);
    });
}

# worker-pagamentos

## Objetivo

Cloudflare Worker da responsabilidade `pagamentos` para hospedar o dashboard de fatura e expor o BFF de geração de PDF.

## Contrato público

Contrato: `2026-06-28.pagamentos.invoice-dashboard.v1`.

Rotas:

- `GET /health` — status operacional mínimo.
- `GET /contract` — exige `x-aneety-contract-version`.
- `POST /api/invoices/pdf` — recebe dados de fatura, monta HTML/CSS versionado e retorna PDF.
- fallback SPA — entrega os assets gerados por `mfe-pagamentos`.

## Payload de fatura

```json
{
  "customer": { "name": "", "document": "", "email": "", "address": "" },
  "invoice": { "number": "", "issuedAt": "", "dueAt": "", "paymentMethod": "", "status": "", "notes": "" },
  "items": [{ "description": "", "quantity": 1, "unitAmount": 0 }],
  "discountAmount": 0,
  "surchargeAmount": 0
}
```

Regras v1:

- máximo de 20 itens;
- valores em BRL;
- data de vencimento não pode ser anterior à emissão;
- filename normalizado como `fatura-<numero>.pdf`;
- HTML/CSS da fatura fica em `templates/invoice-template.html` e é refletido em `src/invoice-template.js` para runtime Worker;
- erros públicos usam linguagem de produto e não expõem fornecedor, token, stack ou detalhes internos.

## Configuração

Variáveis não secretas versionadas em `wrangler.jsonc`:

- `ANEETY_CONTRACT_VERSION`;
- `ANEETY_REPORTS_PDF_URL`;
- `ANEETY_REPORTS_CONTRACT_VERSION`;
- limites de itens e payload.

Secret obrigatório de runtime:

- `ANEETY_REPORTS_PDF_TOKEN`.

## Validação local leve

```bash
npm install
npm test
npm run lint
npm run typecheck
npm run build
npm run deploy:validate
npm run publication:validate
```

Essas validações não substituem o aceite remoto. Publicação só fecha com GitHub Actions verdes, Cloudflare dry-run/deploy/smoke e prova custo zero vigente.

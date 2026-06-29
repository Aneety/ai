# worker-relatorios

Worker Cloudflare para gerar relatórios PDF a partir de HTML final ou template simples com conteúdo.

## Rotas

- `GET /health`: estado mínimo do serviço.
- `GET /contract`: contrato público. Requer `x-aneety-contract-version`.
- `POST /reports/pdf`: gera PDF. Requer `Authorization: Bearer <token>`, `x-aneety-contract-version` e JSON.

## Contrato

`2026-06-28.relatorios-operacionais.pdf.v1`

## Entrada v1

### HTML final

```json
{
  "html": "<!doctype html><html><head><style>body{font-family:Arial}</style></head><body>Relatório</body></html>",
  "filename": "relatorio.pdf",
  "pdfOptions": { "format": "A4", "printBackground": true, "preferCSSPageSize": true }
}
```

### Template + conteúdo

```json
{
  "templateHtml": "<!doctype html><html><body><h1>{{title}}</h1>{{{bodyHtml}}}</body></html>",
  "content": { "title": "Relatório", "bodyHtml": "<p>Conteúdo</p>" },
  "filename": "relatorio.pdf"
}
```

## Segurança

- Token operacional só em secret Cloudflare/GitHub Actions.
- Sem `.env` versionado.
- HTML com script, handlers inline, imports, recursos externos, iframes, objects, embeds ou stylesheet externo é rejeitado.
- PDF não é persistido na v1.
- Smoke publicado deve registrar `%PDF` e `X-Browser-Ms-Used`.

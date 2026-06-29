# pagamentos

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** operar intenções financeiras, faturas simples, status de pagamento e repasses futuros.
- **Caminho canônico:** `aneety-platform/apps/pagamentos/...`.
- **Entrega v1 deste ciclo:** dashboard operacional para preencher dados de fatura e gerar PDF sob demanda.
- **Runtime permitido no MVP:** Cloudflare Workers e microfrontend React/Single SPA empacotado como assets estáticos. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers para aceite.

## Módulos v1

- [`worker-pagamentos`](./worker-pagamentos/README.md) — hospeda o dashboard e expõe o BFF `POST /api/invoices/pdf`.
- [`mfe-pagamentos`](./mfe-pagamentos/README.md) — form React/Single SPA com componentes shadcn-style.
- [`db-pagamentos`](./db-pagamentos/README.md) — permanece reservado; a fatura PDF v1 não usa banco.

## Fluxo da fatura PDF

1. Usuário preenche cliente, pagamento e itens da fatura.
2. O dashboard envia os dados para `/api/invoices/pdf` no mesmo Worker.
3. `worker-pagamentos` valida os campos, calcula totais e monta `templateHtml + content` usando template HTML/CSS versionado neste projeto.
4. `worker-pagamentos` chama `worker-relatorios` server-side com token operacional secreto.
5. O navegador recebe o PDF diretamente, sem persistência, fila, histórico ou link público.

## Segredos e custo

- `ANEETY_REPORTS_PDF_TOKEN` fica apenas como secret de runtime. Não pode ir ao browser, repo, PR, logs ou artefatos.
- `ANEETY_REPORTS_PDF_URL` aponta para `https://worker-relatorios.ricardomalnati.workers.dev`.
- Custo zero obrigatório: prova vigente em `docs/ai-guardrails/cost-proofs/current-services.json`.
- V1 não cria R2, KV, D1, Queue, storage, banco ou serviço pago.

## Gates

Ordem obrigatória: branch -> PR -> GitHub Actions verdes -> prova custo zero vigente -> Cloudflare dry-run -> deploy -> smoke publicado -> evidência versionada.

Aceite remoto da fatura: `/health`, `/contract`, SPA HTML e `POST /api/invoices/pdf` com PDF real, `application/pdf`, bytes `%PDF` e `X-Browser-Ms-Used` propagado.

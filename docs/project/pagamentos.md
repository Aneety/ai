# pagamentos

## Cabeçalho canônico

- Responsabilidade: `pagamentos`
- Owner: Ricardo Malnati
- Repo destino: `Aneety/ai`
- Caminho canônico: `aneety-platform/apps/pagamentos/...`
- Módulos v1: `worker-pagamentos` e `mfe-pagamentos`
- Prioridade atual: **alta**
- URL alvo do PDF Worker: `https://worker-relatorios.ricardomalnati.workers.dev`
- Contrato do dashboard/BFF: `2026-06-28.pagamentos.invoice-dashboard.v1`
- Custo: zero obrigatório, prova em `docs/ai-guardrails/cost-proofs/current-services.json` válida até `2026-07-06T00:33:53Z`

## Status operacional por ciclo

| Ciclo | Status | Prioridade | Gate | Evidência | Bloqueio | Próxima ação |
| --- | --- | --- | --- | --- | --- | --- |
| `repositorio` | `validacao` | alta | `arquitetura` | Branch `codex/pagamentos-invoice-dashboard` cria `worker-pagamentos` e `mfe-pagamentos`, preservando `db-pagamentos` como reservado. | Aguardando PR, GitHub Actions e merge para consolidar em `main`. | Abrir PR, aguardar checks remotos e registrar SHA final. |
| `deploy` | `bloqueado` | alta | `processo` | `wrangler.jsonc` define Worker com assets estáticos, vars não secretas e build do MFE antes de dry-run/deploy. | Exige PR verde, prova custo zero vigente e Cloudflare dry-run. | Depois dos checks, executar Cloudflare dry-run para `aneety-platform/apps/pagamentos/worker-pagamentos`. |
| `publicacao` | `bloqueado` | alta | `processo` | `publication-evidence.example.json` define contrato da evidência; `publication-evidence.json` só deve nascer após deploy + smoke real. | Aguardando deploy real, secret runtime e smoke publicado. | Publicar, rodar smoke e versionar evidência real. |
| `banco` | `na` | alta | `DB` | Fatura PDF v1 não persiste fatura, PDF, histórico ou metadados. | — | Reavaliar só com novo contrato aprovado. |
| `jobs` | `na` | alta | `processo` | Fatura PDF v1 é síncrona e sem fila. | — | Reavaliar só se volume exigir fila e nova prova de custo. |
| `backend` | `validacao` | alta | `backend` | `POST /api/invoices/pdf` valida payload, calcula totais, monta `templateHtml + content` e chama `worker-relatorios` server-side. | Aguardando Actions e smoke remoto. | Preservar token só como secret e validar BFF no ambiente publicado. |
| `teste-integracao-api` | `bloqueado` | alta | `API` | Testes de unidade usam mock do PDF Worker; aceite exige chamada publicada com PDF real. | Aguardando Cloudflare deploy + smoke. | Rodar smoke publicado com PDF `%PDF` e `X-Browser-Ms-Used`. |
| `microfrontend` | `validacao` | alta | `UI` | `mfe-pagamentos` implementa React + Vite + Single SPA, form à esquerda, resumo lateral, paleta lavanda/branca e componentes shadcn-style. | Aguardando build remoto e evidência visual publicada quando PR exigir UI. | Registrar screenshot da URL publicada no PR após deploy. |
| `smoke` | `bloqueado` | alta | `smoke` | Script `smoke-invoice-pdf.mjs` cobre `/health`, `/contract`, SPA HTML e `POST /api/invoices/pdf`. | Aguardando URL real e secret runtime. | Validar `application/pdf`, `%PDF`, total calculado e `X-Browser-Ms-Used`. |
| `teste` | `validacao` | alta | `teste` | Worker: Node tests e validadores; MFE: typecheck/build/Vitest; custo zero validado localmente. | Aguardando GitHub Actions como primeiro gate de aceite. | Corrigir qualquer falha remota antes de Cloudflare. |
| `documentacao` | `validacao` | alta | `documentacao` | README, docs normativos, gate remoto, painel e prova custo zero atualizados. | Aguardando PR e evidência remota final. | Atualizar com PR, SHA, runs, URL e screenshot após publicação. |
| `governanca` | `validacao` | alta | `governanca` | Prova custo zero renovada em `2026-06-29T00:33:53Z`: conta Cloudflare Free, Workers projetados `10/100`, Browser Run projetado `5/10 minutes/day`, 7 serviços. | Prova expira em `2026-07-06T00:33:53Z`; qualquer deploy/merge/claim após isso exige revalidação. | Não concluir sem PR verde, Cloudflare gates, evidência e prova vigente. |

## Decisões v1

- A UI operacional fica em `pagamentos`, não em `relatorios-operacionais`.
- `mfe-pagamentos` entrega o form React/Single SPA; `worker-pagamentos` hospeda assets e BFF.
- O template HTML/CSS da fatura fica no projeto do `worker-pagamentos`, fora do React.
- O BFF chama `https://worker-relatorios.ricardomalnati.workers.dev/reports/pdf` server-side.
- `ANEETY_REPORTS_PDF_TOKEN` nunca chega ao browser.
- V1 não tem login, banco, storage, fila, histórico, link persistente ou documento fiscal/legal.
- Risco aceito: endpoint público sem login pode consumir quota se a URL vazar; controle de acesso fica para ciclo futuro.

## Evidência esperada após publicação

- PR com Actions verdes.
- Cloudflare dry-run e deploy de `worker-pagamentos`.
- URL pública do dashboard.
- Smoke publicado com:
  - `GET /health` OK;
  - `GET /contract` OK;
  - HTML do dashboard carregado;
  - `POST /api/invoices/pdf` OK;
  - PDF `application/pdf` começando com `%PDF`;
  - `X-Browser-Ms-Used` propagado;
  - prova custo zero vigente.
- Screenshot do dashboard publicado, se PR/issue exigir evidência UI.

## Histórico curto

- 2026-06-29 — PR [#89](https://github.com/Aneety/ai/pull/89) de `relatorios-operacionais` foi mergeada antes deste ciclo; `worker-relatorios` publicado em `https://worker-relatorios.ricardomalnati.workers.dev`.
- 2026-06-29 — branch `codex/pagamentos-invoice-dashboard` implementa `worker-pagamentos` + `mfe-pagamentos` para gerar fatura PDF usando template versionado, chamada server-side ao PDF Worker e custo zero projetado `10/100` Workers.
- 2026-05-31 — branch `codex/stitch-mvp-design` preparou scaffold inicial de `pagamentos` com diretórios `db-pagamentos`, `worker-pagamentos` e `mfe-pagamentos`.
- 2026-05-29 — backlog migrado do painel operacional anterior para `docs/project`.

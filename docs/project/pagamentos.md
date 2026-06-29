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
| `repositorio` | `validacao` | alta | `arquitetura` | PR [#90](https://github.com/Aneety/ai/pull/90) cria `worker-pagamentos` e `mfe-pagamentos`, preservando `db-pagamentos` como reservado. | Aguardando merge para consolidar em `main`. | Mergear quando revisão/critério do mantenedor permitir. |
| `deploy` | `concluido` | alta | `processo` | PR [#90](https://github.com/Aneety/ai/pull/90) no SHA [`1e9bf51`](https://github.com/Aneety/ai/commit/1e9bf51836a9b65a5d62f209da3b134b6046bf3a) passou Actions; Cloudflare dry-run [`28342439918`](https://github.com/Aneety/ai/actions/runs/28342439918) e deploy [`28342458472`](https://github.com/Aneety/ai/actions/runs/28342458472) passaram para `aneety-platform/apps/pagamentos/worker-pagamentos`. | — | Reexecutar deploy só se o código mudar. |
| `publicacao` | `concluido` | alta | `processo` | URL publicada `https://worker-pagamentos.ricardomalnati.workers.dev`; evidência real em `aneety-platform/apps/pagamentos/worker-pagamentos/publication-evidence.json`; smoke [`28342489105`](https://github.com/Aneety/ai/actions/runs/28342489105) passou. | — | Monitorar consumo real e manter prova custo zero vigente. |
| `banco` | `na` | alta | `DB` | Fatura PDF v1 não persiste fatura, PDF, histórico ou metadados. | — | Reavaliar só com novo contrato aprovado. |
| `jobs` | `na` | alta | `processo` | Fatura PDF v1 é síncrona e sem fila. | — | Reavaliar só se volume exigir fila e nova prova de custo. |
| `backend` | `concluido` | alta | `backend` | `POST /api/invoices/pdf` valida payload, calcula totais, monta `templateHtml + content` e chama `worker-relatorios` server-side; token fica só em secret; chamada publicada retornou PDF real. | — | Preservar contrato `2026-06-28.pagamentos.invoice-dashboard.v1`. |
| `teste-integracao-api` | `concluido` | alta | `API` | Smoke funcional remoto [`28342489105`](https://github.com/Aneety/ai/actions/runs/28342489105) executou `/health`, `/contract`, HTML da SPA e `POST /api/invoices/pdf`. | — | Reexecutar se URL, contrato, token ou template mudar. |
| `microfrontend` | `concluido` | alta | `UI` | `mfe-pagamentos` publicado com React + Vite + Single SPA, form à esquerda, resumo lateral, paleta lavanda/branca e componentes shadcn-style; screenshot em `docs/assets/issues/pagamentos-invoice-dashboard/dashboard-publicado.png`. | — | Evoluir login/controle de acesso em ciclo futuro, se aprovado. |
| `smoke` | `concluido` | alta | `smoke` | Smoke PDF remoto confirmou `Content-Type: application/pdf`, bytes iniciando com `%PDF`, `X-Browser-Ms-Used=116`, HTML carregado, `50444 bytes`, limite diário free `600000 ms` e projeção operacional `300000 ms/day`. | — | Monitorar consumo real; parar publicação se aproximar de `10 minutes/day`. |
| `teste` | `concluido` | alta | `teste` | Actions verdes no SHA [`1e9bf51`](https://github.com/Aneety/ai/commit/1e9bf51836a9b65a5d62f209da3b134b6046bf3a): Remote CI gate, Governance policy/audit, Security/CodeQL, Dependency Review e Secret text scan; validadores leves locais passaram. | — | Revalidar se o contrato mudar. |
| `documentacao` | `concluido` | alta | `documentacao` | README, docs normativos, gate remoto, painel, evidência de publicação e screenshot da UI publicada atualizados no PR [#90](https://github.com/Aneety/ai/pull/90). | — | Atualizar SHA final após merge, se necessário. |
| `governanca` | `concluido` | alta | `governanca` | Prova custo zero renovada em `2026-06-29T00:33:53Z`: conta Cloudflare Free, Workers projetados `10/100`, Browser Run projetado `5/10 minutes/day`, 7 serviços; validação local confirmou vigência até `2026-07-06T00:33:53Z`. | Prova expira em `2026-07-06T00:33:53Z`; qualquer novo deploy/merge/claim após isso exige revalidação. | Não fazer novo deploy/merge/claim com prova expirada. |

## Decisões v1

- A UI operacional fica em `pagamentos`, não em `relatorios-operacionais`.
- `mfe-pagamentos` entrega o form React/Single SPA; `worker-pagamentos` hospeda assets e BFF.
- O template HTML/CSS da fatura fica no projeto do `worker-pagamentos`, fora do React.
- O BFF chama `https://worker-relatorios.ricardomalnati.workers.dev/reports/pdf` server-side.
- `worker-pagamentos` usa `global_fetch_strictly_public` para manter essa chamada como requisição pública HTTPS, conforme escopo v1 definido.
- `ANEETY_REPORTS_PDF_TOKEN` nunca chega ao browser.
- V1 não tem login, banco, storage, fila, histórico, link persistente ou documento fiscal/legal.
- Risco aceito: endpoint público sem login pode consumir quota se a URL vazar; controle de acesso fica para ciclo futuro.

## Evidência remota validada

| Item | Valor |
| --- | --- |
| PR | [#90](https://github.com/Aneety/ai/pull/90) |
| Commit validado | [`1e9bf51836a9b65a5d62f209da3b134b6046bf3a`](https://github.com/Aneety/ai/commit/1e9bf51836a9b65a5d62f209da3b134b6046bf3a) |
| Dry-run | [`28342439918`](https://github.com/Aneety/ai/actions/runs/28342439918) |
| Deploy | [`28342458472`](https://github.com/Aneety/ai/actions/runs/28342458472) |
| Smoke | [`28342489105`](https://github.com/Aneety/ai/actions/runs/28342489105) |
| URL publicada | `https://worker-pagamentos.ricardomalnati.workers.dev` |
| PDF smoke | `success`, `application/pdf`, `%PDF`, `X-Browser-Ms-Used=116`, `50444 bytes`, HTML carregado |
| Prova custo zero | `docs/ai-guardrails/cost-proofs/current-services.json`, 7 serviços, `free`, válida até `2026-07-06T00:33:53Z` |
| Evidência versionada | `aneety-platform/apps/pagamentos/worker-pagamentos/publication-evidence.json` |
| Evidência visual | `docs/assets/issues/pagamentos-invoice-dashboard/dashboard-publicado.png` |

## Histórico curto

- 2026-06-29 — PR [#89](https://github.com/Aneety/ai/pull/89) de `relatorios-operacionais` foi mergeada antes deste ciclo; `worker-relatorios` publicado em `https://worker-relatorios.ricardomalnati.workers.dev`.
- 2026-06-29 — branch `codex/pagamentos-invoice-dashboard` implementa `worker-pagamentos` + `mfe-pagamentos` para gerar fatura PDF usando template versionado, chamada server-side ao PDF Worker e custo zero projetado `10/100` Workers.
- 2026-06-29 — PR [#90](https://github.com/Aneety/ai/pull/90) no SHA [`1e9bf51`](https://github.com/Aneety/ai/commit/1e9bf51836a9b65a5d62f209da3b134b6046bf3a) passou Actions, Cloudflare dry-run [`28342439918`](https://github.com/Aneety/ai/actions/runs/28342439918), deploy [`28342458472`](https://github.com/Aneety/ai/actions/runs/28342458472) e smoke [`28342489105`](https://github.com/Aneety/ai/actions/runs/28342489105); `worker-pagamentos` publicado em `https://worker-pagamentos.ricardomalnati.workers.dev`.
- 2026-06-29 — secret `ANEETY_REPORTS_PDF_TOKEN` rotacionado para `worker-relatorios`, `worker-pagamentos` e GitHub Actions secret `Aneety/ai:ANEETY_REPORTS_PDF_TOKEN`; valores omitidos.
- 2026-05-31 — branch `codex/stitch-mvp-design` preparou scaffold inicial de `pagamentos` com diretórios `db-pagamentos`, `worker-pagamentos` e `mfe-pagamentos`.
- 2026-05-29 — backlog migrado do painel operacional anterior para `docs/project`.

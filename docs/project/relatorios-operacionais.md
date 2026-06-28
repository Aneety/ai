# relatorios-operacionais

| Campo | Valor |
| --- | --- |
| Responsabilidade | `relatorios-operacionais` |
| Owner | Ricardo Malnati |
| Repo destino | `Aneety/ai` |
| Caminho | `aneety-platform/apps/relatorios-operacionais/worker-relatorios` |
| Prioridade | alta |
| Runtime v1 | Cloudflare Workers + Browser Run Quick Actions |
| URL publicada | `https://worker-relatorios.ricardomalnati.workers.dev` |
| PR | [#89](https://github.com/Aneety/ai/pull/89) |
| Branch | `codex/relatorios-operacionais-worker-pdf` |
| SHA validado | [`b9d76b59c1ca49efeba9a20f6075d34599fbb9b1`](https://github.com/Aneety/ai/commit/b9d76b59c1ca49efeba9a20f6075d34599fbb9b1) |
| Custo | zero obrigatório, coberto por `docs/ai-guardrails/cost-proofs/current-services.json` até `2026-07-05T23:04:35Z` |

## Status por ciclo

| Ciclo | Status | Prioridade | Gate | Evidência | Bloqueio | Próxima ação |
| --- | --- | --- | --- | --- | --- | --- |
| `repositorio` | `validacao` | alta | `processo` | PR [#89](https://github.com/Aneety/ai/pull/89) no commit [`b9d76b5`](https://github.com/Aneety/ai/commit/b9d76b59c1ca49efeba9a20f6075d34599fbb9b1) cria `worker-relatorios`, contrato HTTP, testes, validações, docs, `.env.example`, `.gitignore` e prova de custo zero atualizada. Actions verdes no branch. | Aguardando merge para considerar a raiz canônica consolidada em `main`. | Manter PR verde e concluir merge depois da revisão. |
| `deploy` | `validacao` | alta | `processo` | Cloudflare dry-run [`28339596658`](https://github.com/Aneety/ai/actions/runs/28339596658) e deploy [`28339616233`](https://github.com/Aneety/ai/actions/runs/28339616233) passaram para `aneety-platform/apps/relatorios-operacionais/worker-relatorios`. URL publicada: `https://worker-relatorios.ricardomalnati.workers.dev`. | Aguardando merge da evidência versionada em `main`. | Reexecutar deploy só se o código mudar antes do merge. |
| `publicacao` | `validacao` | alta | `processo` | Evidência real em `aneety-platform/apps/relatorios-operacionais/worker-relatorios/publication-evidence.json`; deploy [`28339616233`](https://github.com/Aneety/ai/actions/runs/28339616233); smoke [`28339637324`](https://github.com/Aneety/ai/actions/runs/28339637324); resultado `success`. | Aguardando merge da PR [#89](https://github.com/Aneety/ai/pull/89). | Após merge, registrar SHA final de `main`. |
| `banco` | `na` | alta | `DB` | v1 sem banco, storage ou histórico de PDF. | — | Reavaliar só com novo contrato aprovado. |
| `jobs` | `na` | alta | `processo` | v1 síncrona, sem fila ou job assíncrono. | — | Reavaliar só se volume exigir fila e nova prova de custo. |
| `backend` | `validacao` | alta | `backend` | Contrato v1 implementado: `GET /health`, `GET /contract`, `POST /reports/pdf`; testes de módulo e Remote CI gate passaram no PR. | Aguardando merge para estabilizar contrato em `main`. | Preservar contrato `2026-06-28.relatorios-operacionais.pdf.v1`. |
| `teste-integracao-api` | `validacao` | alta | `API` | Smoke funcional remoto [`28339637324`](https://github.com/Aneety/ai/actions/runs/28339637324) executou `GET /health`, `GET /contract` e `POST /reports/pdf` autenticado. | Aguardando merge da evidência. | Reexecutar smoke se URL, token ou contrato mudarem. |
| `microfrontend` | `na` | alta | `UI` | v1 sem UI e sem editor visual de templates. | — | Reavaliar só com novo ciclo de UI. |
| `smoke` | `validacao` | alta | `smoke` | Smoke PDF remoto confirmou `Content-Type: application/pdf`, bytes iniciando com `%PDF`, `X-Browser-Ms-Used=96`, limite diário free `600000 ms` e projeção operacional `300000 ms/day`. | Aguardando merge da PR [#89](https://github.com/Aneety/ai/pull/89). | Monitorar consumo real; parar publicação se aproximar de `10 minutes/day`. |
| `teste` | `validacao` | alta | `teste` | Actions verdes: Remote CI gate, Governance policy/audit, Security/CodeQL e Dependency Review; testes locais leves: `node --check`, validação de contrato, testes Node e prova de custo zero. | Aguardando estado final pós-evidência no PR. | Revalidar checks após commit da evidência. |
| `documentacao` | `validacao` | alta | `docs` | Docs normativos, README do módulo, `.env.example`, prova de custo zero, painel operacional e evidência de publicação atualizados. | Aguardando merge. | Registrar SHA final de `main` se houver merge. |
| `governanca` | `validacao` | alta | `governanca` | Prova de custo zero validada em `2026-06-28T23:04:35Z`, válida até `2026-07-05T23:04:35Z`; 7 serviços; conta Cloudflare Free; Workers projetados `9/100`; Browser Run projetado `5 minutes/day` de `10 minutes/day`. | Prova expira em `2026-07-05T23:04:35Z`; qualquer nova publicação após isso exige revalidação. | Não fazer novo deploy/merge/claim com prova expirada. |

## Evidência remota validada

| Item | Valor |
| --- | --- |
| PR | [#89](https://github.com/Aneety/ai/pull/89) |
| Commit validado | [`b9d76b59c1ca49efeba9a20f6075d34599fbb9b1`](https://github.com/Aneety/ai/commit/b9d76b59c1ca49efeba9a20f6075d34599fbb9b1) |
| Dry-run | [`28339596658`](https://github.com/Aneety/ai/actions/runs/28339596658) |
| Deploy | [`28339616233`](https://github.com/Aneety/ai/actions/runs/28339616233) |
| Smoke | [`28339637324`](https://github.com/Aneety/ai/actions/runs/28339637324) |
| URL publicada | `https://worker-relatorios.ricardomalnati.workers.dev` |
| PDF smoke | `success`, `application/pdf`, `%PDF`, `X-Browser-Ms-Used=96`, `18544 bytes` |
| Prova custo zero | `docs/ai-guardrails/cost-proofs/current-services.json`, 7 serviços, `free`, válida até `2026-07-05T23:04:35Z` |
| Evidência versionada | `aneety-platform/apps/relatorios-operacionais/worker-relatorios/publication-evidence.json` |

## Decisões v1

- Gerar PDF sob demanda com `worker-relatorios` em Cloudflare Workers.
- Usar Browser Run Quick Actions por binding `BROWSER`, sem REST API Cloudflare dentro do Worker.
- Responder diretamente `application/pdf`, sem storage, fila, banco, histórico ou link público persistente.
- Exigir token operacional em `POST /reports/pdf`; `GET /health` fica público e `GET /contract` exige versão de contrato.
- Aceitar HTML final ou `templateHtml + content`, com substituição simples `{{field}}` escapada e `{{{fieldHtml}}}` sanitizada.
- Bloquear scripts, handlers inline, iframes, objetos, embeds, `@import`, CSS remoto, imagens externas e URLs externas no HTML v1.
- Medir cada smoke PDF pelo header `X-Browser-Ms-Used` e manter projeção conservadora de até `5 minutes/day`.

## Histórico

- 2026-06-28 — decisão v1: gerar PDF sob demanda com `worker-relatorios` em Cloudflare Workers, usando Browser Run Quick Actions por binding `BROWSER`, resposta direta `application/pdf`, endpoint autenticado e sem storage/fila/banco.
- 2026-06-28 — custo zero projetado: conta Cloudflare em plano gratuito, 8 Workers atuais, projeção de 9/100 Workers, 0 bindings Browser Run existentes antes da implementação, Browser Run projetado até 5 minutes/day contra franquia free de 10 minutes/day.
- 2026-06-28 — PR [#89](https://github.com/Aneety/ai/pull/89) no commit [`b9d76b5`](https://github.com/Aneety/ai/commit/b9d76b59c1ca49efeba9a20f6075d34599fbb9b1) passou Actions, Cloudflare dry-run [`28339596658`](https://github.com/Aneety/ai/actions/runs/28339596658), deploy [`28339616233`](https://github.com/Aneety/ai/actions/runs/28339616233) e smoke PDF remoto [`28339637324`](https://github.com/Aneety/ai/actions/runs/28339637324) com `X-Browser-Ms-Used=96`.
- 2026-06-28 — prova exige smoke remoto com `X-Browser-Ms-Used`; se o uso real se aproximar de 10 minutes/day, parar publicação e redesenhar antes de continuar.

## Fora de escopo v1

- Persistir PDF em R2, D1, KV ou outro storage.
- Retornar link público ou manter histórico.
- Fila assíncrona, Queue, Workflow, Durable Object ou job.
- Editor visual de templates, loops, condicionais ou engine completa.
- Assets externos no HTML.
- UI/microfrontend.

# relatorios-operacionais

| Campo | Valor |
| --- | --- |
| Responsabilidade | `relatorios-operacionais` |
| Owner | Ricardo Malnati |
| Repo destino | `Aneety/ai` |
| Caminho | `aneety-platform/apps/relatorios-operacionais/worker-relatorios` |
| Prioridade | alta |
| Runtime v1 | Cloudflare Workers + Browser Run Quick Actions |
| Custo | zero obrigatório, coberto por `docs/ai-guardrails/cost-proofs/current-services.json` |

## Status por ciclo

| Ciclo | Status | Prioridade | Gate | Evidência | Bloqueio | Próxima ação |
| --- | --- | --- | --- | --- | --- | --- |
| `repositorio` | `validacao` | alta | `processo` | Branch `codex/relatorios-operacionais-worker-pdf` cria `worker-relatorios`, contrato HTTP, testes, validações, docs e prova de custo zero atualizada. | Aguardando PR, GitHub Actions verdes e merge para concluir `repositorio`. | Publicar PR e aguardar checks remotos. |
| `deploy` | `bloqueado` | alta | `processo` | — | Depende de PR Actions verde e Cloudflare dry-run para o módulo. | Após PR verde, executar Cloudflare gate `dry-run`. |
| `publicacao` | `bloqueado` | alta | `processo` | — | Depende de Cloudflare deploy e smoke publicado. | Executar deploy e smoke remoto quando `deploy` concluir. |
| `banco` | `na` | alta | `DB` | v1 sem banco, storage ou histórico de PDF. | — | Reavaliar só com novo contrato aprovado. |
| `jobs` | `na` | alta | `processo` | v1 síncrona, sem fila ou job assíncrono. | — | Reavaliar só se volume exigir fila e nova prova de custo. |
| `backend` | `triagem` | alta | `backend` | Contrato v1 planejado: `GET /health`, `GET /contract`, `POST /reports/pdf`. | Falta evidência remota do Worker publicado. | Validar contrato em Actions e depois no smoke publicado. |
| `teste-integracao-api` | `bloqueado` | alta | `API` | — | Depende de URL publicada e token operacional em secret. | Rodar smoke PDF remoto autenticado. |
| `microfrontend` | `na` | alta | `UI` | v1 sem UI e sem editor visual de templates. | — | Reavaliar só com novo ciclo de UI. |
| `smoke` | `bloqueado` | alta | `smoke` | — | Falta `POST /reports/pdf` remoto com `%PDF` e `X-Browser-Ms-Used`. | Executar `npm run smoke:published` pelo Cloudflare gate. |
| `teste` | `bloqueado` | alta | `teste` | Testes locais leves versionados, mas aceite depende de Actions. | Aguardando CI remoto. | Corrigir PR até Remote CI gate ficar verde. |
| `documentacao` | `triagem` | alta | `docs` | Docs normativos e painel atualizados nesta branch. | Aguardando PR/checks/links finais. | Registrar PR, SHA, runs e evidência real após publicação. |
| `governanca` | `triagem` | alta | `governanca` | Prova de custo zero atualizada para 7 serviços, incluindo Browser Run Quick Actions. | Aguardando PR, gates e evidência remota. | Manter `validUntil` vigente antes de qualquer deploy, merge ou conclusão. |

## Histórico

- 2026-06-28 — decisão v1: gerar PDF sob demanda com `worker-relatorios` em Cloudflare Workers, usando Browser Run Quick Actions por binding `BROWSER`, resposta direta `application/pdf`, endpoint autenticado e sem storage/fila/banco.
- 2026-06-28 — custo zero projetado: conta Cloudflare em plano gratuito, 8 Workers atuais, projeção de 9/100 Workers, 0 bindings Browser Run existentes antes da implementação, Browser Run projetado até 5 minutes/day contra franquia free de 10 minutes/day.
- 2026-06-28 — prova exige smoke remoto com `X-Browser-Ms-Used`; se o uso real se aproximar de 10 minutes/day, parar publicação e redesenhar antes de continuar.

## Fora de escopo v1

- Persistir PDF em R2, D1, KV ou outro storage.
- Retornar link público ou manter histórico.
- Fila assíncrona, Queue, Workflow, Durable Object ou job.
- Editor visual de templates, loops, condicionais ou engine completa.
- Assets externos no HTML.
- UI/microfrontend.

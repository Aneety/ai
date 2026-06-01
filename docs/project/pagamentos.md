# pagamentos

## Cabeçalho canônico

- Responsabilidade: `pagamentos`
- Owner: Ricardo Malnati
- Repo destino: `Aneety/ai`
- Caminho canônico: `aneety-platform/apps/pagamentos/...`
- Issue histórica migrada: Issue histórica #13
- Prioridade atual: **media**

## Status operacional por ciclo

| Ciclo | Status | Prioridade | Gate | Evidência | Bloqueio | Próxima ação |
| --- | --- | --- | --- | --- | --- | --- |
| `repositorio` | `validacao` | media | `arquitetura` | Branch `codex/stitch-mvp-design` cria a raiz `aneety-platform/apps/pagamentos/` com `README.md` raiz e diretórios `db-pagamentos`, `worker-pagamentos` e `mfe-pagamentos`. | Aguardando PR, GitHub Actions e merge em `main` antes de marcar `concluido`. | Abrir PR, aguardar checks remotos e registrar SHA/PR neste arquivo antes de avançar para `deploy`. |
| `deploy` | `triagem` | media | `processo` | — | Aguardando ciclo `repositorio` ficar verde neste arquivo. | Executar `deploy` depois de concluir `repositorio` com evidência objetiva. |
| `publicacao` | `triagem` | media | `processo` | — | Aguardando ciclo `deploy` ficar verde neste arquivo. | Executar `publicacao` depois de concluir `deploy` com evidência objetiva. |
| `banco` | `triagem` | media | `DB` | — | Aguardando ciclo `publicacao` ficar verde neste arquivo. | Executar `banco` depois de concluir `publicacao` com evidência objetiva. |
| `jobs` | `na` | media | `job` | — | — | Reavaliar somente se houver mudança contratual aprovada nos documentos normativos. |
| `backend` | `triagem` | media | `backend` | — | Aguardando ciclo `banco` ficar verde neste arquivo. | Executar `backend` depois de concluir `banco` com evidência objetiva. |
| `teste-integracao-api` | `triagem` | media | `teste` | — | Aguardando ciclo `backend` ficar verde neste arquivo. | Executar `teste-integracao-api` depois de concluir `backend` com evidência objetiva. |
| `microfrontend` | `triagem` | media | `microfrontend` | — | Aguardando ciclo `teste-integracao-api` ficar verde neste arquivo. | Executar `microfrontend` depois de concluir `teste-integracao-api` com evidência objetiva. |
| `smoke` | `triagem` | media | `smoke` | — | Aguardando ciclo `microfrontend` ficar verde neste arquivo. | Executar `smoke` depois de concluir `microfrontend` com evidência objetiva. |
| `teste` | `triagem` | media | `teste` | — | Aguardando ciclo `smoke` ficar verde neste arquivo. | Executar `teste` depois de concluir `smoke` com evidência objetiva. |
| `documentacao` | `triagem` | media | `documentacao` | — | Aguardando ciclo `teste` ficar verde neste arquivo. | Executar `documentacao` depois de concluir `teste` com evidência objetiva. |
| `governanca` | `triagem` | media | `governanca` | — | Aguardando ciclo `documentacao` ficar verde neste arquivo. | Executar `governanca` depois de concluir `documentacao` com evidência objetiva. |

## Links normativos

- [Arquitetura](../01-arquitetura.md)
- [Governança](../07-governanca-github.md)
- [Planejamento de ciclos](../08-planejamento-ciclos-implementacao-repositorios.md)

## Histórico curto

- 2026-05-31 — branch `codex/stitch-mvp-design` prepara scaffold de `repositorio` com raiz física e diretórios `db-*`, `worker-*` e `mfe-*`; permanece em `validacao` até PR/checks/merge.

- 2026-05-29 — backlog migrado do painel operacional anterior para `docs/project`.
- 2026-05-30 — ciclo `repositorio` segue `bloqueado`: `Aneety/ai` está limpo/sincronizado, mas ainda expõe só `aneety-platform/apps/.gitkeep`, sem raiz concreta da responsabilidade.

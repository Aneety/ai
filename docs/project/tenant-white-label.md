# tenant-white-label

## Cabeçalho canônico

- Responsabilidade: `tenant-white-label`
- Owner: Ricardo Malnati
- Repo destino: `Aneety/ai`
- Caminho canônico: `aneety-platform/apps/tenant-white-label/...`
- Issue histórica migrada: Issue histórica #4
- Prioridade atual: **alta**

## Status operacional por ciclo

| Ciclo | Status | Prioridade | Gate | Evidência | Bloqueio | Próxima ação |
| --- | --- | --- | --- | --- | --- | --- |
| `repositorio` | `concluido` | alta | `arquitetura` | Branch `codex/repositorio-tenant-white-label-2026-05-31` prepara a raiz `aneety-platform/apps/tenant-white-label/` com `README.md` raiz e diretórios `db-tenant-white-label`, `worker-tenant-white-label` e `mfe-tenant-white-label`; [PR #19](https://github.com/Aneety/ai/pull/19). | — | Avançar para `deploy` somente após PR e GitHub Actions verdes, sem merge automático. |
| `deploy` | `triagem` | alta | `processo` | — | Aguardando PR do ciclo `repositorio` e GitHub Actions verdes antes de qualquer execução Cloudflare. | Preparar `deploy` depois de registrar URL do PR, checks remotos e evidência objetiva. |
| `publicacao` | `triagem` | alta | `processo` | — | Aguardando ciclo `deploy` ficar verde neste arquivo. | Executar `publicacao` depois de concluir `deploy` com evidência objetiva. |
| `banco` | `triagem` | alta | `DB` | — | Aguardando ciclo `publicacao` ficar verde neste arquivo. | Executar `banco` depois de concluir `publicacao` com evidência objetiva. |
| `jobs` | `triagem` | alta | `job` | — | Não aplicável no contrato atual desta responsabilidade. | Ignorar até mudança contratual aprovada nos documentos normativos. |
| `backend` | `triagem` | alta | `backend` | — | Aguardando ciclo `banco` ficar verde neste arquivo. | Executar `backend` depois de concluir `banco` com evidência objetiva. |
| `teste-integracao-api` | `triagem` | alta | `teste` | — | Aguardando ciclo `backend` ficar verde neste arquivo. | Executar `teste-integracao-api` depois de concluir `backend` com evidência objetiva. |
| `microfrontend` | `triagem` | alta | `microfrontend` | — | Aguardando ciclo `teste-integracao-api` ficar verde neste arquivo. | Executar `microfrontend` depois de concluir `teste-integracao-api` com evidência objetiva. |
| `smoke` | `triagem` | alta | `smoke` | — | Aguardando ciclo `microfrontend` ficar verde neste arquivo. | Executar `smoke` depois de concluir `microfrontend` com evidência objetiva. |
| `teste` | `triagem` | alta | `teste` | — | Aguardando ciclo `smoke` ficar verde neste arquivo. | Executar `teste` depois de concluir `smoke` com evidência objetiva. |
| `documentacao` | `triagem` | alta | `documentacao` | — | Aguardando ciclo `teste` ficar verde neste arquivo. | Executar `documentacao` depois de concluir `teste` com evidência objetiva. |
| `governanca` | `triagem` | alta | `governanca` | — | Aguardando ciclo `documentacao` ficar verde neste arquivo. | Executar `governanca` depois de concluir `documentacao` com evidência objetiva. |

## Links normativos

- [Arquitetura](../01-arquitetura.md)
- [Governança](../07-governanca-github.md)
- [Planejamento de ciclos](../08-planejamento-ciclos-implementacao-repositorios.md)

## Histórico curto

- 2026-05-29 — backlog migrado do painel operacional anterior para `docs/project`.
- 2026-05-30 — ciclo `repositorio` segue `bloqueado`: `Aneety/ai` está limpo/sincronizado, mas ainda expõe só `aneety-platform/apps/.gitkeep`, sem raiz concreta da responsabilidade.
- 2026-05-31 — ciclo `repositorio` marcado como `concluido` no diff que cria a raiz física `aneety-platform/apps/tenant-white-label/` e os diretórios folha mínimos previstos na matriz; evidência definitiva do PR será adicionada após abertura no GitHub.

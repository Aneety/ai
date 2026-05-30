# gateway-borda

## Cabeçalho canônico

- Responsabilidade: `gateway-borda`
- Owner: Ricardo Malnati
- Repo destino: `Aneety/ai`
- Caminho canônico: `aneety-platform/apps/gateway-borda/...`
- Issue histórica migrada: Issue histórica #46
- Prioridade atual: **alta**

## Status operacional por ciclo

| Ciclo | Status | Prioridade | Gate | Evidência | Bloqueio | Próxima ação |
| --- | --- | --- | --- | --- | --- | --- |
| `repositorio` | `bloqueado` | alta | `arquitetura` | Issue histórica #46 migrada para este arquivo; inspeção local 2026-05-30 confirmou novamente apenas `aneety-platform/apps/.gitkeep` em `Aneety/ai`. | Falta raiz `aneety-platform/apps/gateway-borda/...` em `Aneety/ai`; checkout local está limpo e sincronizado, então o bloqueio atual é apenas estrutural. | Abrir PR em `Aneety/ai` criando a raiz canônica da responsabilidade e registrar SHA/PR neste arquivo antes de avançar para `deploy`. |
| `deploy` | `triagem` | alta | `processo` | — | Aguardando ciclo `repositorio` ficar verde neste arquivo. | Executar `deploy` depois de concluir `repositorio` com evidência objetiva. |
| `publicacao` | `triagem` | alta | `processo` | — | Aguardando ciclo `deploy` ficar verde neste arquivo. | Executar `publicacao` depois de concluir `deploy` com evidência objetiva. |
| `banco` | `triagem` | alta | `DB` | — | Não aplicável no contrato atual desta responsabilidade. | Ignorar até mudança contratual aprovada nos documentos normativos. |
| `jobs` | `triagem` | alta | `job` | — | Não aplicável no contrato atual desta responsabilidade. | Ignorar até mudança contratual aprovada nos documentos normativos. |
| `backend` | `triagem` | alta | `backend` | — | Aguardando ciclo `publicacao` ficar verde neste arquivo. | Executar `backend` depois de concluir `publicacao` com evidência objetiva. |
| `teste-integracao-api` | `triagem` | alta | `teste` | — | Aguardando ciclo `backend` ficar verde neste arquivo. | Executar `teste-integracao-api` depois de concluir `backend` com evidência objetiva. |
| `microfrontend` | `triagem` | alta | `microfrontend` | — | Não aplicável no contrato atual desta responsabilidade. | Ignorar até mudança contratual aprovada nos documentos normativos. |
| `smoke` | `triagem` | alta | `smoke` | — | Aguardando ciclo `teste-integracao-api` ficar verde neste arquivo. | Executar `smoke` depois de concluir `teste-integracao-api` com evidência objetiva. |
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

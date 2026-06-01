# onboarding-acesso

## Cabeçalho canônico

- Responsabilidade: `onboarding-acesso`
- Owner: Ricardo Malnati
- Repo destino: `Aneety/ai`
- Caminho canônico: `aneety-platform/apps/onboarding-acesso/...`
- Issue histórica migrada: Issue histórica #6
- Prioridade atual: **alta**

## Status operacional por ciclo

| Ciclo | Status | Prioridade | Gate | Evidência | Bloqueio | Próxima ação |
| --- | --- | --- | --- | --- | --- | --- |
| `repositorio` | `concluido` | alta | `arquitetura` | [PR #24](https://github.com/Aneety/ai/pull/24) cria a raiz `aneety-platform/apps/onboarding-acesso/` com scaffolds mínimos `db-*`, `worker-*` e `mfe-*`, já mergeada em `main`. | — | Avançar para `deploy` com runtime 100% Workers e evidência remota. |
| `deploy` | `concluido` | alta | `processo` | [`Cloudflare deploy gate` dry-run #26737997590](https://github.com/Aneety/ai/actions/runs/26737997590) validou `onboarding-acesso` no SHA [`444e8d0`](https://github.com/Aneety/ai/commit/444e8d04fa94613dbbf3affca5bcbfaedfd92a5f) sem segredo versionado e com runtime Workers compatível. | — | Executar `publicacao` com evidência remota objetiva do ciclo seguinte. |
| `publicacao` | `triagem` | alta | `processo` | — | — | Executar `publicacao` agora que `deploy` já ficou verde com gate remoto comprovado. |
| `banco` | `triagem` | alta | `DB` | — | Aguardando ciclo `publicacao` ficar verde neste arquivo. | Executar `banco` depois de concluir `publicacao` com evidência objetiva. |
| `jobs` | `na` | alta | `job` | — | — | Reavaliar somente se houver mudança contratual aprovada nos documentos normativos. |
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
- 2026-05-30 — ciclo `repositorio` seguia `bloqueado`: `Aneety/ai` estava limpo/sincronizado, mas ainda expunha só `aneety-platform/apps/.gitkeep`, sem raiz concreta da responsabilidade.
- 2026-05-31 — ciclo `repositorio` concluído pela [PR #24](https://github.com/Aneety/ai/pull/24), mergeada em `main`, criando a raiz `aneety-platform/apps/onboarding-acesso/` com scaffolds mínimos `db-*`, `worker-*` e `mfe-*`.
- 2026-06-01 — ciclo `deploy` avançado para `validacao`: `worker-onboarding-acesso` agora tem Worker Cloudflare versionável, `wrangler.toml` sem segredos, contrato mínimo `/health`/`/contract`, testes e validação de deploy; falta PR/checks remotos e `Cloudflare deploy gate` dry-run para concluir o ciclo.


## Triagem Google Stitch

- Referência detalhada: [`docs/design/google-stitch-mvp-triage.md`](../design/google-stitch-mvp-triage.md).
- Diretriz para `microfrontend`: Telas Stitch úteis: boas-vindas ao fornecedor, identificação do negócio, configuração operacional, cadastro em análise, aprovação/rejeição, correção e reenvio. E-mail/push não pode ser requisito.
- Antes de implementar UI, seguir `aneety-platform/templates/mfe-react-shadcn/` e validar que a copy final não expõe stack, banco, runtime, fornecedor técnico, segredo, hash, token ou ferramenta interna.

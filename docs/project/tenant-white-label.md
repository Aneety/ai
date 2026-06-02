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
| `repositorio` | `concluido` | alta | `arquitetura` | [PR #19](https://github.com/Aneety/ai/pull/19) cria a raiz `aneety-platform/apps/tenant-white-label/` com `README.md` raiz e diretórios `db-tenant-white-label`, `worker-tenant-white-label` e `mfe-tenant-white-label`, já mergeada em `main`. | — | Avançar para `deploy` com runtime 100% Workers e evidência remota. |
| `deploy` | `concluido` | alta | `processo` | [`Cloudflare deploy gate` dry-run #26734998742](https://github.com/Aneety/ai/actions/runs/26734998742) validou `tenant-white-label` no SHA [`9e83da0`](https://github.com/Aneety/ai/commit/9e83da0d136a22e61db234be78b9bde01ae565a7) sem segredo versionado e com runtime Workers compatível. | — | Executar `publicacao` com evidência remota objetiva do ciclo seguinte. |
| `publicacao` | `concluido` | alta | `processo` | [`Cloudflare deploy gate` deploy #26741516221](https://github.com/Aneety/ai/actions/runs/26741516221) publicou a URL real `https://worker-tenant-white-label.ricardomalnati.workers.dev`, [`Cloudflare deploy gate` smoke #26741553080](https://github.com/Aneety/ai/actions/runs/26741553080) validou o endpoint público e `worker-tenant-white-label/publication-evidence.json` registrou o SHA [7ea8e3b](https://github.com/Aneety/ai/commit/7ea8e3bda805834fa3ec1eb4da867ef4623418fb). | — | Executar `banco` com evidência objetiva do primeiro contrato persistido após a URL pública validada. |
| `banco` | `concluido` | alta | `DB` | [`Cloudflare D1 gate` #26850571410](https://github.com/Aneety/ai/actions/runs/26850571410) validou migration, seed, fixture e rollback em banco efêmero D1; `db-tenant-white-label/d1-validation-evidence.json` registrou o SHA [61d1b39](https://github.com/Aneety/ai/commit/61d1b39fa4fb9cdd51644eab65f45a1609a08c6e). | — | Executar `backend` com contrato HTTP/BFF sobre o banco validado remotamente. |
| `jobs` | `na` | alta | `job` | — | — | Reavaliar somente se houver mudança contratual aprovada nos documentos normativos. |
| `backend` | `triagem` | alta | `backend` | — | — | Executar `backend` agora que `banco` já ficou verde com evidência D1-backed remota. |
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
- 2026-05-31 — ciclo `repositorio` concluído pela [PR #19](https://github.com/Aneety/ai/pull/19), mergeada em `main`, criando a raiz física `aneety-platform/apps/tenant-white-label/` e os diretórios folha mínimos previstos na matriz.
- 2026-06-01 — ciclo `deploy` avançou para `validacao`: o módulo `worker-tenant-white-label` agora possui Worker Cloudflare versionável, `wrangler.toml` sem segredos, contrato mínimo `/health` e `/contract`, testes de módulo e validação de deploy; conclusão depende de PR/checks remotos e `Cloudflare deploy gate` em modo `dry-run`.

- 2026-06-01 — ciclo `publicacao` avançou sem concluir aceite remoto: o módulo `worker-tenant-white-label` agora possui template e validação de evidência de publicação para URL HTTPS, runs remotos de deploy/smoke, SHA e versão de contrato; o status fica `bloqueado` até o scheduler publicar a branch, obter PR gate verde, executar `Cloudflare deploy gate` em modo `deploy`/`smoke` e versionar a evidência real.


- 2026-06-01 — ciclo `banco` avançou para `validacao`: `db-tenant-white-label` recebeu migration/rollback D1 para `tenants`, `tenant_branding` e auditoria, seed sanitizado Lia Demonstração, contrato de storage `TENANT_WHITE_LABEL_DB`, queries CRUD tenant-scoped e validação leve; conclusão depende do scheduler publicar o diff, obter checks verdes e registrar execução Cloudflare D1-backed da migration/fixture.

## Triagem Google Stitch

- Referência detalhada: [`docs/design/google-stitch-mvp-triage.md`](../design/google-stitch-mvp-triage.md).
- Diretriz para `microfrontend`: Telas Stitch úteis: administração mobile, tenants, usuários, fluxos ativos e métricas. Implementar sem termos como chave, API, runtime, fornecedor técnico ou segredo; usar copy “configuração precisa de atenção”.
- Antes de implementar UI, seguir `aneety-platform/templates/mfe-react-shadcn/` e validar que a copy final não expõe stack, banco, runtime, fornecedor técnico, segredo, hash, token ou ferramenta interna.

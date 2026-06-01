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
| `repositorio` | `concluido` | alta | `arquitetura` | [PR #14](https://github.com/Aneety/ai/pull/14) valida `aneety-platform/apps/gateway-borda/`, `worker-gateway/` e `pkg-contratos-publicos/` com checks remotos verdes antes do merge. | — | Iniciar ciclo `deploy` somente com runtime 100% Workers e evidência remota. |
| `deploy` | `bloqueado` | alta | `processo` | Branch `codex/deploy-gateway-borda-cloudflare-gate` reforça a suíte do `worker-gateway` com CORS preflight, recusa de versão pública incompatível e erro canônico de service binding ausente, preservando Wrangler sem segredos e contrato público Workers-compatible. | Executor sem remoto Git configurado para publicar branch/PR; sem PR/checks remotos e sem Cloudflare dry-run/deploy no gate oficial nesta task. | Publicar branch com prefixo `codex/deploy-gateway-borda`, abrir PR contra `main`, aguardar GitHub Actions verdes e então acionar Cloudflare gate remoto antes de avançar para `publicacao`. |
| `publicacao` | `triagem` | alta | `processo` | — | Aguardando ciclo `deploy` ficar verde neste arquivo. | Executar `publicacao` depois de concluir `deploy` com evidência objetiva. |
| `banco` | `na` | alta | `DB` | — | — | Reavaliar somente se houver mudança contratual aprovada nos documentos normativos. |
| `jobs` | `na` | alta | `job` | — | — | Reavaliar somente se houver mudança contratual aprovada nos documentos normativos. |
| `backend` | `triagem` | alta | `backend` | — | Aguardando ciclo `publicacao` ficar verde neste arquivo. | Executar `backend` depois de concluir `publicacao` com evidência objetiva. |
| `teste-integracao-api` | `triagem` | alta | `teste` | — | Aguardando ciclo `backend` ficar verde neste arquivo. | Executar `teste-integracao-api` depois de concluir `backend` com evidência objetiva. |
| `microfrontend` | `na` | alta | `microfrontend` | — | — | Reavaliar somente se houver mudança contratual aprovada nos documentos normativos. |
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
- 2026-05-30 — ciclo `repositorio` concluído pela PR #14: raiz canônica `aneety-platform/apps/gateway-borda/` criada com contrato inicial de `worker-gateway` e `pkg-contratos-publicos`, validada por checks remotos verdes antes do merge.
- 2026-05-31 — ciclo `deploy` entra em `validacao`: branch `codex/deploy-gateway-borda-worker-gateway` adiciona Worker deployable 100% Cloudflare Workers, contrato público versionado, Wrangler sem segredos, service bindings para BFFs `worker-*`, plano de rollback e testes de rota/sessão/CORS para o gate remoto da PR.
- 2026-06-01 — ciclo `deploy` permanece bloqueado para aceite remoto: esta task adiciona cobertura leve de CORS, versão de contrato e indisponibilidade de binding no `worker-gateway`, mas o checkout não possui remoto Git configurado para push/PR; o gate oficial continua sendo PR com GitHub Actions verdes seguido de Cloudflare dry-run/deploy remoto.

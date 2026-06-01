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
| `deploy` | `concluido` | alta | `processo` | `aneety-platform/apps/gateway-borda/worker-gateway` já mantém `deploy:validate`, service bindings canônicos e `wrangler.toml` sem segredo versionado; o SHA [`cbee580`](https://github.com/Aneety/ai/commit/cbee580800141f0a9e57c8f83208e4de09babb00) passou por [`Remote CI gate` #26730946693](https://github.com/Aneety/ai/actions/runs/26730946693), [`Governance policy gate` #26730946687](https://github.com/Aneety/ai/actions/runs/26730946687), [`Security gate` #26730946690](https://github.com/Aneety/ai/actions/runs/26730946690) e [`Cloudflare deploy gate` dry-run #26731277372](https://github.com/Aneety/ai/actions/runs/26731277372). | — | Iniciar `publicacao` com URL publicada do endpoint de borda e evidência remota do ambiente alvo. |
| `publicacao` | `triagem` | alta | `processo` | `deploy` concluído com dry-run remoto do Worker em `Cloudflare deploy gate`. | — | Publicar o endpoint do gateway em ambiente remoto permitido, registrar a URL real e a evidência do ciclo em GitHub Actions/Cloudflare. |
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
- 2026-06-01 — ciclo `deploy` permanece bloqueado por gate remoto ausente: além da cobertura de CORS, versão de contrato e indisponibilidade de binding, a branch local `codex/deploy-gateway-borda-deploy-contract-validation` adiciona `deploy:validate` para proteger `wrangler.toml` contra drift de contrato, variáveis com aparência de segredo e service bindings divergentes antes do `Cloudflare deploy gate` em `dry-run`; conclusão depende de PR/checks remotos.
- 2026-06-01 — ciclo `deploy` concluído no SHA [`cbee580`](https://github.com/Aneety/ai/commit/cbee580800141f0a9e57c8f83208e4de09babb00): `Remote CI gate`, `Governance policy gate` e `Security gate` ficaram verdes em `main`, e o [`Cloudflare deploy gate` dry-run #26731277372](https://github.com/Aneety/ai/actions/runs/26731277372) validou `aneety-platform/apps/gateway-borda/worker-gateway` sem segredo versionado e com service bindings canônicos. O próximo ciclo ativo passa a ser `publicacao`.

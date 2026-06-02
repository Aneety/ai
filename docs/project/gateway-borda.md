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
| `publicacao` | `concluido` | alta | `processo` | [`Cloudflare deploy gate` deploy #26752179408](https://github.com/Aneety/ai/actions/runs/26752179408) publicou a URL real `https://aneety-worker-gateway-borda.ricardomalnati.workers.dev`, [`Cloudflare deploy gate` smoke #26752219345](https://github.com/Aneety/ai/actions/runs/26752219345) validou o endpoint e `worker-gateway/publication-evidence.json` registrou o SHA [1244bf4](https://github.com/Aneety/ai/commit/1244bf4fc33f17c32d89d9ec920b1d1982b22fd7). | — | Executar `backend` com evidência objetiva dos BFFs Workers compatíveis com a borda publicada. |
| `banco` | `na` | alta | `DB` | — | — | Reavaliar somente se houver mudança contratual aprovada nos documentos normativos. |
| `jobs` | `na` | alta | `job` | — | — | Reavaliar somente se houver mudança contratual aprovada nos documentos normativos. |
| `backend` | `bloqueado` | alta | `backend` | `worker-gateway/backend-readiness.json` e `npm run backend:validate` documentam a URL publicada, versão de contrato, runtime Workers, bindings e caminhos upstream exigidos; `/contract` permanece limitado ao contrato público de rotas sem expor o blocker operacional. | Os BFFs `identidade-acesso`, `tenant-white-label` e `onboarding-acesso` ainda não têm ciclos `backend` concluídos para `/session`, `/branding` e `/invitations`; `tenant-white-label` já está em `backend`/triagem, enquanto `identidade-acesso` e `onboarding-acesso` ainda estão retidos em `banco`/validação remota. | Concluir `backend` dos três BFFs dependentes e então executar gate remoto do `gateway-borda/backend` contra a URL publicada. |
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
- 2026-06-01 — ciclo `publicacao` fica bloqueado por dependência remota objetiva: a branch prepara o contrato versionável de evidência (`publication-evidence.example.json`), o comando `publication:validate` e o runbook de publicação/smoke, mas a URL HTTPS real ainda depende de `Cloudflare deploy gate` em modo `deploy` após PR gate verde e dependências remotas compatíveis com os service bindings declarados.
- 2026-06-01 — tentativa real de `publicacao` executada no [`Cloudflare deploy gate` deploy #26731716443](https://github.com/Aneety/ai/actions/runs/26731716443) falhou antes do deploy porque `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` chegaram vazios ao GitHub Actions.
- 2026-06-01 — com os segredos corrigidos, a tentativa real em [`Cloudflare gate deploy gateway-borda-publicacao-deploy-20260601031723` #26733250918](https://github.com/Aneety/ai/actions/runs/26733250918) provou que o blocker atual não é mais credencial: o deploy alcançou a API Cloudflare, mas falhou com `code: 10143` porque o binding `IDENTIDADE_ACESSO` aponta para `worker-identidade-acesso`, inexistente na conta alvo. O scheduler passa a preemptar `gateway-borda/publicacao` para concluir primeiro `tenant-white-label/deploy`, `identidade-acesso/deploy` e `onboarding-acesso/deploy`.
- 2026-06-01 — ciclo `backend` avança para bloqueio objetivo com contrato versionável: `backend-readiness.json` e `backend:validate` registram bindings, caminhos upstream e evidências de publicação existentes, enquanto `/contract` mantém apenas metadados públicos de rotas, mas a conclusão depende dos ciclos `backend` de `identidade-acesso`, `tenant-white-label` e `onboarding-acesso` para expor `/session`, `/branding` e `/invitations` em Workers publicados.

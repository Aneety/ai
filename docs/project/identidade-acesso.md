# identidade-acesso

## Cabeçalho canônico

- Responsabilidade: `identidade-acesso`
- Owner: Ricardo Malnati
- Repo destino: `Aneety/ai`
- Caminho canônico: `aneety-platform/apps/identidade-acesso/...`
- Issue histórica migrada: Issue histórica #5
- Prioridade atual: **alta**

## Status operacional por ciclo

| Ciclo | Status | Prioridade | Gate | Evidência | Bloqueio | Próxima ação |
| --- | --- | --- | --- | --- | --- | --- |
| `repositorio` | `concluido` | alta | `arquitetura` | [PR #22](https://github.com/Aneety/ai/pull/22) cria a raiz `aneety-platform/apps/identidade-acesso/` com scaffolds mínimos `db-identidade-acesso`, `worker-identidade-acesso` e `mfe-identidade-acesso`, já mergeada em `main`. | — | Avançar para `deploy` com runtime 100% Workers e evidência remota. |
| `deploy` | `concluido` | alta | `processo` | [`Cloudflare deploy gate` dry-run #26736094412](https://github.com/Aneety/ai/actions/runs/26736094412) validou `identidade-acesso` no SHA [`2d8c40b`](https://github.com/Aneety/ai/commit/2d8c40bc6fc4a67807b4299c09752ddf80e36639) sem segredo versionado e com runtime Workers compatível. | — | Executar `publicacao` com evidência remota objetiva do ciclo seguinte. |
| `publicacao` | `concluido` | alta | `processo` | [`Cloudflare deploy gate` deploy #26743905163](https://github.com/Aneety/ai/actions/runs/26743905163) publicou a URL real `https://worker-identidade-acesso.ricardomalnati.workers.dev`, [`Cloudflare deploy gate` smoke #26743946336](https://github.com/Aneety/ai/actions/runs/26743946336) validou o endpoint público e `worker-identidade-acesso/publication-evidence.json` registrou o SHA [98f001c](https://github.com/Aneety/ai/commit/98f001c986069d2f7a6a9aefaef8f0edc823a084). | — | Executar `banco` com evidência objetiva do primeiro contrato persistido após a URL pública validada. |
| `banco` | `triagem` | alta | `DB` | — | — | Executar `banco` agora que `publicacao` já ficou verde com URL real publicada. |
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
- 2026-05-31 — ciclo `repositorio` concluído pela [PR #22](https://github.com/Aneety/ai/pull/22), mergeada em `main`, criando a raiz canônica `aneety-platform/apps/identidade-acesso/` e os scaffolds mínimos do ciclo.
- 2026-06-01 — ciclo `deploy` avançado para `validacao`: `worker-identidade-acesso` agora tem Worker Cloudflare versionável, `wrangler.toml` sem segredos, contrato mínimo `/health`/`/contract`, testes e validação de deploy; falta PR/checks remotos e `Cloudflare deploy gate` dry-run para concluir o ciclo.
- 2026-06-01 — ciclo `publicacao` preparado sem concluir aceite remoto: `worker-identidade-acesso` agora possui template e validação de evidência para URL HTTPS publicada, runs `deploy`/`smoke` e SHA; o status fica `bloqueado` até o scheduler publicar a PR, obter GitHub Actions verdes, executar Cloudflare deploy/smoke e versionar a evidência real.


## Triagem Google Stitch

- Referência detalhada: [`docs/design/google-stitch-mvp-triage.md`](../design/google-stitch-mvp-triage.md).
- Diretriz para `microfrontend`: Stitch não cobriu login próprio completo. Criar UI de entrada, convite, recuperação, sessão expirada e permissão insuficiente usando template `mfe-*`; SSO externo permanece opcional e desligável.
- Antes de implementar UI, seguir `aneety-platform/templates/mfe-react-shadcn/` e validar que a copy final não expõe stack, banco, runtime, fornecedor técnico, segredo, hash, token ou ferramenta interna.

# Painel operacional em Markdown

`docs/project` é a fonte única de backlog, status, owner, evidência e bloqueio da Aneety Platform. O painel operacional anterior foi descontinuado para uso diário. GitHub Issues e PRs continuam apenas como histórico, discussão e vínculo de evidência quando necessário.

## Método

- Atualize primeiro o arquivo da responsabilidade antes de mudar status operacional em qualquer outro lugar.
- Use sempre os campos canônicos: `Status`, `Ciclo`, `Responsabilidade`, `Repo destino`, `Owner`, `Prioridade`, `Gate`, `Evidência`, `Bloqueio`.
- Trate GitHub Issues como trilha histórica; não como painel ativo de status.

## Visão executiva

| Responsabilidade | Owner | Prioridade | Ciclo ativo | Status | Arquivo | Evidência atual | Bloqueio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `gateway-borda` | Ricardo Malnati | alta | `publicacao` | `bloqueado` | [gateway-borda](./gateway-borda.md) | PR #41 preparou evidência versionável de publicação; com os segredos corrigidos, o run [`Cloudflare gate deploy gateway-borda-publicacao-deploy-20260601031723` #26733250918](https://github.com/Aneety/ai/actions/runs/26733250918) alcançou a API Cloudflare e falhou em `code: 10143` porque o service binding `IDENTIDADE_ACESSO` ainda referencia `worker-identidade-acesso` ausente na conta alvo. | `gateway-borda/publicacao` depende primeiro de `tenant-white-label/deploy`, `identidade-acesso/deploy` e `onboarding-acesso/deploy` verdes para publicar a borda com bindings compatíveis. |
| `tenant-white-label` | Ricardo Malnati | alta | `banco` | `validacao` | [tenant-white-label](./tenant-white-label.md) | `db-tenant-white-label` declara migration/rollback D1, seed sanitizado Lia Demonstração, contrato de storage `TENANT_WHITE_LABEL_DB`, queries CRUD tenant-scoped e validação leve de isolamento/segredos. | Aguardando scheduler publicar PR/checks e registrar execução Cloudflare D1-backed da migration/fixture antes de concluir `banco`. |
| `identidade-acesso` | Ricardo Malnati | alta | `banco` | `validacao` | [identidade-acesso](./identidade-acesso.md) | `db-identidade-acesso` declara migration/rollback D1, seed sanitizado Lia Demonstração, contrato de storage `IDENTIDADE_ACESSO_DB`, queries tenant-scoped, fixture negativa de sessão revogada/cross-tenant e validação leve de hashes, expiração/revogação e permissões. | Aguardando scheduler publicar PR/checks e registrar execução Cloudflare D1-backed da migration, rollback e fixture antes de concluir `banco`. |
| `onboarding-acesso` | Ricardo Malnati | alta | `banco` | `triagem` | [onboarding-acesso](./onboarding-acesso.md) | [`Cloudflare deploy gate` deploy #26748135600](https://github.com/Aneety/ai/actions/runs/26748135600) publicou a URL real `https://worker-onboarding-acesso.ricardomalnati.workers.dev`, [`Cloudflare deploy gate` smoke #26748178046](https://github.com/Aneety/ai/actions/runs/26748178046) validou o endpoint público e `worker-onboarding-acesso/publication-evidence.json` registrou o SHA [cdeec94](https://github.com/Aneety/ai/commit/cdeec94eef79086ba620364ea7a38b7eeddc73b4). | — |
| `pedidos-customizados` | Ricardo Malnati | alta | `repositorio` | `validacao` | [pedidos-customizados](./pedidos-customizados.md) | Branch `codex/stitch-mvp-design` cria raiz física e scaffolds mínimos em `aneety-platform/apps/pedidos-customizados/`. | Aguardando PR/checks remotos e merge em `main` para concluir `repositorio`. |
| `workflow-estados` | Ricardo Malnati | alta | `repositorio` | `validacao` | [workflow-estados](./workflow-estados.md) | Branch `codex/stitch-mvp-design` cria raiz física e scaffolds mínimos em `aneety-platform/apps/workflow-estados/`. | Aguardando PR/checks remotos e merge em `main` para concluir `repositorio`. |
| `catalogo-operacional` | Ricardo Malnati | alta | `repositorio` | `validacao` | [catalogo-operacional](./catalogo-operacional.md) | Branch `codex/stitch-mvp-design` cria raiz física e scaffolds mínimos em `aneety-platform/apps/catalogo-operacional/`. | Aguardando PR/checks remotos e merge em `main` para concluir `repositorio`. |
| `identidade-federada` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [identidade-federada](./identidade-federada.md) | Issue histórica #11 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `qualidade-evidencias` | Ricardo Malnati | media | `repositorio` | `validacao` | [qualidade-evidencias](./qualidade-evidencias.md) | Branch `codex/stitch-mvp-design` cria raiz física e scaffolds mínimos em `aneety-platform/apps/qualidade-evidencias/`. | Aguardando PR/checks remotos e merge em `main` para concluir `repositorio`. |
| `pagamentos` | Ricardo Malnati | media | `repositorio` | `validacao` | [pagamentos](./pagamentos.md) | Branch `codex/stitch-mvp-design` cria raiz física e scaffolds mínimos em `aneety-platform/apps/pagamentos/`. | Aguardando PR/checks remotos e merge em `main` para concluir `repositorio`. |
| `offline-sync` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [offline-sync](./offline-sync.md) | Issue histórica #14 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `marketplace-operacional` | Ricardo Malnati | media | `repositorio` | `validacao` | [marketplace-operacional](./marketplace-operacional.md) | Branch `codex/stitch-mvp-design` cria raiz física e scaffolds mínimos em `aneety-platform/apps/marketplace-operacional/`. | Aguardando PR/checks remotos e merge em `main` para concluir `repositorio`. |
| `producao-execucao` | Ricardo Malnati | media | `repositorio` | `validacao` | [producao-execucao](./producao-execucao.md) | Branch `codex/stitch-mvp-design` cria raiz física e scaffolds mínimos em `aneety-platform/apps/producao-execucao/`. | Aguardando PR/checks remotos e merge em `main` para concluir `repositorio`. |
| `logistica-rastreabilidade` | Ricardo Malnati | media | `repositorio` | `validacao` | [logistica-rastreabilidade](./logistica-rastreabilidade.md) | Branch `codex/stitch-mvp-design` cria raiz física e scaffolds mínimos em `aneety-platform/apps/logistica-rastreabilidade/`. | Aguardando PR/checks remotos e merge em `main` para concluir `repositorio`. |
| `auditoria-operacional` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [auditoria-operacional](./auditoria-operacional.md) | Issue histórica #19 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `sla-capacidade` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [sla-capacidade](./sla-capacidade.md) | Issue histórica #20 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `orcamentos-precificacao` | Ricardo Malnati | media | `repositorio` | `validacao` | [orcamentos-precificacao](./orcamentos-precificacao.md) | Branch `codex/stitch-mvp-design` cria raiz física e scaffolds mínimos em `aneety-platform/apps/orcamentos-precificacao/`. | Aguardando PR/checks remotos e merge em `main` para concluir `repositorio`. |
| `comunicacao-operacional` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [comunicacao-operacional](./comunicacao-operacional.md) | Issue histórica #22 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `comunicacao-email` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [comunicacao-email](./comunicacao-email.md) | Issue histórica #23 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `suporte-excecoes` | Ricardo Malnati | media | `repositorio` | `validacao` | [suporte-excecoes](./suporte-excecoes.md) | Branch `codex/stitch-mvp-design` cria raiz física e scaffolds mínimos em `aneety-platform/apps/suporte-excecoes/`. | Aguardando PR/checks remotos e merge em `main` para concluir `repositorio`. |
| `privacidade-consentimento` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [privacidade-consentimento](./privacidade-consentimento.md) | Issue histórica #25 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `demo-seeds` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [demo-seeds](./demo-seeds.md) | Issue histórica #26 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |

## Bloqueios globais

- `gateway-borda`, `tenant-white-label`, `identidade-acesso` e `onboarding-acesso` já possuem raiz canônica em `aneety-platform/apps/<responsabilidade>/...`. As responsabilidades preparadas na branch `codex/stitch-mvp-design` ainda aguardam PR/checks/merge para fechar `repositorio`; responsabilidades não preparadas seguem sem raiz concreta em `aneety-platform/apps/<responsabilidade>/...`.
- Painel operacional ativo consolidado em `Aneety/ai/docs/project`; não há dependência de painel fora do repositório para status, owner, evidência ou bloqueio.
- `Aneety/ai` concentra workflows/checks, documentação, backlog e assets; mudanças passam pelo gate remoto deste repositório.
- GitHub Actions em `main` seguem verdes, mas `gh run view 26675134837` e `26675141018` registraram anotação objetiva de depreciação Node.js 20 em `actions/checkout@v4` e `actions/setup-node@v4`; próxima ação mínima é abrir PR de workflow para remover esse risco antes do corte informado pelo GitHub.

## Últimas atualizações

- 2026-05-31 — branch `codex/stitch-mvp-design` registra triagem Google Stitch, template React/Shadcn/Single SPA e scaffolds `repositorio` para fluxos visuais futuros antes dos ciclos `microfrontend`.

- 2026-05-30 — transição definida: `Aneety/ai` passa a concentrar documentação, backlog operacional, assets, PRs, checks e evidências.
- 2026-05-30 — `docs/project` neste repositório segue como fonte única de backlog operacional; nenhuma consulta a painel fora do repositório é necessária.
- 2026-05-30 — PR [#7](https://github.com/Aneety/ai/pull/7) já está mergeada em `Aneety/ai`; `gh pr checks 7 --repo Aneety/ai` e `gh run view` confirmaram `Governance audit`, `Security gate`, `Remote CI gate`, `Governance policy gate` e `Cloudflare deploy gate` verdes entre o PR `codex/ai-canonical-transition` e o push em `main` no SHA `33620f5b834a`.
- 2026-05-30 — `gateway-borda` conclui o ciclo `repositorio` pela PR #14; demais responsabilidades seguem bloqueadas em `repositorio` por falta de raiz canônica.
- 2026-05-31 — `gateway-borda` avança o ciclo `deploy` para `validacao` com Worker deployable, contrato público versionado, service bindings canônicos, plano de rollback e configuração Wrangler sem segredos aguardando PR/checks remotos e Cloudflare gate.
- 2026-06-01 — `gateway-borda` mantém `deploy` bloqueado por gate remoto ausente: o `worker-gateway` já possui cobertura leve de CORS, versão de contrato e binding ausente, e a branch local `codex/deploy-gateway-borda-deploy-contract-validation` adiciona `deploy:validate` para proteger `wrangler.toml` contra drift de contrato, variáveis com aparência de segredo e service bindings divergentes; falta publicar PR e obter GitHub Actions/Cloudflare dry-run verdes.
- 2026-06-01 — `gateway-borda` conclui `deploy` no SHA [`cbee580`](https://github.com/Aneety/ai/commit/cbee580800141f0a9e57c8f83208e4de09babb00): `Remote CI gate`, `Governance policy gate` e `Security gate` ficaram verdes em `main`, e o [`Cloudflare deploy gate` dry-run #26731277372](https://github.com/Aneety/ai/actions/runs/26731277372) validou `aneety-platform/apps/gateway-borda/worker-gateway`; o próximo ciclo ativo passa a ser `publicacao`.
- 2026-05-31 — `tenant-white-label`, `identidade-acesso` e `onboarding-acesso` concluem `repositorio` pelas PRs [#19](https://github.com/Aneety/ai/pull/19), [#22](https://github.com/Aneety/ai/pull/22) e [#24](https://github.com/Aneety/ai/pull/24), todas mergeadas em `main`, e passam a ter `deploy` como próximo ciclo acionável.

- 2026-05-30 — monitoramento Codex Cloud registrado em [`controller-monitoring-2026-05-30.md`](./controller-monitoring-2026-05-30.md): `gh` autenticado para leitura, nenhum PR aberto no momento da consulta, workflows ativos listados, últimos runs de `main` verdes no SHA `1a039111882ee949722bd3980c4f6550d323fa32`, 22 responsabilidades ainda bloqueadas em `repositorio` por falta de raízes canônicas, e push/PR remoto bloqueado por `403 Permission to Aneety/ai.git denied to Malnati`.


- 2026-06-01 — `gateway-borda` avança o preparo do ciclo `publicacao` sem concluir aceite remoto: o Worker agora possui template e validação de evidência para URL publicada, runs `deploy`/`smoke`, SHA e versão de contrato; o status fica `bloqueado` até existir URL HTTPS real publicada pelo `Cloudflare deploy gate` remoto.

- 2026-06-01 — `gateway-borda` tentou avançar `publicacao` pelo `Cloudflare deploy gate` remoto em modo `deploy`, mas o run #26731716443 falhou com `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` vazios.
- 2026-06-01 — depois da correção dos segredos, o run [`Cloudflare gate deploy gateway-borda-publicacao-deploy-20260601031723` #26733250918](https://github.com/Aneety/ai/actions/runs/26733250918) mostrou o blocker estrutural real: `worker-gateway` depende dos Workers `worker-identidade-acesso`, `worker-tenant-white-label` e `worker-onboarding-acesso`. O scheduler passa a preemptar `gateway-borda/publicacao` para concluir os ciclos `deploy` dessas dependências antes de uma nova tentativa de publicação da borda.
- 2026-06-01 — `tenant-white-label` avança o preparo de `deploy` para `validacao`: `worker-tenant-white-label` agora tem Worker Cloudflare versionável, `wrangler.toml` sem segredos, contrato mínimo `/health`/`/contract`, testes e validação de deploy; falta PR/checks remotos e `Cloudflare deploy gate` dry-run para concluir o ciclo.
- 2026-06-01 — `tenant-white-label` avança o preparo de `publicacao` sem concluir aceite remoto: o Worker agora possui template e validação de evidência para URL HTTPS publicada, runs `deploy`/`smoke` e SHA; o status fica `bloqueado` até o scheduler publicar a PR, obter GitHub Actions verdes, executar Cloudflare deploy/smoke e versionar a evidência real.
- 2026-06-01 — `tenant-white-label` avança `banco` para `validacao`: `db-tenant-white-label` agora possui contrato D1 versionável com migration, rollback, seed sanitizado, queries tenant-scoped e validação leve; falta evidência remota Cloudflare D1-backed para fechar o ciclo.
- 2026-06-01 — `identidade-acesso` avança o preparo de `deploy` para `validacao`: `worker-identidade-acesso` agora tem Worker Cloudflare versionável, `wrangler.toml` sem segredos, contrato mínimo `/health`/`/contract`, testes e validação de deploy; falta PR/checks remotos e `Cloudflare deploy gate` dry-run para concluir o ciclo.
- 2026-06-01 — `identidade-acesso` avança o preparo de `publicacao` sem concluir aceite remoto: o Worker agora possui template e validação de evidência para URL HTTPS publicada, runs `deploy`/`smoke` e SHA; o status fica `bloqueado` até o scheduler publicar a PR, obter GitHub Actions verdes, executar Cloudflare deploy/smoke e versionar a evidência real.
- 2026-06-01 — `identidade-acesso` avança `banco` para `validacao`: `db-identidade-acesso` agora possui contrato D1 versionável com migration, rollback, seed sanitizado, queries tenant-scoped, fixture negativa e validação leve cobrindo hash de credenciais, expiração/revogação de sessões, perfis, permissões e isolamento; falta evidência remota Cloudflare D1-backed para fechar o ciclo.
- 2026-06-01 — `onboarding-acesso` avança o preparo de `deploy` para `validacao`: `worker-onboarding-acesso` agora tem Worker Cloudflare versionável, `wrangler.toml` sem segredos, contrato mínimo `/health`/`/contract`, testes e validação de deploy; falta PR/checks remotos e `Cloudflare deploy gate` dry-run para concluir o ciclo.
- 2026-06-01 — `onboarding-acesso` avança o preparo de `publicacao` sem concluir aceite remoto: o Worker agora possui template e validação de evidência para URL HTTPS publicada, runs `deploy`/`smoke` e SHA; o status fica `bloqueado` até o scheduler publicar a PR, obter GitHub Actions verdes, executar Cloudflare deploy/smoke e versionar a evidência real.

## Governança mínima de atualização

1. Confirmar fonte documental e critério de aceite.
2. Atualizar `docs/project/<responsabilidade>.md` no mesmo branch da mudança.
3. Linkar PR, commit, log, screenshot ou doc na coluna `Evidência`.
4. Registrar bloqueio com causa objetiva e próxima ação.
5. Atualizar esta visão executiva quando `Status`, `Owner`, `Prioridade` ou `Ciclo ativo` mudarem.

## Histórico de migração

- Issue histórica de governança do painel anterior: Issue histórica #3.
- Issues históricas de `ciclo:repositorio` já foram migradas para arquivos por responsabilidade e encerradas; o status ativo continua apenas em `docs/project/`.

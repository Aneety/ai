# Planejamento de ciclos e registro operacional para implementação no monorepo — Aneety Platform

## Objetivo

Este documento transforma requisitos, processos, modelagens de banco e regras de repositórios da Aneety Platform em um backlog operacional de ciclos. Ele orienta a criação de responsabilidades e módulos internos no monorepo, além de estruturas de dados, BFFs, jobs, microfrontends, validações e fechamento de evidências sem substituir os documentos normativos. O painel operacional ativo deste backlog vive em `docs/project/`, e issue histórica só entra quando uma thread própria for realmente necessária.

## Fontes normativas

A implementação deve obedecer à seguinte precedência documental:

1. [`01-arquitetura.md`](01-arquitetura.md) — arquitetura, runtime, limites de fornecedor, segredos, dados e módulos internos.
2. [`02-requisitos.md`](02-requisitos.md) — requisitos de produto, requisitos técnicos, aceite e integrações opcionais.
3. [`03-processos.md`](03-processos.md) — fluxo de execução, operação, migração e gates.
4. [`04-modelagem-banco.md`](04-modelagem-banco.md) — tabelas conceituais, isolamento, índices e regras de acesso.
5. [`05-estrutura-repositorios.md`](05-estrutura-repositorios.md) — org, clones centrais, monorepo, prefixos e responsabilidades.
6. [`06-ciclos-cobertura.md`](06-ciclos-cobertura.md) — ordem de ciclos, sequência CRUD e gates de cobertura.
7. [`07-governanca-github.md`](07-governanca-github.md) — issues, labels, painel Markdown, Definition of Done e bloqueios.

Regra de execução: issue, arquivo em `docs/project`, PR ou automação não muda contrato. Mudança de contrato começa por PR documental nos arquivos acima.

## Proteção de checkouts locais

Antes de comparar, editar ou usar qualquer repo local da org `Aneety` como evidência operacional:

- registrar `git status --short`;
- identificar branch atual, SHA atual e remoto `origin`;
- executar `git fetch --all --prune`;
- pular edição se houver mudança local humana não pertencente ao ciclo.

Regra adicional para a fonte canônica: se o checkout de `Aneety/ai` estiver sujo, divergente ou com falha de atualização de `origin/main`, esse checkout não pode decidir status do backlog. Nessa situação, a leitura normativa e o painel operacional devem ser confirmados por `origin/main` ou por clone/worktree limpo antes de qualquer atualização em `docs/project`.

## Gates antes de criar responsabilidade ou módulo

Uma responsabilidade só pode virar módulo interno do monorepo quando registrar:

- contrato local e fonte documental;
- owner operacional;
- dados tratados e classificação de sensibilidade;
- segredos necessários, sem valores em Git, log, screenshot ou documentação de usuário;
- custo zero preservado;
- critérios de aceite verificáveis;
- testes previstos;
- plano de saída para fornecedor externo quando aplicável;
- caminho no monorepo `Aneety/ai` sob `aneety-platform/apps/<responsabilidade>/...`;
- repo destino `Aneety/ai` e caminho canônico interno da responsabilidade.

## Gate de proteção de checkout

Antes de comparar backlog, documentação, issue histórica ou implementação em qualquer repositório Aneety, a automação deve:

- executar `git status --short`, registrar branch atual, SHA atual e remotos;
- executar `git fetch --all --prune` antes de usar o checkout como base de decisão;
- preservar mudanças locais não criadas no ciclo atual; se o checkout estiver sujo, registrar bloqueio no arquivo correspondente de `docs/project` e pular edição naquele repositório;
- quando o checkout de `Aneety/ai` estiver sujo, ler a documentação canônica por `origin/main`, worktree limpo ou clone limpo equivalente; o checkout sujo não pode servir como fonte de verdade;
- tratar checkout limpo e branch derivada de `main` atualizado como pré-condição para editar `Aneety/ai`.

## Limite operacional para Codex e validação

`Aneety/ai` é o monorepo de geração, edição e versionamento de código fonte. Codex local ou Codex Cloud pode preparar fonte, contratos, Markdown, PRs e comandos, mas não deve usar execução local/cloud como evidência de aceite do MVP.

Para código fonte do MVP, compilação, lint, typecheck, build e testes de módulo devem passar primeiro em GitHub Actions na PR. Codex deve ler feedback de checks/logs da PR, corrigir e fazer novo push até o gate remoto ficar verde. Só depois disso entram Cloudflare dry-run, deploy, smoke, testes integrados de API ou e2e contra URL publicada.

A ordem mandatória é: PR -> GitHub Actions verdes -> Cloudflare -> smoke/API/e2e publicado. Se o caminho remoto não estiver disponível, o ciclo deve ficar bloqueado em `docs/project` com causa, impacto e próxima ação.

Servidor local persistente, container, Python de runtime MVP, Playwright/Cypress local, Wrangler local para aceite, VPS, banco externo obrigatório, simulação local ou runtime fora de Cloudflare Workers não fecham `deploy`, `publicacao`, `banco`, `jobs`, `backend`, `teste-integracao-api`, `smoke` ou `teste` do MVP.

## Ordem de ciclos usada neste planejamento

A ordem executável é:

1. `repositorio`
2. `deploy`
3. `publicacao`
4. `banco`
5. `jobs`
6. `backend`
7. `teste-integracao-api`
8. `microfrontend`
9. `smoke`
10. `teste`
11. `documentacao`
12. `governanca`

Observação normativa: `06-ciclos-cobertura.md`, `07-governanca-github.md` e este planejamento usam o mesmo ciclo `teste-integracao-api`. Em labels e filtros técnicos, usar `ciclo:teste-integracao-api`; em texto de negócio, usar **Testes de integração de API**.

## Padrão de issue

Toda issue derivada deste documento deve usar o corpo mínimo abaixo, preenchido com os dados da matriz de responsabilidade:

```markdown
## Fonte documental

- Documento:
- Seção:

## Ciclo e responsabilidade

- Ciclo:
- Responsabilidade:
- Repo destino:
- Owner:

## Critério de aceite

-

## Evidência esperada

-

## Riscos e bloqueios

-

## Links

-
```

Labels mínimas: um `tipo:*`, um `ciclo:*` e um `status:*`. Para abertura manual, usar `.github/ISSUE_TEMPLATE/backlog-operacional.yml` como base quando uma issue histórica for realmente necessária.

## Matriz por modelagem de banco

| Responsabilidade | Tabelas cobertas | Responsabilidade raiz | Caminho no monorepo | Ciclos obrigatórios | Aceite e evidência base |
| --- | --- | --- | --- | --- | --- |
| `tenant-white-label` | `tenants`, `tenant_branding` | `tenant-white-label` | `aneety-platform/apps/tenant-white-label/db-tenant-white-label`, `worker-tenant-white-label`, `mfe-tenant-white-label` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Tenant e marca versionados, isolados por tenant, com controles internos de isolamento, contrato BFF e tela administrativa sem vazamento técnico. Evidência: migration/DDL ou contrato de storage, teste de dados, contrato API, smoke visual e docs. |
| `identidade-acesso` | `app_identities`, `auth_credentials`, `auth_sessions`, `app_users`, `access_profiles`, `permissions`, `access_profile_permissions` | `identidade-acesso` | `aneety-platform/apps/identidade-acesso/db-identidade-acesso`, `worker-identidade-acesso`, `mfe-identidade-acesso` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Identidade própria, sessão, perfil e permissões sem acesso direto do frontend ao banco. Evidência: hash de credenciais, expiração/revogação, regras de acesso, contrato de sessão e testes negativos. |
| `onboarding-acesso` | `access_invitations`, `onboarding_progress`, `contact_verification_requests`, `access_recovery_requests`, `access_lifecycle_events` | `onboarding-acesso` | `aneety-platform/apps/onboarding-acesso/db-onboarding-acesso`, `worker-onboarding-acesso`, `mfe-onboarding-acesso` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Convites, primeiro acesso, confirmação, recuperação e lifecycle com tokens em hash, expiração, auditoria e isolamento por tenant. Evidência: migrations/DDL ou contrato de storage, testes de convite/recuperação, API integrada e smoke de onboarding. |
| `identidade-federada` | `federated_identity_settings`, `external_identity_links`, `federated_login_attempts` | `identidade-federada` | `aneety-platform/apps/identidade-federada/db-identidade`, `worker-identidade`, `int-google-sso` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `smoke`, `teste`, `documentacao`, `governanca` | Vínculo externo opcional com modo desligado, sessão final sempre Aneety e degradação controlada. Evidência: settings sem segredo, testes de vínculo, tentativa recusada e smoke sem Google SSO. |
| `pedidos-customizados` | `orders`, `order_checkpoints` | `pedidos-customizados` | `aneety-platform/apps/pedidos-customizados/db-pedidos-customizados`, `worker-pedidos-customizados`, `mfe-pedidos-customizados` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Pedido customizado e checkpoints com histórico por versão, exclusão lógica e CRUD incremental. Evidência: migration/DDL ou contrato de storage, testes CRUD, contrato HTTP, smoke de criação/listagem/edição e documentação. |
| `qualidade-evidencias` | `quality_reviews`, `attachments` | `qualidade-evidencias` | `aneety-platform/apps/qualidade-evidencias/db-qualidade-evidencias`, `worker-qualidade-evidencias`, `mfe-qualidade-evidencias` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Revisão de qualidade e metadados de evidências com permissão por tenant, pedido e etapa. Evidência: controles de isolamento, validação de metadados, bloqueio de avanço sem evidência e smoke de anexação controlada. |
| `pagamentos` | `payment_intents` | `pagamentos` | `aneety-platform/apps/pagamentos/db-pagamentos`, `worker-pagamentos`, `mfe-pagamentos`, `int-pagamentos` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Intenção e conciliação de pagamento sem corromper pedido quando adapter externo falhar. Evidência: testes de indisponibilidade, status financeiro e contrato substituível. |
| `offline-sync` | `sync_events`, `offline_conflicts` | `offline-sync` | `aneety-platform/apps/offline-sync/db-offline-sync`, `worker-offline-sync`, `job-offline-sync`, `mfe-offline-sync` | `repositorio`, `deploy`, `publicacao`, `banco`, `jobs`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Fila local, replay e conflitos auditáveis por tenant. Evidência: migration/DDL ou contrato de storage, job idempotente, testes de replay, API integrada e tela de resolução quando aplicável. |
| `marketplace-operacional` | `marketplace_actors`, `marketplace_favorites` | `marketplace-operacional` | `aneety-platform/apps/marketplace-operacional/db-marketplace-operacional`, `worker-marketplace-operacional`, `mfe-marketplace-operacional` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Atores e favoritos filtráveis por tenant, tipo, status e disponibilidade. Evidência: índices, regras de acesso, contrato de listagem paginada e smoke de favoritar. |
| `producao-execucao` | `production_demands` | `producao-execucao` | `aneety-platform/apps/producao-execucao/db-producao-execucao`, `worker-producao-execucao`, `mfe-producao-execucao` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Demanda de produção com aceite, rejeição, responsável e motivo. Evidência: CRUD, transição de status, auditoria mínima e smoke de aceite/rejeição. |
| `logistica-rastreabilidade` | `delivery_demands`, `delivery_evidences`, `tracking_events`, `map_snapshots` | `logistica-rastreabilidade` | `aneety-platform/apps/logistica-rastreabilidade/db-logistica-rastreabilidade`, `worker-logistica-rastreabilidade`, `mfe-logistica-rastreabilidade`, `int-mapas` | `repositorio`, `deploy`, `publicacao`, `banco`, `jobs`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Coleta, entrega, evidências, eventos e mapas por contrato substituível. Evidência: events/snapshots, visibilidade por perfil, job de snapshot quando existir, smoke de rastreabilidade. |
| `auditoria-operacional` | `audit_events`, `audit_event_changes` | `auditoria-operacional` | `aneety-platform/apps/auditoria-operacional/db-auditoria-operacional`, `worker-auditoria-operacional`, `mfe-auditoria-operacional` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Eventos sensíveis e valores antes/depois, sem leitura cross-tenant. Evidência: trilha de alteração, testes de visibilidade e consulta administrativa. |
| `catalogo-operacional` | `catalogs`, `catalog_items`, `catalog_item_options` | `catalogo-operacional` | `aneety-platform/apps/catalogo-operacional/db-catalogo-operacional`, `worker-catalogo-operacional`, `mfe-catalogo-operacional` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Catálogo por tenant com itens, atributos, preço-base, prazo-base e opções. Evidência: constraints, índices, contrato CRUD e smoke de configuração. |
| `workflow-estados` | `workflow_states`, `workflow_state_transitions` | `workflow-estados` | `aneety-platform/apps/workflow-estados/db-workflow-estados`, `worker-workflow-estados`, `mfe-workflow-estados` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Estados e transições oficiais com permissão e motivo obrigatório. Evidência: matriz de transição, testes de bloqueio e contrato de validação. |
| `sla-capacidade` | `sla_policies`, `operational_schedules`, `actor_capacity_slots` | `sla-capacidade` | `aneety-platform/apps/sla-capacidade/db-sla-capacidade`, `worker-sla-capacidade`, `job-sla-capacidade`, `mfe-sla-capacidade` | `repositorio`, `deploy`, `publicacao`, `banco`, `jobs`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | SLA, agenda e capacidade por ator, data e status. Evidência: índices de agenda, job de alerta quando existir, API integrada e smoke de disponibilidade. |
| `orcamentos-precificacao` | `budget_requests`, `budget_items` | `orcamentos-precificacao` | `aneety-platform/apps/orcamentos-precificacao/db-orcamentos-precificacao`, `worker-orcamentos-precificacao`, `mfe-orcamentos-precificacao` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Orçamentos, linhas de preço, aprovação, rejeição e expiração. Evidência: cálculo registrado, status auditável, contrato API e smoke de aprovação. |
| `comunicacao-operacional` | `operational_messages`, `notifications` | `comunicacao-operacional` | `aneety-platform/apps/comunicacao-operacional/db-comunicacao-operacional`, `worker-comunicacao-operacional`, `job-comunicacao-operacional`, `mfe-comunicacao-operacional` | `repositorio`, `deploy`, `publicacao`, `banco`, `jobs`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Mensagens, avisos e notificações por tenant, entidade, status e visibilidade. Evidência: fan-out controlado, leitura, status e smoke de notificação in-app. |
| `comunicacao-email` | `email_integration_settings`, `email_records`, `email_delivery_attempts` | `comunicacao-email` | `aneety-platform/apps/comunicacao-email/db-email`, `worker-email`, `int-gmail` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `smoke`, `teste`, `documentacao`, `governanca` | E-mail opcional por adapter, com metadados e auditoria fora do Gmail, modo desligado e degradação controlada. Evidência: settings sem segredo, registros/tentativas, falha de provider e smoke sem Gmail. |
| `suporte-excecoes` | `support_cases`, `exception_cases` | `suporte-excecoes` | `aneety-platform/apps/suporte-excecoes/db-suporte-excecoes`, `worker-suporte-excecoes`, `mfe-suporte-excecoes` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Chamados e exceções operacionais com categoria, prioridade, impacto e resolução. Evidência: CRUD, status, auditoria e smoke de abertura/fechamento. |
| `privacidade-consentimento` | `consent_records` | `privacidade-consentimento` | `aneety-platform/apps/privacidade-consentimento/db-privacidade-consentimento`, `worker-privacidade-consentimento`, `mfe-privacidade-consentimento` | `repositorio`, `deploy`, `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke`, `teste`, `documentacao`, `governanca` | Consentimentos concedidos/revogados por identidade, tenant, tipo e origem. Evidência: registro de revogação, bloqueio de uso indevido e consulta por permissão. |
| `demo-seeds` | `demo_seed_cases` | `demo-seeds` | `aneety-platform/apps/demo-seeds/db-demo-seeds`, `job-demo-seeds`, `worker-demo-seeds` | `repositorio`, `deploy`, `publicacao`, `banco`, `jobs`, `backend`, `teste-integracao-api`, `smoke`, `teste`, `documentacao`, `governanca` | Seeds e massas de teste sem transformar a vertical odontológica em limite de produto. Evidência: payloads sanitizados, job idempotente e testes de carga controlada. |

## Responsabilidades transversais sem modelagem própria

Algumas responsabilidades do MVP não nascem de uma tabela própria em `04-modelagem-banco.md`, mas continuam mandatórias por contrato arquitetural e de runtime. Elas devem entrar no backlog com a mesma disciplina de owner, custo zero, aceite, deploy, publicação, teste e governança.

| Responsabilidade | Origem normativa | Responsabilidade raiz | Caminho no monorepo | Ciclos obrigatórios | Aceite e evidência base |
| --- | --- | --- | --- | --- | --- |
| `gateway-borda` | `01-arquitetura.md` (`## Runtime alvo do MVP`, `## Fluxo de dados`), `05-estrutura-repositorios.md` (`## Regras de runtime e evolução`, `## Responsabilidades funcionais v1 candidatas`) | `gateway-borda` | `aneety-platform/apps/gateway-borda/worker-gateway`, `pkg-contratos-publicos` | `repositorio`, `deploy`, `publicacao`, `backend`, `teste-integracao-api`, `smoke`, `teste`, `documentacao`, `governanca` | `worker-gateway` valida borda, CORS, versão de contrato, sessão pública Aneety e roteamento/service bindings para BFFs `worker-*`, sem segredo no frontend e sem runtime fora de Workers. Evidência: contrato HTTP, smoke de borda, teste de roteamento e docs atualizadas. |

## Backlog por responsabilidade

Os blocos abaixo são prontos para registro no painel `docs/project` e, quando necessário, para abertura de issues históricas no GitHub. Quando houver issue, ela deve usar o template de corpo obrigatório deste documento e labels coerentes com `07-governanca-github.md`.

### `gateway-borda`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][gateway-borda] preparar contrato, owner e estrutura monorepo` | Responsabilidade transversal do `worker-gateway` registrada com owner, custo zero, contrato de borda e caminho `aneety-platform/apps/gateway-borda/...`. | PR documental e, quando necessário, issue histórica com links normativos. | Gateway obrigatório ficar sem backlog próprio e atrasar todos os BFFs. |
| `deploy` | `[deploy][gateway-borda] preparar runtime de custo zero` | Deploy do `worker-gateway` documentado em runtime 100% Workers, sem segredo versionado. | Configuração de deploy, bindings e checklist sem valores. | Segredo em Git/log ou runtime fora de Workers. |
| `publicacao` | `[publicacao][gateway-borda] publicar endpoint de borda permitido` | Endpoint público do gateway publicado sem depender de GitHub Pages como runtime transacional. | URL publicada, roteamento básico e evidência de ambiente. | Publicação sem contrato de borda. |
| `backend` | `[backend][gateway-borda] publicar contrato do worker-gateway` | Gateway valida CORS, sessão pública Aneety, versão de contrato e roteamento/service bindings para `worker-*`. | Contrato HTTP, testes 401/403/CORS e diff do worker. | Bypass de autorização, roteamento público entre Workers ou vazamento de segredo. |
| `teste-integracao-api` | `[teste-integracao-api][gateway-borda] validar gateway integrado aos BFFs do ciclo` | Integração valida borda real do ciclo, erros de contrato e encaminhamento para BFF Worker. | Run integrado com casos positivos e negativos. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `smoke` | `[smoke][gateway-borda] validar fluxo crítico publicado da borda` | Smoke confirma endpoint ativo, rota crítica e headers obrigatórios sem vazar detalhe técnico ao usuário final. | Log, screenshot técnica ou artefato verificável. | Smoke só de 200 sem validar borda. |
| `teste` | `[teste][gateway-borda] consolidar cobertura da borda` | Cobertura unitária, contrato, integração e regressão do gateway consolidada. | Saída de testes com falhas zero. | Regressão em CORS, sessão ou roteamento. |
| `documentacao` | `[documentacao][gateway-borda] sincronizar docs e evidências` | Arquitetura, estrutura de repositórios, contratos de borda e evidências refletem `worker-gateway`. | PR documental com links de evidência. | Docs continuarem sem backlog do gateway. |
| `governanca` | `[governanca][gateway-borda] fechar ciclo com aceite e docs/project` | Issue tem aceite final, evidências e status coerentes no arquivo correspondente em `docs/project`. | Links de PR, testes, smoke e arquivo em `docs/project`. | Fechamento sem prova de borda publicada. |

### `tenant-white-label`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][tenant-white-label] preparar contrato, owner e estrutura monorepo` | Contrato, owner, dados, custo zero, responsabilidade raiz e caminho `aneety-platform/apps/tenant-white-label/...` registrados. | PR documental e estrutura monorepo planejada ou criada conforme gate. | Marca, dados de tenant, lock-in de DNS/CDN. |
| `banco` | `[banco][tenant-white-label] implementar estrutura de dados, constraints, índices, isolamento e seeds` | `tenants` e `tenant_branding` com UUID, datas, exclusão lógica, índices e controles de isolamento. | Migration, rollback, teste de dados e seed de tenant Lia como marca inicial. | Cross-tenant e configuração visual sensível. |
| `backend` | `[backend][tenant-white-label] publicar contrato do BFF/worker` | API controla tenants e branding por permissão, sem segredo em frontend. | Contrato HTTP, testes de autorização e erro de domínio. | Exposição de dados administrativos. |
| `teste-integracao-api` | `[teste-integracao-api][tenant-white-label] validar API integrada à camada de dados real do ciclo` | API e banco validam isolamento e CRUD coberto. | Run de integração com camada de dados real do ciclo. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][tenant-white-label] entregar fluxo visual quando houver UI` | Administração de marca usa linguagem de produto, sem termos de runtime. | Screenshot ou smoke visual com estados de vazio, erro e sucesso. | Vazamento técnico em UI final. |
| `documentacao` | `[documentacao][tenant-white-label] sincronizar docs e evidências` | Arquitetura, requisitos e docs da responsabilidade atualizados. | PR documental com links de evidência. | Duplicação fora de `Aneety/ai`. |
| `governanca` | `[governanca][tenant-white-label] fechar ciclo com aceite e docs/project` | Issue tem aceite, evidência final e `docs/project` atualizado. | Link do arquivo em `docs/project`, PRs e checks. | Fechamento sem evidência. |

### `identidade-acesso`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][identidade-acesso] preparar contrato, owner e estrutura monorepo` | Responsabilidade de identidade própria, sessão, perfil e permissão registrada. | PR documental e caminho `aneety-platform/apps/identidade-acesso/...`. | Segredos, dados pessoais, lock-in de identidade externa. |
| `banco` | `[banco][identidade-acesso] implementar estrutura de dados, constraints, índices, isolamento e seeds` | Identidades, credenciais, sessões, usuários, perfis e permissões com hash forte, expiração e controles de isolamento. | Migration, rollback, testes de hash, revogação e isolamento. | Credencial em texto, sessão sem expiração. |
| `backend` | `[backend][identidade-acesso] publicar contrato do BFF/worker` | Sessão própria emitida por validação interna de tenant, perfil e status. | Contrato HTTP, testes de login, refresh, revogação e acesso negado. | Frontend acessar banco ou IdP diretamente. |
| `teste-integracao-api` | `[teste-integracao-api][identidade-acesso] validar API integrada à camada de dados real do ciclo` | Fluxo real valida criação, autenticação, perfil e bloqueio. | Run de integração com casos positivos e negativos. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][identidade-acesso] entregar fluxo visual quando houver UI` | Telas de acesso e gestão usam linguagem de usuário e permissões claras. | Smoke visual de entrada, bloqueio e recuperação. | Termos técnicos de provedor ou token em UI. |
| `documentacao` | `[documentacao][identidade-acesso] sincronizar docs e evidências` | Docs registram sessão própria e integração externa opcional. | PR documental e evidências de segurança. | SSO externo virar requisito obrigatório. |
| `governanca` | `[governanca][identidade-acesso] fechar ciclo com aceite e docs/project` | Issue histórica fechada com evidência verificável e `docs/project` atualizado. | `docs/project` atualizado e links finais. | Evidência de segurança ausente. |

### `onboarding-acesso`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][onboarding-acesso] preparar contrato, owner e estrutura monorepo` | Contrato de convite, primeiro acesso, recuperação, bloqueio e reativação registrado. | PR documental e caminho `aneety-platform/apps/onboarding-acesso/...`. | Dados pessoais, convite indevido, token exposto. |
| `deploy` | `[deploy][onboarding-acesso] preparar runtime de custo zero` | Runtime de worker e microfrontend sem segredo versionado e com rollback documentado. | Log de deploy ou dry-run e checklist de segredo sem valores. | Secret ausente, custo externo, rollback inexistente. |
| `publicacao` | `[publicacao][onboarding-acesso] publicar artefato ou URL permitida` | URL ou artefato permitido para fluxo de primeiro acesso, sem GitHub Pages como runtime transacional. | Link publicado ou artefato com origem rastreável. | Publicação em runtime proibido. |
| `banco` | `[banco][onboarding-acesso] implementar estrutura de dados, constraints, índices, isolamento e seeds` | Convites, onboarding, confirmação, recuperação e lifecycle com hash, expiração, status e controles de isolamento. | Migration, rollback e testes de convite/recuperação/lifecycle. | Token em texto, leitura cross-tenant, convite expirado aceito. |
| `backend` | `[backend][onboarding-acesso] publicar contrato do BFF/worker` | API convida, aceita, confirma contato, recupera acesso, bloqueia e reativa por gateway/contrato público. | Contrato HTTP, 401/403, testes de expiração e permissão. | Bypass de perfil, mutação sem auditoria. |
| `teste-integracao-api` | `[teste-integracao-api][onboarding-acesso] validar API integrada à camada de dados real do ciclo` | Integração valida convite feliz, convite expirado, recuperação e bloqueio. | Run integrado com casos positivos e negativos. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][onboarding-acesso] entregar fluxo visual quando houver UI` | UI orienta primeiro acesso, confirmação e recuperação sem termos técnicos. | Smoke visual com estados de carregando, vazio, erro e sucesso. | UI expor token, provedor, banco ou runtime. |
| `smoke` | `[smoke][onboarding-acesso] validar fluxo crítico publicado` | Convite até primeiro acesso executa no ambiente publicado permitido. | Log, screenshot ou vídeo curto com dados controlados. | Dado real ou segredo em evidência. |
| `teste` | `[teste][onboarding-acesso] consolidar cobertura de onboarding` | Cobertura unitária, contrato, integração e regressão para convites e recuperação. | Saída de testes com falhas zero. | Lacuna em expiração ou bloqueio. |
| `documentacao` | `[documentacao][onboarding-acesso] sincronizar docs e evidências` | Requisitos, processos, modelagem e evidências atualizados. | PR documental com links de evidência. | Divergência entre fluxo e modelo. |
| `governanca` | `[governanca][onboarding-acesso] fechar ciclo com aceite e docs/project` | Issue tem owner, aceite, evidência final e `docs/project` atualizado. | Links finais de PR, testes e smoke. | Fechamento sem evidência. |

### `identidade-federada`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][identidade-federada] preparar contrato, owner e estrutura monorepo` | Responsabilidade opcional de vínculo externo registrada, separada de `identidade-acesso`. | PR documental e caminho `aneety-platform/apps/identidade-federada/...`. | Google SSO virar requisito de login. |
| `deploy` | `[deploy][identidade-federada] preparar runtime de custo zero` | Worker e adapter opcionais sem segredo versionado e com modo desligado. | Log de deploy ou dry-run e checklist de segredo sem valores. | Custo externo, segredo no ambiente errado. |
| `publicacao` | `[publicacao][identidade-federada] publicar artefato ou URL permitida` | Publicação permite validar integração opcional sem tornar provedor obrigatório. | Link ou artefato publicado e modo desligado documentado. | Dependência de fornecedor no aceite. |
| `banco` | `[banco][identidade-federada] implementar estrutura de dados, constraints, índices, isolamento e seeds` | Settings, vínculos e tentativas guardam adapter, subject hash, status e auditoria sem segredo. | Migration, rollback e testes de isolamento/vínculo/tentativa. | Subject externo em texto, segredo em banco. |
| `backend` | `[backend][identidade-federada] publicar contrato do BFF/worker` | API valida vínculo externo permitido e emite somente sessão própria Aneety via gateway/contrato público. | Contrato HTTP, testes de modo desligado, recusa e falha de provider. | Sessão final emitida pelo provedor externo. |
| `teste-integracao-api` | `[teste-integracao-api][identidade-federada] validar API integrada à camada de dados real do ciclo` | Integração valida modo desligado, vínculo válido, vínculo recusado e fornecedor indisponível. | Run integrado com casos positivos e negativos. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `smoke` | `[smoke][identidade-federada] validar fluxo crítico publicado` | Login próprio segue funcionando sem Google SSO e tentativa federada degrada corretamente. | Evidência de smoke sem imprimir token externo. | Exposição de token ou claim. |
| `teste` | `[teste][identidade-federada] consolidar cobertura de integração opcional` | Cobertura unitária, contrato, integração e regressão para modo desligado/degradação. | Saída de testes com falhas zero. | Falta de teste de modo desligado. |
| `documentacao` | `[documentacao][identidade-federada] sincronizar docs e evidências` | Docs deixam claro que Google SSO é adapter opcional e sessão final é Aneety. | PR documental e evidência de degradação. | Linguagem transformar SSO em requisito. |
| `governanca` | `[governanca][identidade-federada] fechar ciclo com aceite e docs/project` | Issue tem aceite, evidência final e `docs/project` atualizado. | Links finais de PR, testes e smoke. | Fechamento sem teste de modo desligado. |

### `pedidos-customizados`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][pedidos-customizados] preparar contrato, owner e estrutura monorepo` | Contrato de pedidos e checkpoints criado com owner e responsabilidade raiz. | PR documental e caminho `aneety-platform/apps/pedidos-customizados/...`. | Acoplar pedido à vertical odontológica. |
| `banco` | `[banco][pedidos-customizados] implementar estrutura de dados, constraints, índices, isolamento e seeds` | `orders` e `order_checkpoints` versionados, sem exclusão física, com CRUD incremental. | Migration, rollback, testes CRUD e seed demo sanitizado. | Perda de histórico operacional. |
| `backend` | `[backend][pedidos-customizados] publicar contrato do BFF/worker` | API cobre incluir, pesquisar por id, pesquisar por filtros, atualizar e excluir logicamente. | Contrato HTTP, testes de paginação e auditoria mínima. | Mutação sem nova versão. |
| `teste-integracao-api` | `[teste-integracao-api][pedidos-customizados] validar API integrada à camada de dados real do ciclo` | API + camada de dados validam sequência CRUD obrigatória até etapa declarada. | Run de integração com tenant isolado. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][pedidos-customizados] entregar fluxo visual quando houver UI` | Fluxo visual cria, lista, edita e acompanha pedido. | Smoke visual e screenshot sem termos técnicos. | UI sugerir banco, worker ou fornecedor. |
| `documentacao` | `[documentacao][pedidos-customizados] sincronizar docs e evidências` | Requisitos, processos e evidências alinhados ao fluxo central. | PR documental com evidência de CRUD. | Docs duplicadas no monorepo de implementação. |
| `governanca` | `[governanca][pedidos-customizados] fechar ciclo com aceite e docs/project` | `docs/project` e issue histórica refletem status final e evidência. | Links de PR, testes e smoke. | Fechar antes de smoke. |

### `qualidade-evidencias`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][qualidade-evidencias] preparar contrato, owner e estrutura monorepo` | Contrato de qualidade e evidências separado do pedido, com owner. | PR documental e caminho `aneety-platform/apps/qualidade-evidencias/...`. | Anexo expor dado sensível. |
| `banco` | `[banco][qualidade-evidencias] implementar estrutura de dados, constraints, índices, isolamento e seeds` | `quality_reviews` e `attachments` guardam metadados, status, vínculo e permissão. | Migration, rollback, testes de isolamento e metadados. | Bytes sem lifecycle ou metadado sem autorização. |
| `backend` | `[backend][qualidade-evidencias] publicar contrato do BFF/worker` | API valida evidência obrigatória e bloqueia avanço indevido. | Contrato HTTP e testes de rejeição/aprovação. | Expor storage interno na UI. |
| `teste-integracao-api` | `[teste-integracao-api][qualidade-evidencias] validar API integrada à camada de dados real do ciclo` | Camada de dados e API validam revisão, anexo e permissão. | Run integrado com caso aprovado e reprovado. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][qualidade-evidencias] entregar fluxo visual quando houver UI` | Tela mostra pendência, aprovação e correção em linguagem operacional. | Smoke visual com estados de evidência ausente e aceita. | Termos técnicos de armazenamento. |
| `documentacao` | `[documentacao][qualidade-evidencias] sincronizar docs e evidências` | Docs indicam metadados no banco e bytes por adapter. | PR documental. | Misturar regra de domínio com fornecedor. |
| `governanca` | `[governanca][qualidade-evidencias] fechar ciclo com aceite e docs/project` | Evidência final linkada antes do fechamento. | `docs/project` atualizado. | Aprovação sem trilha. |

### `pagamentos`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][pagamentos] preparar contrato, owner e estrutura monorepo` | Responsabilidade de pagamento e adapter substituível registrada. | PR documental e caminho `aneety-platform/apps/pagamentos/...`. | Dependência paga obrigatória. |
| `banco` | `[banco][pagamentos] implementar estrutura de dados, constraints, índices, isolamento e seeds` | `payment_intents` persiste valor, moeda, status e referência externa sem corromper pedido. | Migration, rollback e testes de status. | Provider virar fonte de verdade. |
| `backend` | `[backend][pagamentos] publicar contrato do BFF/worker` | API cria, consulta e concilia intenção com degradação controlada. | Contrato HTTP e testes de indisponibilidade. | Vazamento de chave ou checkout interno. |
| `teste-integracao-api` | `[teste-integracao-api][pagamentos] validar API integrada à camada de dados real do ciclo` | API + camada de dados mantêm pedido íntegro mesmo com adapter indisponível. | Run integrado com falha simulada. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][pagamentos] entregar fluxo visual quando houver UI` | UI mostra status financeiro sem citar fornecedor técnico. | Smoke visual de pendência e conciliação. | Lock-in em texto de produto. |
| `documentacao` | `[documentacao][pagamentos] sincronizar docs e evidências` | Docs registram função semântica e plano de saída. | PR documental. | Custo externo sem decisão formal. |
| `governanca` | `[governanca][pagamentos] fechar ciclo com aceite e docs/project` | Fechamento com evidência de custo zero ou bloqueio formal. | `docs/project` atualizado. | Fechar com custo não resolvido. |

### `offline-sync`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][offline-sync] preparar contrato, owner e estrutura monorepo` | Contrato de fila, replay e conflito registrado. | PR documental e caminho `aneety-platform/apps/offline-sync/...`. | Conflito perder dado operacional. |
| `banco` | `[banco][offline-sync] implementar estrutura de dados, constraints, índices, isolamento e seeds` | `sync_events` e `offline_conflicts` têm payloads, status, conflito e resolução. | Migration, rollback e testes de isolamento. | Payload com dado sensível em log. |
| `jobs` | `[jobs][offline-sync] implementar replay idempotente e reprocessamento` | Job reprocessa eventos por tenant sem duplicar efeito. | Run de job com replay repetido e log operacional. | Reprocessamento destrutivo. |
| `backend` | `[backend][offline-sync] publicar contrato do BFF/worker` | API recebe eventos, expõe status e permite resolução de conflito. | Contrato HTTP e testes de idempotência. | Aceitar evento cross-tenant. |
| `teste-integracao-api` | `[teste-integracao-api][offline-sync] validar API integrada à camada de dados real do ciclo` | Integração valida evento, replay e conflito. | Run integrado com conflito controlado. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][offline-sync] entregar fluxo visual quando houver UI` | Tela de conflito orienta decisão humana sem jargão técnico. | Smoke visual de conflito e resolução. | UI expor payload bruto sensível. |
| `documentacao` | `[documentacao][offline-sync] sincronizar docs e evidências` | Docs registram retry, replay e política de conflito. | PR documental. | Falta de critério de reprocessamento. |
| `governanca` | `[governanca][offline-sync] fechar ciclo com aceite e docs/project` | Evidência de idempotência anexada. | `docs/project` atualizado. | Fechar sem replay verificado. |

### `marketplace-operacional`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][marketplace-operacional] preparar contrato, owner e estrutura monorepo` | Contrato de atores e favoritos registrado. | PR documental e caminho `aneety-platform/apps/marketplace-operacional/...`. | Exposição de contato indevida. |
| `banco` | `[banco][marketplace-operacional] implementar estrutura de dados, constraints, índices, isolamento e seeds` | `marketplace_actors` e `marketplace_favorites` filtram por tenant, tipo e status. | Migration, rollback, testes de filtro e favorito. | Listagem cross-tenant. |
| `backend` | `[backend][marketplace-operacional] publicar contrato do BFF/worker` | API lista, filtra, favorita e aciona ator conforme permissão. | Contrato HTTP e testes paginados. | Dados de localização sensíveis. |
| `teste-integracao-api` | `[teste-integracao-api][marketplace-operacional] validar API integrada à camada de dados real do ciclo` | Integração valida filtro, ordenação e favorito. | Run integrado com múltiplos atores. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][marketplace-operacional] entregar fluxo visual quando houver UI` | UI mostra atores por disponibilidade e favoritos. | Smoke visual de filtro e favorito. | UI sugerir pontuação não auditada. |
| `documentacao` | `[documentacao][marketplace-operacional] sincronizar docs e evidências` | Docs registram critérios de listagem e privacidade. | PR documental. | Critério implícito não documentado. |
| `governanca` | `[governanca][marketplace-operacional] fechar ciclo com aceite e docs/project` | Evidência final anexada. | `docs/project` atualizado. | Fechar sem teste de permissão. |

### `producao-execucao`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][producao-execucao] preparar contrato, owner e estrutura monorepo` | Contrato de demanda de produção registrado. | PR documental e caminho `aneety-platform/apps/producao-execucao/...`. | Misturar produção com pedido sem contrato. |
| `banco` | `[banco][producao-execucao] implementar estrutura de dados, constraints, índices, isolamento e seeds` | `production_demands` cobre aceite, rejeição, motivo e status. | Migration, rollback e testes de status. | Reatribuição sem trilha. |
| `backend` | `[backend][producao-execucao] publicar contrato do BFF/worker` | API envia demanda, aceita, rejeita e consulta por filtros. | Contrato HTTP e testes de transição. | Ator indevido aceitar demanda. |
| `teste-integracao-api` | `[teste-integracao-api][producao-execucao] validar API integrada à camada de dados real do ciclo` | Integração valida ciclo de demanda de produção. | Run integrado com aceite e rejeição. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][producao-execucao] entregar fluxo visual quando houver UI` | UI mostra demanda, responsável, notas e rejeição. | Smoke visual de aceite/rejeição. | Texto expor arquitetura. |
| `documentacao` | `[documentacao][producao-execucao] sincronizar docs e evidências` | Docs sincronizam processo de produção. | PR documental. | Processo divergente de requisitos. |
| `governanca` | `[governanca][producao-execucao] fechar ciclo com aceite e docs/project` | Issue fechada com evidência de transição. | `docs/project` atualizado. | Fechar sem teste negativo. |

### `logistica-rastreabilidade`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][logistica-rastreabilidade] preparar contrato, owner e estrutura monorepo` | Contrato de coleta, entrega, eventos, mapas e adapter substituível registrado. | PR documental e caminho `aneety-platform/apps/logistica-rastreabilidade/...`. | Localização sensível e lock-in de mapa. |
| `banco` | `[banco][logistica-rastreabilidade] implementar estrutura de dados, constraints, índices, isolamento e seeds` | Demandas, evidências, eventos e snapshots têm tenant, pedido, status e visibilidade. | Migration, rollback, testes de isolamento e índices. | Expor localização fora do escopo. |
| `jobs` | `[jobs][logistica-rastreabilidade] implementar snapshots e rotinas idempotentes` | Job calcula snapshots sem duplicar eventos. | Run de job com reexecução segura. | Snapshot incorreto virar fonte de verdade. |
| `backend` | `[backend][logistica-rastreabilidade] publicar contrato do BFF/worker` | API cria demanda, registra check-in/out, eventos e consulta mapa. | Contrato HTTP e testes de visibilidade. | Dependência direta de fornecedor de mapa. |
| `teste-integracao-api` | `[teste-integracao-api][logistica-rastreabilidade] validar API integrada à camada de dados real do ciclo` | Integração valida coleta, entrega, evento e snapshot. | Run integrado com rota controlada. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][logistica-rastreabilidade] entregar fluxo visual quando houver UI` | UI exibe acompanhamento sem expor fornecedor ou dados indevidos. | Smoke visual de mapa e rastreabilidade. | UI mostrar precisão indevida. |
| `documentacao` | `[documentacao][logistica-rastreabilidade] sincronizar docs e evidências` | Docs registram permissão, mapa e rastreabilidade. | PR documental. | Contrato de localização incompleto. |
| `governanca` | `[governanca][logistica-rastreabilidade] fechar ciclo com aceite e docs/project` | Evidência de permissão e smoke anexada. | `docs/project` atualizado. | Fechar sem teste de visibilidade. |

### `auditoria-operacional`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][auditoria-operacional] preparar contrato, owner e estrutura monorepo` | Contrato de auditoria sensível registrado. | PR documental e caminho `aneety-platform/apps/auditoria-operacional/...`. | Auditoria insuficiente para alteração sensível. |
| `banco` | `[banco][auditoria-operacional] implementar estrutura de dados, constraints, índices, isolamento e seeds` | `audit_events` e `audit_event_changes` guardam ação, entidade, ator e valores. | Migration, rollback e testes de before/after. | Registrar segredo em auditoria. |
| `backend` | `[backend][auditoria-operacional] publicar contrato do BFF/worker` | API consulta e registra eventos com permissão administrativa. | Contrato HTTP e testes de acesso negado. | Exposição cross-tenant. |
| `teste-integracao-api` | `[teste-integracao-api][auditoria-operacional] validar API integrada à camada de dados real do ciclo` | Integração valida registro e consulta controlada. | Run integrado com alteração sensível. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][auditoria-operacional] entregar fluxo visual quando houver UI` | UI mostra trilha sem valores secretos. | Smoke visual de consulta auditável. | Mostrar dado sensível em tela. |
| `documentacao` | `[documentacao][auditoria-operacional] sincronizar docs e evidências` | Docs indicam eventos obrigatórios e campos proibidos. | PR documental. | Lacuna de auditoria. |
| `governanca` | `[governanca][auditoria-operacional] fechar ciclo com aceite e docs/project` | Evidência final anexada. | `docs/project` atualizado. | Fechar sem teste negativo. |

### `catalogo-operacional`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][catalogo-operacional] preparar contrato, owner e estrutura monorepo` | Contrato de catálogo e personalização registrado. | PR documental e caminho `aneety-platform/apps/catalogo-operacional/...`. | Catálogo acoplar vertical única. |
| `banco` | `[banco][catalogo-operacional] implementar estrutura de dados, constraints, índices, isolamento e seeds` | Catálogos, itens e opções têm preço, prazo, status e tenant. | Migration, rollback e testes de opções. | Preço sem histórico. |
| `backend` | `[backend][catalogo-operacional] publicar contrato do BFF/worker` | API cobre CRUD e consulta paginada de catálogo. | Contrato HTTP e testes de filtro. | Item inválido gerar pedido inválido. |
| `teste-integracao-api` | `[teste-integracao-api][catalogo-operacional] validar API integrada à camada de dados real do ciclo` | Integração valida criação de catálogo e leitura de item. | Run integrado com opções obrigatórias. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][catalogo-operacional] entregar fluxo visual quando houver UI` | UI administra catálogo com linguagem de produto. | Smoke visual de item e opção. | Termos técnicos em configuração. |
| `documentacao` | `[documentacao][catalogo-operacional] sincronizar docs e evidências` | Docs registram catálogo por tenant e uso em pedidos. | PR documental. | Divergência entre catálogo e pedido. |
| `governanca` | `[governanca][catalogo-operacional] fechar ciclo com aceite e docs/project` | `docs/project` atualizado com evidência. | Links finais. | Fechar sem seed controlado. |

### `workflow-estados`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][workflow-estados] preparar contrato, owner e estrutura monorepo` | Contrato de estados e transições registrado. | PR documental e caminho `aneety-platform/apps/workflow-estados/...`. | Estados divergirem por módulo. |
| `banco` | `[banco][workflow-estados] implementar estrutura de dados, constraints, índices, isolamento e seeds` | Estados e transições têm entidade, origem, destino, permissão e motivo obrigatório. | Migration, rollback e testes de matriz. | Transição sem permissão. |
| `backend` | `[backend][workflow-estados] publicar contrato do BFF/worker` | API valida próxima transição permitida por perfil. | Contrato HTTP e testes de bloqueio. | Fluxo permitir salto indevido. |
| `teste-integracao-api` | `[teste-integracao-api][workflow-estados] validar API integrada à camada de dados real do ciclo` | Integração valida transição permitida e negada. | Run integrado com matriz oficial. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][workflow-estados] entregar fluxo visual quando houver UI` | UI orienta próxima ação e bloqueios em linguagem operacional. | Smoke visual de transição permitida/negada. | Mensagem revelar implementação. |
| `documentacao` | `[documentacao][workflow-estados] sincronizar docs e evidências` | Docs registram máquina de estados oficial. | PR documental. | Matriz não versionada. |
| `governanca` | `[governanca][workflow-estados] fechar ciclo com aceite e docs/project` | Evidência de matriz anexada. | `docs/project` atualizado. | Fechar sem bloqueios testados. |

### `sla-capacidade`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][sla-capacidade] preparar contrato, owner e estrutura monorepo` | Contrato de SLA, agenda e capacidade registrado. | PR documental e caminho `aneety-platform/apps/sla-capacidade/...`. | Promessa operacional sem capacidade real. |
| `banco` | `[banco][sla-capacidade] implementar estrutura de dados, constraints, índices, isolamento e seeds` | Políticas, agendas e slots têm tenant, ator, data, status e capacidade. | Migration, rollback e testes de disponibilidade. | Overbooking. |
| `jobs` | `[jobs][sla-capacidade] implementar alertas e rotinas idempotentes` | Job de alerta calcula prazos sem duplicar notificação. | Run de job com reexecução segura. | Alerta indevido ou ausente. |
| `backend` | `[backend][sla-capacidade] publicar contrato do BFF/worker` | API consulta capacidade e calcula promessa operacional. | Contrato HTTP e testes de agenda. | Cálculo fora do contrato. |
| `teste-integracao-api` | `[teste-integracao-api][sla-capacidade] validar API integrada à camada de dados real do ciclo` | Integração valida capacidade disponível e indisponível. | Run integrado com slots concorrentes. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][sla-capacidade] entregar fluxo visual quando houver UI` | UI mostra disponibilidade e alerta sem jargão técnico. | Smoke visual de agenda e capacidade. | UI prometer prazo não garantido. |
| `documentacao` | `[documentacao][sla-capacidade] sincronizar docs e evidências` | Docs registram regra de prazo e capacidade. | PR documental. | Regra implícita. |
| `governanca` | `[governanca][sla-capacidade] fechar ciclo com aceite e docs/project` | Evidência de alerta e capacidade anexada. | `docs/project` atualizado. | Fechar sem teste concorrente. |

### `orcamentos-precificacao`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][orcamentos-precificacao] preparar contrato, owner e estrutura monorepo` | Contrato de orçamento e preço registrado. | PR documental e caminho `aneety-platform/apps/orcamentos-precificacao/...`. | Valor financeiro sem auditoria. |
| `banco` | `[banco][orcamentos-precificacao] implementar estrutura de dados, constraints, índices, isolamento e seeds` | Orçamentos e itens têm valor, moeda, status, expiração e aprovação. | Migration, rollback e testes de linhas. | Cálculo sem explicação. |
| `backend` | `[backend][orcamentos-precificacao] publicar contrato do BFF/worker` | API cria, ajusta, aprova, rejeita e expira orçamento. | Contrato HTTP e testes de status. | Atualização sem versionamento. |
| `teste-integracao-api` | `[teste-integracao-api][orcamentos-precificacao] validar API integrada à camada de dados real do ciclo` | Integração valida aprovação e expiração. | Run integrado com orçamento vencido. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][orcamentos-precificacao] entregar fluxo visual quando houver UI` | UI apresenta orçamento, validade e decisão clara. | Smoke visual de aprovação/rejeição. | UI expor cálculo técnico. |
| `documentacao` | `[documentacao][orcamentos-precificacao] sincronizar docs e evidências` | Docs registram critérios de preço e aceite. | PR documental. | Custo externo obrigatório. |
| `governanca` | `[governanca][orcamentos-precificacao] fechar ciclo com aceite e docs/project` | Evidência financeira anexada. | `docs/project` atualizado. | Fechar sem teste de expiração. |

### `comunicacao-operacional`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][comunicacao-operacional] preparar contrato, owner e estrutura monorepo` | Contrato de mensagens e notificações registrado. | PR documental e caminho `aneety-platform/apps/comunicacao-operacional/...`. | Mensagem conter dado sensível. |
| `banco` | `[banco][comunicacao-operacional] implementar estrutura de dados, constraints, índices, isolamento e seeds` | Mensagens e notificações têm destinatário, entidade, status e visibilidade. | Migration, rollback e testes de leitura. | Notificação cross-tenant. |
| `jobs` | `[jobs][comunicacao-operacional] implementar distribuição e reprocessamento idempotente` | Job distribui notificações sem duplicar leitura. | Run de job com repetição segura. | Duplicidade de notificação. |
| `backend` | `[backend][comunicacao-operacional] publicar contrato do BFF/worker` | API cria, lista, marca leitura e registra aviso operacional. | Contrato HTTP e testes de status. | Exposição de mensagem privada. |
| `teste-integracao-api` | `[teste-integracao-api][comunicacao-operacional] validar API integrada à camada de dados real do ciclo` | Integração valida envio, leitura e permissão. | Run integrado com destinatários distintos. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][comunicacao-operacional] entregar fluxo visual quando houver UI` | UI mostra avisos e mensagens sem jargão técnico. | Smoke visual de caixa de avisos. | Texto final citar adapter externo. |
| `documentacao` | `[documentacao][comunicacao-operacional] sincronizar docs e evidências` | Docs registram escopo de comunicação e retenção. | PR documental. | Integração opcional virar requisito. |
| `governanca` | `[governanca][comunicacao-operacional] fechar ciclo com aceite e docs/project` | Evidência de permissão anexada. | `docs/project` atualizado. | Fechar sem teste de leitura. |

### `comunicacao-email`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][comunicacao-email] preparar contrato, owner e estrutura monorepo` | Responsabilidade opcional de e-mail registrada, separada de pedido, evidência, auditoria e autenticação. | PR documental e caminho `aneety-platform/apps/comunicacao-email/...`. | Gmail virar fonte única de domínio. |
| `deploy` | `[deploy][comunicacao-email] preparar runtime de custo zero` | Worker e adapter opcionais sem segredo versionado e com modo desligado por tenant. | Log de deploy ou dry-run e checklist de segredo sem valores. | Segredo de e-mail em Git, bundle ou log. |
| `publicacao` | `[publicacao][comunicacao-email] publicar artefato ou URL permitida` | Publicação permite validar e-mail opcional sem bloquear operação sem Gmail. | Link ou artefato publicado e modo desligado documentado. | Dependência do Gmail no aceite. |
| `banco` | `[banco][comunicacao-email] implementar estrutura de dados, constraints, índices, isolamento e seeds` | Settings, registros e tentativas guardam adapter, referência segura, status, entidade e auditoria fora do Gmail. | Migration, rollback e testes de isolamento/registros/tentativas. | Metadado sensível visível, segredo em banco. |
| `backend` | `[backend][comunicacao-email] publicar contrato do BFF/worker` | API envia ou registra e-mail por adapter, preserva operação sem Gmail e registra falhas controladas via gateway/contrato público. | Contrato HTTP, testes de modo desligado, limite e indisponibilidade. | Falha de provider corromper pedido. |
| `teste-integracao-api` | `[teste-integracao-api][comunicacao-email] validar API integrada à camada de dados real do ciclo` | Integração valida modo desligado, tentativa aceita, falha e limite. | Run integrado com casos positivos e negativos. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `smoke` | `[smoke][comunicacao-email] validar fluxo crítico publicado` | Operação segue criando e acompanhando pedido sem Gmail habilitado. | Evidência de smoke sem segredo ou conteúdo sensível. | Conteúdo de e-mail real em evidência. |
| `teste` | `[teste][comunicacao-email] consolidar cobertura de integração opcional` | Cobertura unitária, contrato, integração e regressão para modo desligado/degradação. | Saída de testes com falhas zero. | Falta de teste de falha de provider. |
| `documentacao` | `[documentacao][comunicacao-email] sincronizar docs e evidências` | Docs deixam claro que Gmail é adapter opcional e metadados/auditoria ficam na Aneety. | PR documental e evidência de degradação. | Linguagem transformar Gmail em requisito. |
| `governanca` | `[governanca][comunicacao-email] fechar ciclo com aceite e docs/project` | Issue tem aceite, evidência final e `docs/project` atualizado. | Links finais de PR, testes e smoke. | Fechamento sem modo desligado validado. |

### `suporte-excecoes`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][suporte-excecoes] preparar contrato, owner e estrutura monorepo` | Contrato de chamados e exceções registrado. | PR documental e caminho `aneety-platform/apps/suporte-excecoes/...`. | Exceção alterar pedido sem regra. |
| `banco` | `[banco][suporte-excecoes] implementar estrutura de dados, constraints, índices, isolamento e seeds` | Chamados e exceções têm categoria, prioridade, impacto, status e resolução. | Migration, rollback e testes de status. | Caso sensível visível a perfil errado. |
| `backend` | `[backend][suporte-excecoes] publicar contrato do BFF/worker` | API abre, atribui, atualiza e fecha caso com permissão. | Contrato HTTP e testes de resolução. | Fechamento sem motivo. |
| `teste-integracao-api` | `[teste-integracao-api][suporte-excecoes] validar API integrada à camada de dados real do ciclo` | Integração valida abertura, atribuição e fechamento. | Run integrado com suporte e exceção. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][suporte-excecoes] entregar fluxo visual quando houver UI` | UI orienta suporte, disputa e correção sem termos técnicos. | Smoke visual de abertura/fechamento. | Texto de impacto confuso ao usuário. |
| `documentacao` | `[documentacao][suporte-excecoes] sincronizar docs e evidências` | Docs registram categorias e impactos. | PR documental. | Fluxo de exceção sem aceite. |
| `governanca` | `[governanca][suporte-excecoes] fechar ciclo com aceite e docs/project` | Evidência de resolução anexada. | `docs/project` atualizado. | Fechar sem auditoria. |

### `privacidade-consentimento`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][privacidade-consentimento] preparar contrato, owner e estrutura monorepo` | Contrato de consentimento e privacidade registrado. | PR documental e caminho `aneety-platform/apps/privacidade-consentimento/...`. | Dado sensível sem consentimento. |
| `banco` | `[banco][privacidade-consentimento] implementar estrutura de dados, constraints, índices, isolamento e seeds` | `consent_records` cobre tipo, status, origem, concessão e revogação. | Migration, rollback e testes de revogação. | Consentimento sem trilha. |
| `backend` | `[backend][privacidade-consentimento] publicar contrato do BFF/worker` | API registra, consulta e revoga consentimento com permissão. | Contrato HTTP e testes de bloqueio. | Uso de localização sem consentimento. |
| `teste-integracao-api` | `[teste-integracao-api][privacidade-consentimento] validar API integrada à camada de dados real do ciclo` | Integração valida concessão, revogação e bloqueio de uso. | Run integrado com consentimento revogado. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `microfrontend` | `[microfrontend][privacidade-consentimento] entregar fluxo visual quando houver UI` | UI explica consentimento em linguagem clara de usuário. | Smoke visual de conceder/revogar. | Texto jurídico ou técnico incompreensível. |
| `documentacao` | `[documentacao][privacidade-consentimento] sincronizar docs e evidências` | Docs registram retenção, visibilidade e revogação. | PR documental. | Ausência de retenção documentada. |
| `governanca` | `[governanca][privacidade-consentimento] fechar ciclo com aceite e docs/project` | Evidência de revogação anexada. | `docs/project` atualizado. | Fechar sem teste negativo. |

### `demo-seeds`

| Ciclo | Título | Aceite | Evidência esperada | Riscos |
| --- | --- | --- | --- | --- |
| `repositorio` | `[repositorio][demo-seeds] preparar contrato, owner e estrutura monorepo` | Contrato de seeds e massa demo registrado. | PR documental e caminho `aneety-platform/apps/demo-seeds/...`. | Dado real em seed pública. |
| `banco` | `[banco][demo-seeds] implementar estrutura de dados, constraints, índices, isolamento e seeds` | `demo_seed_cases` guarda cenário, vertical, descrição e payload sanitizado. | Migration, rollback e teste de sanitização. | Vertical odontológica virar limite do produto. |
| `jobs` | `[jobs][demo-seeds] implementar carga idempotente de massa controlada` | Job carrega seed sem duplicar registros. | Run de carga repetida com contagem estável. | Seed sobrescrever dado operacional. |
| `backend` | `[backend][demo-seeds] publicar contrato do BFF/worker` | API consulta ou aciona demo apenas por permissão controlada. | Contrato HTTP e teste de acesso negado. | Demo disponível em tenant indevido. |
| `teste-integracao-api` | `[teste-integracao-api][demo-seeds] validar API integrada à camada de dados real do ciclo` | Integração valida carga e leitura de cenário. | Run integrado com massa sanitizada. | O arquivo correspondente em `docs/project` precisa registrar evidência do run. |
| `documentacao` | `[documentacao][demo-seeds] sincronizar docs e evidências` | Docs registram uso de Lia como seed/demo/test mass, não limite de produto. | PR documental. | Reintroduzir contrato antigo como produto final. |
| `governanca` | `[governanca][demo-seeds] fechar ciclo com aceite e docs/project` | Evidência de sanitização anexada. | `docs/project` atualizado. | Fechar sem prova de sanitização. |

## Backlog inicial por ciclo

### `repositorio`

Registrar primeiro no painel `docs/project/<responsabilidade>.md` os itens `[repositorio][<responsabilidade>] preparar contrato, owner e estrutura monorepo` para todas as responsabilidades da matriz e para as responsabilidades transversais mandatórias. Issue histórica só deve ser aberta nesse ciclo quando a discussão, decisão ou trilha de evidência precisar de thread própria. Nenhum módulo deve nascer antes de contrato, owner, dados tratados, custo zero, teste e aceite. Prioridade inicial: `gateway-borda`, `tenant-white-label`, `identidade-acesso`, `onboarding-acesso`, `pedidos-customizados`, `workflow-estados`, `catalogo-operacional`.

O ciclo `repositorio` só fica verde com evidência dupla: PR/documento canônico e presença física da raiz `aneety-platform/apps/<responsabilidade>/...` no repo destino `Aneety/ai`. Se o checkout local do repo destino estiver sujo ou se `aneety-platform/apps/` contiver apenas `.gitkeep`, `docs/project/<responsabilidade>.md` deve registrar `bloqueado` e não pode avançar para `deploy`.

### `deploy`

Avançar para `deploy` somente após o ciclo `repositorio` ficar verde para a responsabilidade. Abrir ou atualizar issue histórica apenas se o ciclo exigir thread própria de decisão, bloqueio ou evidência. Aceite mínimo: runtime de custo zero em Cloudflare Workers, sem segredo em repositório, caminho de ambiente documentado, evidência de Cloudflare Workers Build, preview remoto ou `wrangler deploy --dry-run`, e plano de rollback. Para MVP, BFFs usam `worker-<nome>` e microfrontends operacionais usam `mfe-<nome>`.

### `publicacao`

Avançar para `publicacao` após deploy mínimo. Abrir ou atualizar issue histórica apenas se o ciclo exigir thread própria de decisão, bloqueio ou evidência. Aceite mínimo: URL ou artefato público adequado ao ciclo em Cloudflare permitido, sem GitHub Pages como runtime transacional. GitHub Pages pode publicar documentação originada em `Aneety/ai`.

### `banco`

Executar e registrar `[banco][<responsabilidade>] implementar estrutura de dados, constraints, índices, isolamento e seeds` na ordem de prioridades funcionais. Abrir ou atualizar issue histórica apenas se o ciclo exigir thread própria de decisão, bloqueio ou evidência. Aceite mínimo: migrations/DDL ou contrato de storage Workers-compatible, rollback, constraints, índices, controles de isolamento/regras de acesso, seeds controlados e testes de leitura/escrita para o nível CRUD declarado, com evidência Cloudflare-backed.

### `jobs`

Executar e registrar `jobs` apenas para responsabilidades com rotina assíncrona prevista: `offline-sync`, `logistica-rastreabilidade`, `sla-capacidade`, `comunicacao-operacional`, `demo-seeds`. Abrir ou atualizar issue histórica apenas se o ciclo exigir thread própria de decisão, bloqueio ou evidência. Aceite mínimo: idempotência, retries, logs operacionais, reprocessamento e isolamento por tenant.

### `backend`

Executar e registrar `[backend][<responsabilidade>] publicar contrato do BFF/worker` após banco verde para o nível CRUD declarado. Abrir ou atualizar issue histórica apenas se o ciclo exigir thread própria de decisão, bloqueio ou evidência. Aceite mínimo: contrato HTTP ou evento, gateway/contrato público quando aplicável, validação, autorização, paginação quando aplicável, erros de domínio, auditoria mínima e testes de contrato; microfrontend nunca acessa banco direto.

### `teste-integracao-api`

Executar e registrar `[teste-integracao-api][<responsabilidade>] validar API integrada à camada de dados real do ciclo` após backend verde. Abrir ou atualizar issue histórica apenas se o ciclo exigir thread própria de decisão, bloqueio ou evidência. Aceite mínimo: API integrada à camada de dados real do ciclo em preview remoto ou runtime Cloudflare permitido, casos positivos e negativos, isolamento por tenant e evidência do run. Em labels, usar `ciclo:teste-integracao-api`.

### `microfrontend`

Executar e registrar `[microfrontend][<responsabilidade>] entregar fluxo visual quando houver UI` após integração de API verde. Abrir ou atualizar issue histórica apenas se o ciclo exigir thread própria de decisão, bloqueio ou evidência. Aceite mínimo: Single SPA, shadcn/ui e tokens semânticos quando aplicável, estados de carregamento/vazio/erro/sucesso, permissões, acessibilidade básica e nenhuma exposição de fornecedor, banco, runtime, framework, segredo ou ferramenta interna em UI final.

### `smoke`

Executar e registrar `smoke` por responsabilidade quando backend e microfrontend do ciclo estiverem verdes. Abrir ou atualizar issue histórica apenas se o ciclo exigir thread própria de decisão, bloqueio ou evidência. Aceite mínimo: fluxo crítico real executado em Cloudflare permitido, evidência com log, screenshot ou artefato verificável, sem depender de GitHub Pages ou runtime local como runtime operacional.

### `teste`

Executar e registrar `teste` para consolidar cobertura unitária, contrato, integração e regressão do ciclo. Abrir ou atualizar issue histórica apenas se o ciclo exigir thread própria de decisão, bloqueio ou evidência. Quando o teste virar evidência de aceite de código fonte do MVP, deve executar em Cloudflare Workers Builds, preview remoto, runtime remoto ou comando Wrangler que use Cloudflare como alvo. Nova cobertura E2E só entra quando todos os gates de `06-ciclos-cobertura.md` estiverem verdes.

### `documentacao`

Executar e registrar `[documentacao][<responsabilidade>] sincronizar docs e evidências` antes do fechamento de governança. Abrir ou atualizar issue histórica apenas se o ciclo exigir thread própria de decisão, bloqueio ou evidência. Aceite mínimo: documentos canônicos sincronizados em `Aneety/ai/docs`, README mínimo no monorepo de implementação, `docs/project` coerente e links para evidências.

### `governanca`

Executar e registrar `[governanca][<responsabilidade>] fechar ciclo com aceite e docs/project`, abrindo ou atualizando issue histórica apenas quando uma thread própria ainda for necessária. O painel oficial deve ser atualizado em `docs/project/<responsabilidade>.md` e refletido em `docs/project/index.md` quando `Status`, `Ciclo`, `Responsabilidade`, `Repo destino`, `Owner`, `Prioridade`, `Gate`, `Evidência` e `Bloqueio` mudarem. Fechar a issue histórica somente depois que o arquivo Markdown correspondente estiver coerente.

## Sequência CRUD obrigatória por responsabilidade com dados

Cada responsabilidade da matriz deve avançar nesta ordem quando implementar CRUD:

1. Incluir.
2. Pesquisar por `id` ou `eid`.
3. Pesquisar 1 por parâmetros.
4. Pesquisar N paginado por parâmetros.
5. Atualizar 1 por parâmetros.
6. Atualizar N por parâmetros.
7. Excluir 1 por parâmetros por exclusão lógica.
8. Excluir N por parâmetros por exclusão lógica.
9. Executar jobs associados à responsabilidade quando houver.

A etapa só fica verde com contrato, implementação, teste e evidência. Tela, endpoint, tabela ou script isolado não fecha cobertura.

## Checklist de integrações opcionais

Antes de ativar `comunicacao-email` ou `identidade-federada` para qualquer tenant:

- validar modo desligado por smoke ou E2E, sem bloquear pedido, evidência, auditoria, mapa, rastreabilidade, administração ou login próprio;
- validar degradação quando Gmail, Google SSO ou provedor equivalente estiver indisponível, recusando acesso ou excedendo limite;
- confirmar que a sessão final é sempre Aneety e que perfil, permissão, expiração, revogação e controles de isolamento permanecem no modelo próprio;
- confirmar que metadados, auditoria, tentativas e erros ficam no banco da responsabilidade, não no Gmail ou no provedor externo;
- revisar frontend, Git, bundle, logs, screenshots, fixtures públicas e documentação de usuário final para ausência de segredo, token, claim externo ou detalhe técnico de fornecedor.

## Bloqueios normativos registrados

| Bloqueio | Impacto | Próxima ação | Issue sugerida |
| --- | --- | --- | --- |
| Painel Markdown desatualizado ou sem evidência objetiva pode quebrar a rastreabilidade do backlog. | Backlog pode evoluir fora do status real e sem trilha verificável em Git. | Atualizar primeiro `docs/project/<responsabilidade>.md` e depois `docs/project/index.md` em toda mudança de estado. | `[governanca][docs-project] sincronizar painel operacional em Markdown` |
| Responsabilidades fora do backlog inicial ainda podem nascer sem owner real se o registro operacional for aberto sem revisão. | Item executável não pode entrar em ciclo sem responsável nominal. | Registrar owner nomeado primeiro em `docs/project/<responsabilidade>.md` e, se houver issue histórica, repetir o owner no corpo da issue. | Uma issue de `status:triagem` por responsabilidade sem owner nominal, quando a thread histórica for necessária. |

## Critério de conclusão deste planejamento

Este documento estará apto para uso quando:

- todas as tabelas de `04-modelagem-banco.md` estiverem cobertas uma única vez na matriz;
- responsabilidades transversais mandatórias do MVP, como `gateway-borda`, estiverem cobertas com ciclos e aceite;
- cada responsabilidade tiver responsabilidade raiz, caminho canônico no monorepo, arquivo correspondente em `docs/project`, ciclos, aceite e evidência;
- backlog por ciclo respeitar a ordem de `06-ciclos-cobertura.md`;
- bloqueios normativos estiverem explícitos;
- não houver placeholder textual, segredo, valor sensível ou instrução para usar GitHub Pages como runtime operacional.

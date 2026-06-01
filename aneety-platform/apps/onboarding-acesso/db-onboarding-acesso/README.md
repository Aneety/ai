# db-onboarding-acesso

## Objetivo

Definir o contrato de dados do ciclo `banco` da responsabilidade `onboarding-acesso`, cobrindo convites, primeiro acesso, confirmação de contato, recuperação de acesso e lifecycle com desafios persistidos somente em hash, expiração, auditoria e isolamento por tenant.

## Runtime permitido

- Persistência alvo: Cloudflare D1 acessado por Worker via binding `ONBOARDING_ACESSO_DB`.
- Migrations, rollback, seeds e fixtures deste diretório são versionáveis e compatíveis com Cloudflare Workers.
- A conclusão operacional do ciclo depende de GitHub Actions e execução Cloudflare D1-backed; validação local só é usada como inspeção leve de sintaxe/contrato.
- Não usar containers, banco local persistente, Python de runtime MVP, servidor tradicional ou fallback fora de Cloudflare Workers como aceite.

## Artefatos do ciclo `banco`

| Artefato | Finalidade |
| --- | --- |
| [`migrations/0001_onboarding_acesso_d1.sql`](./migrations/0001_onboarding_acesso_d1.sql) | Cria convites, sessões de primeiro acesso, confirmações, recuperações e auditoria com chaves, constraints, índices e isolamento por `tenant_id`. |
| [`rollbacks/0001_onboarding_acesso_d1.sql`](./rollbacks/0001_onboarding_acesso_d1.sql) | Remove índices e tabelas do primeiro contrato de banco em ordem segura para rollback. |
| [`seeds/0001_lia_demo_onboarding.sql`](./seeds/0001_lia_demo_onboarding.sql) | Insere massa sanitizada de convite, primeiro acesso, confirmação, recuperação e auditoria sem contatos reais nem desafios crus. |
| [`contracts/storage-contract.json`](./contracts/storage-contract.json) | Declara o binding D1, diretórios de banco, entidades, política de segurança e evidência remota necessária para conclusão. |
| [`queries/crud-contract.sql`](./queries/crud-contract.sql) | Declara o contrato CRUD tenant-scoped que o BFF poderá expor no ciclo `backend`, sem acesso direto do frontend ao banco. |
| [`tests/onboarding-access-fixture.sql`](./tests/onboarding-access-fixture.sql) | Fixture para validação D1-backed remota de convite válido, isolamento cross-tenant e recuperação revogada. |
| [`tests/db-contract.test.mjs`](./tests/db-contract.test.mjs) | Testes leves de contrato para estrutura, escopo por tenant, hashes, expiração/revogação e binding D1. |
| [`scripts/validate-db-contract.mjs`](./scripts/validate-db-contract.mjs) | Validação leve local de estrutura, rollback, queries tenant-scoped, fixture negativa e ausência de segredos ou desafios crus. |

## Modelo de dados

- `onboarding_invites`: convite por tenant com contato mascarado, contato em hash, papel, perfil, desafio de convite em hash, expiração e estados de aceite/revogação/bloqueio.
- `onboarding_first_access_sessions`: jornada de primeiro acesso vinculada ao convite, com desafio de sessão em hash, aceite de termos, expiração, conclusão e revogação.
- `onboarding_contact_confirmations`: confirmação de contato por canal com contato em hash, desafio em hash, tentativas, expiração e conclusão/revogação.
- `onboarding_recovery_requests`: solicitação de recuperação com contato em hash, identidade de referência, desafio em hash, tentativas, expiração, verificação, conclusão e revogação.
- `onboarding_lifecycle_events`: auditoria mínima dos eventos sensíveis de convite, primeiro acesso, confirmação, recuperação e bloqueio.

## Regras de isolamento e segurança

- Toda tabela operacional contém `tenant_id` obrigatório; índices tenant-scoped começam por `tenant_id` quando a consulta opera convite, sessão de primeiro acesso, confirmação, recuperação ou auditoria.
- Convites, primeiro acesso, confirmação e recuperação persistem somente hashes de desafios; o contrato não cria coluna para desafio cru, segredo ou valor em texto.
- Fluxos expiráveis exigem `expires_at`; fluxos revogáveis exigem `revoked_at` ou estado terminal coerente.
- O contrato CRUD em `queries/crud-contract.sql` exige `WHERE tenant_id = :tenant_id` para leituras e mutações tenant-scoped.
- A UI e o microfrontend não acessam D1 diretamente; o ciclo `backend` deve publicar o contrato HTTP/BFF sobre este banco.

## Evidência para fechar o ciclo

Este diff deixa o contrato versionável pronto para publicação pelo scheduler (`task_outcome=diff_ready`), mas o status permanece `validacao` até existir evidência remota de PR/checks verdes e execução Cloudflare D1-backed da migration, rollback e fixture negativa. Validação local não fecha o MVP.

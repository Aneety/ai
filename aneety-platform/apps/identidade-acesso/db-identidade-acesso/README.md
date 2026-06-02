# db-identidade-acesso

## Objetivo

Definir o contrato de dados do ciclo `banco` da responsabilidade `identidade-acesso`, cobrindo identidade própria, credenciais em hash, sessões com expiração/revogação, usuários, perfis, permissões, isolamento interno por tenant, rollback e seed sanitizado.

## Runtime permitido

- Persistência alvo: Cloudflare D1 acessado por Worker via binding `IDENTIDADE_ACESSO_DB`.
- Migrations, rollback, seeds e fixtures deste diretório são versionáveis e compatíveis com Cloudflare Workers.
- A conclusão operacional do ciclo depende de GitHub Actions e execução Cloudflare D1-backed; validação local só é usada como inspeção leve de sintaxe/contrato.
- Não usar containers, banco local persistente, Python de runtime MVP, servidor tradicional ou fallback fora de Cloudflare Workers como aceite.

## Artefatos do ciclo `banco`

| Artefato | Finalidade |
| --- | --- |
| [`migrations/0001_identidade_acesso_d1.sql`](./migrations/0001_identidade_acesso_d1.sql) | Cria identidades, credenciais, sessões, usuários, perfis, permissões e auditoria com chaves, constraints, índices e isolamento por `tenant_id`. |
| [`rollbacks/0001_identidade_acesso_d1.sql`](./rollbacks/0001_identidade_acesso_d1.sql) | Remove índices e tabelas do primeiro contrato de banco em ordem segura para rollback. |
| [`seeds/0001_lia_demo_identity.sql`](./seeds/0001_lia_demo_identity.sql) | Insere massa sanitizada da identidade inicial de demonstração com hash sintético, perfil, permissões e sessão expirada/revogável sem dados reais. |
| [`contracts/storage-contract.json`](./contracts/storage-contract.json) | Declara o binding D1, diretórios de banco, entidades, política de segurança e evidência remota necessária para conclusão. |
| [`queries/crud-contract.sql`](./queries/crud-contract.sql) | Declara o contrato CRUD tenant-scoped que o BFF poderá expor no ciclo `backend`, sem acesso direto do frontend ao banco. |
| [`tests/identity-access-fixture.sql`](./tests/identity-access-fixture.sql) | Fixture para validação D1-backed remota de sessão ativa, sessão revogada, isolamento cross-tenant e integridade de chaves estrangeiras. |
| [`scripts/validate-db-contract.mjs`](./scripts/validate-db-contract.mjs) | Validação leve local de estrutura, hash, expiração, revogação, permissões, rollback e ausência de segredos em seeds. |

## Modelo de dados

- `app_identities`: identidade própria por tenant com contatos representados por hash e status controlado.
- `auth_credentials`: credenciais sempre armazenadas como hash forte e salgado, com algoritmo, expiração opcional e revogação.
- `auth_sessions`: sessões próprias com hash de access/refresh, expiração, expiração de refresh, rotação e revogação explícita.
- `access_profiles`: perfis tenant-scoped com papel operacional e status.
- `app_users`: usuário operacional que vincula identidade, perfil efetivo e papel dentro do tenant.
- `permissions`: catálogo global de permissões versionáveis.
- `access_profile_permissions`: concessão tenant-scoped de permissões para perfis.
- `identity_audit_events`: trilha mínima para criação, rotação, revogação, negativas e mudanças de acesso.

## Regras de isolamento e segurança

- Toda tabela operacional sensível contém `tenant_id` obrigatório; vínculos internos usam chaves estrangeiras compostas com `tenant_id` para impedir associação cross-tenant entre identidade, credencial, sessão, perfil, usuário e auditoria.
- Credenciais, sessões, recuperação e refresh são persistidos somente como hashes; o contrato não cria coluna para segredo, token cru ou senha em texto.
- Sessões exigem `expires_at`, `refresh_expires_at`, suporte a `revoked_at`, motivo de revogação e vínculo explícito com identidade, tenant e perfil efetivo.
- O contrato CRUD em `queries/crud-contract.sql` exige `WHERE tenant_id = :tenant_id` para leituras e mutações tenant-scoped.
- A UI e o microfrontend não acessam D1 diretamente; o ciclo `backend` deve publicar o contrato HTTP/BFF sobre este banco.

## Evidência para fechar o ciclo

Este diff deixa o contrato versionável pronto para publicação pelo scheduler (`task_outcome=diff_ready`), mas o status permanece `validacao` até existir evidência remota de PR/checks verdes e execução Cloudflare D1-backed da migration, rollback e fixture negativa. Validação local não fecha o MVP.

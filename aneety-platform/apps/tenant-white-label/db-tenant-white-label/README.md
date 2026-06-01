# db-tenant-white-label

## Objetivo

Definir o contrato de dados do ciclo `banco` da responsabilidade `tenant-white-label`, cobrindo tenant, marca, isolamento interno por tenant, rollback e seeds sanitizados para o primeiro tenant de demonstração.

## Runtime permitido

- Persistência alvo: Cloudflare D1 acessado por Worker via binding `TENANT_WHITE_LABEL_DB`.
- Migrations, rollback, seeds e fixtures deste diretório são versionáveis e compatíveis com Cloudflare Workers.
- A conclusão operacional do ciclo depende de GitHub Actions e execução Cloudflare D1-backed; validação local só é usada como inspeção leve de sintaxe/contrato.
- Não usar containers, banco local persistente, Python de runtime MVP, servidor tradicional ou fallback fora de Cloudflare Workers como aceite.

## Artefatos do ciclo `banco`

| Artefato | Finalidade |
| --- | --- |
| [`migrations/0001_tenant_white_label_d1.sql`](./migrations/0001_tenant_white_label_d1.sql) | Cria `tenants`, `tenant_branding` e `tenant_branding_audit_events` com chaves, constraints, índices e isolamento por `tenant_id`. |
| [`rollbacks/0001_tenant_white_label_d1.sql`](./rollbacks/0001_tenant_white_label_d1.sql) | Remove índices e tabelas do primeiro contrato de banco em ordem segura para rollback. |
| [`seeds/0001_lia_demo_brand.sql`](./seeds/0001_lia_demo_brand.sql) | Insere massa sanitizada da marca inicial Lia Demonstração sem dados reais, URLs externas, tokens ou segredos. |
| [`contracts/storage-contract.json`](./contracts/storage-contract.json) | Declara o binding D1, diretórios de banco, entidades e evidência remota necessária para conclusão. |
| [`queries/crud-contract.sql`](./queries/crud-contract.sql) | Declara o contrato CRUD tenant-scoped que o BFF poderá expor no ciclo `backend`. |
| [`tests/tenant-isolation-fixture.sql`](./tests/tenant-isolation-fixture.sql) | Fixture para validação D1-backed remota de leitura e isolamento cross-tenant. |
| [`scripts/validate-db-contract.mjs`](./scripts/validate-db-contract.mjs) | Validação leve local de estrutura, isolamento, rollback e ausência de segredos. |

## Modelo de dados

- `tenants`: limite primário de isolamento, status operacional e locale padrão.
- `tenant_branding`: configuração de marca por tenant, com `UNIQUE (tenant_id, brand_key)`, status de publicação, versão e janela de ativação.
- `tenant_branding_audit_events`: trilha mínima por tenant/marca para eventos de criação, alteração e publicação, sem armazenar segredo ou credencial.

## Regras de isolamento

- Toda tabela derivada de marca contém `tenant_id` obrigatório e chave estrangeira para `tenants`.
- Índices tenant-scoped começam por `tenant_id` quando a consulta opera dados de marca ou auditoria.
- O contrato CRUD em `queries/crud-contract.sql` exige `WHERE tenant_id = :tenant_id` para leituras e mutações tenant-scoped.
- A UI e o microfrontend não acessam D1 diretamente; o ciclo `backend` deve publicar o contrato HTTP/BFF sobre este banco.

## Evidência para fechar o ciclo

Este diff deixa o contrato versionável pronto para publicação pelo scheduler (`task_outcome=diff_ready`), mas o status permanece `validacao` até existir evidência remota de PR/checks verdes e execução Cloudflare D1-backed da migration/fixture. Validação local não fecha o MVP.

# db-identidade-acesso

## Objetivo

Preparar o módulo de estrutura de dados da responsabilidade `identidade-acesso` para os ciclos futuros de banco, isolamento, segurança e seeds sanitizados.

## Runtime permitido

- Persistência deve usar bindings compatíveis com Cloudflare Workers, com D1 como caminho preferencial quando houver modelo relacional.
- Este diretório ainda não contém migrations, DDL, seeds ou testes de dados; eles pertencem ao ciclo `banco`.
- Não usar containers, banco local persistente, Python de runtime MVP, servidor tradicional ou fallback fora de Cloudflare Workers como aceite.

## Dados e contratos

- Tabelas/coleções previstas: `app_identities`, `auth_credentials`, `auth_sessions`, `app_users`, `access_profiles`, `permissions` e `access_profile_permissions`.
- Requisitos futuros: identificadores estáveis, datas de criação/atualização, expiração de sessão, revogação, trilha de auditoria e índices para validações de acesso.
- Credenciais devem ser representadas somente por material protegido/derivado; senha, token bruto ou segredo não podem aparecer em migration, seed, log ou fixture pública.

## Próximo gate

O próximo gate deste diretório é o ciclo `banco`, com migration/DDL ou contrato de storage, rollback, seeds sanitizados e testes remotos aceitos pelo fluxo GitHub Actions/Cloudflare.

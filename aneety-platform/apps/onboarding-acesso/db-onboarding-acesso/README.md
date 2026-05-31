# db-onboarding-acesso

## Objetivo

Preparar o módulo de estrutura de dados da responsabilidade `onboarding-acesso` para os ciclos futuros de banco, isolamento e seeds controlados.

## Runtime permitido

- Persistência deve usar bindings compatíveis com Cloudflare Workers, com D1 como caminho preferencial quando houver modelo relacional.
- Este diretório ainda não contém migrations, DDL, seeds ou testes de dados; eles pertencem ao ciclo `banco`.
- Não usar containers, banco local persistente, Python de runtime MVP, servidor tradicional ou fallback fora de Cloudflare Workers como aceite.

## Dados e contratos

- Tabelas/coleções previstas: `access_invitations`, `onboarding_progress`, `contact_verification_requests`, `access_recovery_requests` e `access_lifecycle_events`.
- Requisitos futuros: hash de tokens, expiração, revogação, auditoria mínima, datas de criação/atualização, índices por tenant e controles explícitos de isolamento.
- Dados de convite e recuperação não podem versionar segredo em claro nem massa real de usuários.

## Próximo gate

O próximo gate deste diretório é o ciclo `banco`, com migration/DDL ou contrato de storage, rollback, seeds sanitizados e testes remotos aceitos pelo fluxo GitHub Actions/Cloudflare.

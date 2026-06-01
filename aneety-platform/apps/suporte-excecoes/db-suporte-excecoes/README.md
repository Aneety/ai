# db-suporte-excecoes

## Objetivo

Reservar a estrutura de dados da responsabilidade `suporte-excecoes` para ciclos futuros.

## Dados previstos

`support_cases, dispute_causes, remedies, case_messages e case_decisions`.

## Regras

- Persistência do MVP deve usar bindings compatíveis com Cloudflare Workers.
- Toda entidade precisa preservar isolamento por tenant.
- Migrations, rollback, seeds e testes de leitura/escrita pertencem ao ciclo `banco`, não a este scaffold.

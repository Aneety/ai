# db-producao-execucao

## Objetivo

Reservar a estrutura de dados da responsabilidade `producao-execucao` para ciclos futuros.

## Dados previstos

`production_demands, execution_steps, execution_notes, execution_assignments e execution_history`.

## Regras

- Persistência do MVP deve usar bindings compatíveis com Cloudflare Workers.
- Toda entidade precisa preservar isolamento por tenant.
- Migrations, rollback, seeds e testes de leitura/escrita pertencem ao ciclo `banco`, não a este scaffold.

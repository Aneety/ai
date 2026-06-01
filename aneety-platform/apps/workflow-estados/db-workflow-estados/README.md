# db-workflow-estados

## Objetivo

Reservar a estrutura de dados da responsabilidade `workflow-estados` para ciclos futuros.

## Dados previstos

`state_machines, state_transitions, transition_guards e transition_audit_events`.

## Regras

- Persistência do MVP deve usar bindings compatíveis com Cloudflare Workers.
- Toda entidade precisa preservar isolamento por tenant.
- Migrations, rollback, seeds e testes de leitura/escrita pertencem ao ciclo `banco`, não a este scaffold.

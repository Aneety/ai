# db-marketplace-operacional

## Objetivo

Reservar a estrutura de dados da responsabilidade `marketplace-operacional` para ciclos futuros.

## Dados previstos

`marketplace_actors, actor_scores, actor_capacity, actor_favorites e actor_restrictions`.

## Regras

- Persistência do MVP deve usar bindings compatíveis com Cloudflare Workers.
- Toda entidade precisa preservar isolamento por tenant.
- Migrations, rollback, seeds e testes de leitura/escrita pertencem ao ciclo `banco`, não a este scaffold.

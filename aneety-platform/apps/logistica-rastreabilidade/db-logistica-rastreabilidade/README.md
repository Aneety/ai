# db-logistica-rastreabilidade

## Objetivo

Reservar a estrutura de dados da responsabilidade `logistica-rastreabilidade` para ciclos futuros.

## Dados previstos

`logistics_tasks, tracking_events, delivery_proofs, route_snapshots e location_consents`.

## Regras

- Persistência do MVP deve usar bindings compatíveis com Cloudflare Workers.
- Toda entidade precisa preservar isolamento por tenant.
- Migrations, rollback, seeds e testes de leitura/escrita pertencem ao ciclo `banco`, não a este scaffold.

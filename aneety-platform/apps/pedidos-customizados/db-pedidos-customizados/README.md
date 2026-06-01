# db-pedidos-customizados

## Objetivo

Reservar a estrutura de dados da responsabilidade `pedidos-customizados` para ciclos futuros.

## Dados previstos

`orders, order_decision_fields, order_participants, order_status_history e order_links`.

## Regras

- Persistência do MVP deve usar bindings compatíveis com Cloudflare Workers.
- Toda entidade precisa preservar isolamento por tenant.
- Migrations, rollback, seeds e testes de leitura/escrita pertencem ao ciclo `banco`, não a este scaffold.

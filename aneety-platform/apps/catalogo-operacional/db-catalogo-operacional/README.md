# db-catalogo-operacional

## Objetivo

Reservar a estrutura de dados da responsabilidade `catalogo-operacional` para ciclos futuros.

## Dados previstos

`catalog_items, catalog_attributes, evidence_requirements e catalog_pricing_rules`.

## Regras

- Persistência do MVP deve usar bindings compatíveis com Cloudflare Workers.
- Toda entidade precisa preservar isolamento por tenant.
- Migrations, rollback, seeds e testes de leitura/escrita pertencem ao ciclo `banco`, não a este scaffold.

# db-qualidade-evidencias

## Objetivo

Reservar a estrutura de dados da responsabilidade `qualidade-evidencias` para ciclos futuros.

## Dados previstos

`quality_checkpoints, evidence_items, evidence_visibility_rules e quality_decisions`.

## Regras

- Persistência do MVP deve usar bindings compatíveis com Cloudflare Workers.
- Toda entidade precisa preservar isolamento por tenant.
- Migrations, rollback, seeds e testes de leitura/escrita pertencem ao ciclo `banco`, não a este scaffold.

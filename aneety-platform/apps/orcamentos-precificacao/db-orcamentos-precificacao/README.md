# db-orcamentos-precificacao

## Objetivo

Reservar a estrutura de dados da responsabilidade `orcamentos-precificacao` para ciclos futuros.

## Dados previstos

`quote_requests, quote_responses, pricing_components, quote_rankings e quote_decisions`.

## Regras

- Persistência do MVP deve usar bindings compatíveis com Cloudflare Workers.
- Toda entidade precisa preservar isolamento por tenant.
- Migrations, rollback, seeds e testes de leitura/escrita pertencem ao ciclo `banco`, não a este scaffold.

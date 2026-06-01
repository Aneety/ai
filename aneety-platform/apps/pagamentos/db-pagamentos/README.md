# db-pagamentos

## Objetivo

Reservar a estrutura de dados da responsabilidade `pagamentos` para ciclos futuros.

## Dados previstos

`payment_intents, custody_entries, payouts, invoices, financial_adjustments e payment_events`.

## Regras

- Persistência do MVP deve usar bindings compatíveis com Cloudflare Workers.
- Toda entidade precisa preservar isolamento por tenant.
- Migrations, rollback, seeds e testes de leitura/escrita pertencem ao ciclo `banco`, não a este scaffold.

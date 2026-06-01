# pagamentos

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** operar intenção financeira, custódia, congelamento por disputa, liberação, conciliação, fatura e repasse.
- **Caminho canônico:** `aneety-platform/apps/pagamentos/...`.
- **Runtime permitido no MVP:** somente Cloudflare Workers e mecanismos compatíveis. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers neste scaffold.

## Ciclos previstos

Ordem operacional registrada em `docs/project/pagamentos.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`:

1. `repositorio` — criar raiz física, owner, escopo e diretórios folha mínimos.
2. `deploy` — preparar ambiente Cloudflare Workers de custo zero, sem segredo em repositório.
3. `publicacao` — publicar artefato/URL permitida pelo ciclo.
4. `banco` — versionar estruturas de dados da responsabilidade com isolamento por tenant.
5. `backend` — expor contrato BFF em `worker-pagamentos`.
6. `teste-integracao-api` — validar API integrada à camada de dados real do ciclo.
7. `microfrontend` — entregar fluxo visual em linguagem de produto.
8. `smoke`, `teste`, `documentacao` e `governanca` — consolidar evidências e aceite.

## Contratos e dados

- Dados previstos: `payment_intents, custody_entries, payouts, invoices, financial_adjustments e payment_events`.
- Contrato de isolamento: todo dado precisa preservar fronteira por tenant e evitar cross-tenant.
- Contrato de experiência: telas e mensagens não podem expor stack, banco, runtime, fornecedor técnico, segredo ou ferramenta interna ao usuário final.
- Custo: nenhuma dependência paga obrigatória pode ser introduzida no MVP.

## Módulos iniciais

- [`db-pagamentos`](./db-pagamentos/README.md) — estrutura de dados, migrations futuras, seeds e controles de isolamento.
- [`worker-pagamentos`](./worker-pagamentos/README.md) — BFF HTTP compatível com Cloudflare Workers/Hono.
- [`mfe-pagamentos`](./mfe-pagamentos/README.md) — microfrontend Single SPA para custódia, extrato, detalhe financeiro, bloqueio, liberação e recebimento.

## Próximo gate

Após este scaffold do ciclo `repositorio`, o próximo gate é PR/GitHub Actions. `deploy`, `publicacao`, `banco`, `backend` e `microfrontend` só avançam com evidência remota exigida pelos documentos normativos.

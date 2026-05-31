# pedidos-customizados

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** operar o ciclo central de pedidos customizados da Aneety Platform, incluindo criação, consulta, atualização controlada, exclusão lógica e checkpoints operacionais.
- **Caminho canônico:** `aneety-platform/apps/pedidos-customizados/...`.
- **Runtime permitido no MVP:** somente Cloudflare Workers e mecanismos compatíveis. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers neste scaffold.

## Ciclos previstos

Ordem operacional registrada em `docs/project/pedidos-customizados.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`:

1. `repositorio` — criar raiz física, owner, escopo e diretórios folha mínimos.
2. `deploy` — preparar ambiente Cloudflare Workers de custo zero, sem segredo em repositório.
3. `publicacao` — publicar artefato/URL permitida pelo ciclo.
4. `banco` — versionar `orders` e `order_checkpoints` com histórico, exclusão lógica e isolamento por tenant.
5. `backend` — expor contrato BFF em `worker-pedidos-customizados`.
6. `teste-integracao-api` — validar API integrada à camada de dados real do ciclo.
7. `microfrontend` — entregar fluxo visual para criar, listar, editar e acompanhar pedidos.
8. `smoke`, `teste`, `documentacao` e `governanca` — consolidar evidências e aceite.

## Contratos e dados

- Dados previstos: `orders` e `order_checkpoints`.
- Contrato de histórico: mutações futuras devem preservar versão, checkpoint e exclusão lógica, sem remoção física como comportamento padrão.
- Contrato de isolamento: todo pedido e checkpoint precisa preservar fronteira por tenant e evitar cross-tenant.
- Contrato de experiência: telas e mensagens devem usar linguagem operacional genérica de produto/serviço customizado, sem acoplar o pedido à vertical odontológica.
- Custo: nenhuma dependência paga obrigatória pode ser introduzida no MVP.

## Módulos iniciais

- [`db-pedidos-customizados`](./db-pedidos-customizados/README.md) — estrutura de dados, migrations futuras, seeds controlados e controles de isolamento.
- [`worker-pedidos-customizados`](./worker-pedidos-customizados/README.md) — BFF HTTP compatível com Cloudflare Workers/Hono para pedidos e checkpoints.
- [`mfe-pedidos-customizados`](./mfe-pedidos-customizados/README.md) — microfrontend Single SPA para operação visual de pedidos.

## Próximo gate

Após este scaffold do ciclo `repositorio`, o próximo gate é `deploy`: preparar evidência remota em Cloudflare Workers/GitHub Actions antes de qualquer smoke, integração, E2E ou aceite operacional.

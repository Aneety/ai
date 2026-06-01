# logistica-rastreabilidade

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** organizar coleta, entrega, check-in, check-out, localização permitida, comprovante e eventos de rastreabilidade.
- **Caminho canônico:** `aneety-platform/apps/logistica-rastreabilidade/...`.
- **Runtime permitido no MVP:** somente Cloudflare Workers e mecanismos compatíveis. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers neste scaffold.

## Ciclos previstos

Ordem operacional registrada em `docs/project/logistica-rastreabilidade.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`:

1. `repositorio` — criar raiz física, owner, escopo e diretórios folha mínimos.
2. `deploy` — preparar ambiente Cloudflare Workers de custo zero, sem segredo em repositório.
3. `publicacao` — publicar artefato/URL permitida pelo ciclo.
4. `banco` — versionar estruturas de dados da responsabilidade com isolamento por tenant.
5. `backend` — expor contrato BFF em `worker-logistica-rastreabilidade`.
6. `teste-integracao-api` — validar API integrada à camada de dados real do ciclo.
7. `microfrontend` — entregar fluxo visual em linguagem de produto.
8. `smoke`, `teste`, `documentacao` e `governanca` — consolidar evidências e aceite.

## Contratos e dados

- Dados previstos: `logistics_tasks, tracking_events, delivery_proofs, route_snapshots e location_consents`.
- Contrato de isolamento: todo dado precisa preservar fronteira por tenant e evitar cross-tenant.
- Contrato de experiência: telas e mensagens não podem expor stack, banco, runtime, fornecedor técnico, segredo ou ferramenta interna ao usuário final.
- Custo: nenhuma dependência paga obrigatória pode ser introduzida no MVP.

## Módulos iniciais

- [`db-logistica-rastreabilidade`](./db-logistica-rastreabilidade/README.md) — estrutura de dados, migrations futuras, seeds e controles de isolamento.
- [`worker-logistica-rastreabilidade`](./worker-logistica-rastreabilidade/README.md) — BFF HTTP compatível com Cloudflare Workers/Hono.
- [`mfe-logistica-rastreabilidade`](./mfe-logistica-rastreabilidade/README.md) — microfrontend Single SPA para coleta/entrega, mapa operacional, rastreamento, comprovante e histórico logístico.

## Próximo gate

Após este scaffold do ciclo `repositorio`, o próximo gate é PR/GitHub Actions. `deploy`, `publicacao`, `banco`, `backend` e `microfrontend` só avançam com evidência remota exigida pelos documentos normativos.

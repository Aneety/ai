# catalogo-operacional

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** configurar catálogo por tenant com produtos, serviços, atributos decisórios, evidências obrigatórias, preço-base e prazo-base.
- **Caminho canônico:** `aneety-platform/apps/catalogo-operacional/...`.
- **Runtime permitido no MVP:** somente Cloudflare Workers e mecanismos compatíveis. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers neste scaffold.

## Ciclos previstos

Ordem operacional registrada em `docs/project/catalogo-operacional.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`:

1. `repositorio` — criar raiz física, owner, escopo e diretórios folha mínimos.
2. `deploy` — preparar ambiente Cloudflare Workers de custo zero, sem segredo em repositório.
3. `publicacao` — publicar artefato/URL permitida pelo ciclo.
4. `banco` — versionar estruturas de dados da responsabilidade com isolamento por tenant.
5. `backend` — expor contrato BFF em `worker-catalogo-operacional`.
6. `teste-integracao-api` — validar API integrada à camada de dados real do ciclo.
7. `microfrontend` — entregar fluxo visual em linguagem de produto.
8. `smoke`, `teste`, `documentacao` e `governanca` — consolidar evidências e aceite.

## Contratos e dados

- Dados previstos: `catalog_items, catalog_attributes, evidence_requirements e catalog_pricing_rules`.
- Contrato de isolamento: todo dado precisa preservar fronteira por tenant e evitar cross-tenant.
- Contrato de experiência: telas e mensagens não podem expor stack, banco, runtime, fornecedor técnico, segredo ou ferramenta interna ao usuário final.
- Custo: nenhuma dependência paga obrigatória pode ser introduzida no MVP.

## Módulos iniciais

- [`db-catalogo-operacional`](./db-catalogo-operacional/README.md) — estrutura de dados, migrations futuras, seeds e controles de isolamento.
- [`worker-catalogo-operacional`](./worker-catalogo-operacional/README.md) — BFF HTTP compatível com Cloudflare Workers/Hono.
- [`mfe-catalogo-operacional`](./mfe-catalogo-operacional/README.md) — microfrontend Single SPA para seleção de produto/serviço, categorias, atributos, raio/capacidade e requisitos de evidência.

## Próximo gate

Após este scaffold do ciclo `repositorio`, o próximo gate é PR/GitHub Actions. `deploy`, `publicacao`, `banco`, `backend` e `microfrontend` só avançam com evidência remota exigida pelos documentos normativos.

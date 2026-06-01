# orcamentos-precificacao

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** configurar necessidade, calcular preço/prazo, solicitar cotação, comparar ofertas e registrar aprovação comercial.
- **Caminho canônico:** `aneety-platform/apps/orcamentos-precificacao/...`.
- **Runtime permitido no MVP:** somente Cloudflare Workers e mecanismos compatíveis. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers neste scaffold.

## Ciclos previstos

Ordem operacional registrada em `docs/project/orcamentos-precificacao.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`:

1. `repositorio` — criar raiz física, owner, escopo e diretórios folha mínimos.
2. `deploy` — preparar ambiente Cloudflare Workers de custo zero, sem segredo em repositório.
3. `publicacao` — publicar artefato/URL permitida pelo ciclo.
4. `banco` — versionar estruturas de dados da responsabilidade com isolamento por tenant.
5. `backend` — expor contrato BFF em `worker-orcamentos-precificacao`.
6. `teste-integracao-api` — validar API integrada à camada de dados real do ciclo.
7. `microfrontend` — entregar fluxo visual em linguagem de produto.
8. `smoke`, `teste`, `documentacao` e `governanca` — consolidar evidências e aceite.

## Contratos e dados

- Dados previstos: `quote_requests, quote_responses, pricing_components, quote_rankings e quote_decisions`.
- Contrato de isolamento: todo dado precisa preservar fronteira por tenant e evitar cross-tenant.
- Contrato de experiência: telas e mensagens não podem expor stack, banco, runtime, fornecedor técnico, segredo ou ferramenta interna ao usuário final.
- Custo: nenhuma dependência paga obrigatória pode ser introduzida no MVP.

## Módulos iniciais

- [`db-orcamentos-precificacao`](./db-orcamentos-precificacao/README.md) — estrutura de dados, migrations futuras, seeds e controles de isolamento.
- [`worker-orcamentos-precificacao`](./worker-orcamentos-precificacao/README.md) — BFF HTTP compatível com Cloudflare Workers/Hono.
- [`mfe-orcamentos-precificacao`](./mfe-orcamentos-precificacao/README.md) — microfrontend Single SPA para solicitação de orçamento, comparação de cotação, validade, urgência e decisão.

## Próximo gate

Após este scaffold do ciclo `repositorio`, o próximo gate é PR/GitHub Actions. `deploy`, `publicacao`, `banco`, `backend` e `microfrontend` só avançam com evidência remota exigida pelos documentos normativos.

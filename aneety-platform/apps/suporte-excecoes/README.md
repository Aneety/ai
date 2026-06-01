# suporte-excecoes

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** abrir e resolver disputas, exceções, remakes, pedidos de correção e suporte com decisão auditada.
- **Caminho canônico:** `aneety-platform/apps/suporte-excecoes/...`.
- **Runtime permitido no MVP:** somente Cloudflare Workers e mecanismos compatíveis. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers neste scaffold.

## Ciclos previstos

Ordem operacional registrada em `docs/project/suporte-excecoes.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`:

1. `repositorio` — criar raiz física, owner, escopo e diretórios folha mínimos.
2. `deploy` — preparar ambiente Cloudflare Workers de custo zero, sem segredo em repositório.
3. `publicacao` — publicar artefato/URL permitida pelo ciclo.
4. `banco` — versionar estruturas de dados da responsabilidade com isolamento por tenant.
5. `backend` — expor contrato BFF em `worker-suporte-excecoes`.
6. `teste-integracao-api` — validar API integrada à camada de dados real do ciclo.
7. `microfrontend` — entregar fluxo visual em linguagem de produto.
8. `smoke`, `teste`, `documentacao` e `governanca` — consolidar evidências e aceite.

## Contratos e dados

- Dados previstos: `support_cases, dispute_causes, remedies, case_messages e case_decisions`.
- Contrato de isolamento: todo dado precisa preservar fronteira por tenant e evitar cross-tenant.
- Contrato de experiência: telas e mensagens não podem expor stack, banco, runtime, fornecedor técnico, segredo ou ferramenta interna ao usuário final.
- Custo: nenhuma dependência paga obrigatória pode ser introduzida no MVP.

## Módulos iniciais

- [`db-suporte-excecoes`](./db-suporte-excecoes/README.md) — estrutura de dados, migrations futuras, seeds e controles de isolamento.
- [`worker-suporte-excecoes`](./worker-suporte-excecoes/README.md) — BFF HTTP compatível com Cloudflare Workers/Hono.
- [`mfe-suporte-excecoes`](./mfe-suporte-excecoes/README.md) — microfrontend Single SPA para abertura de disputa, motivo, evidências, remédio e mensagens vinculadas ao pedido.

## Próximo gate

Após este scaffold do ciclo `repositorio`, o próximo gate é PR/GitHub Actions. `deploy`, `publicacao`, `banco`, `backend` e `microfrontend` só avançam com evidência remota exigida pelos documentos normativos.

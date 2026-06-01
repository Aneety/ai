# workflow-estados

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** controlar máquina de estados de pedido, produção, qualidade, logística, pagamento, suporte e bloqueios com motivo obrigatório.
- **Caminho canônico:** `aneety-platform/apps/workflow-estados/...`.
- **Runtime permitido no MVP:** somente Cloudflare Workers e mecanismos compatíveis. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers neste scaffold.

## Ciclos previstos

Ordem operacional registrada em `docs/project/workflow-estados.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`:

1. `repositorio` — criar raiz física, owner, escopo e diretórios folha mínimos.
2. `deploy` — preparar ambiente Cloudflare Workers de custo zero, sem segredo em repositório.
3. `publicacao` — publicar artefato/URL permitida pelo ciclo.
4. `banco` — versionar estruturas de dados da responsabilidade com isolamento por tenant.
5. `backend` — expor contrato BFF em `worker-workflow-estados`.
6. `teste-integracao-api` — validar API integrada à camada de dados real do ciclo.
7. `microfrontend` — entregar fluxo visual em linguagem de produto.
8. `smoke`, `teste`, `documentacao` e `governanca` — consolidar evidências e aceite.

## Contratos e dados

- Dados previstos: `state_machines, state_transitions, transition_guards e transition_audit_events`.
- Contrato de isolamento: todo dado precisa preservar fronteira por tenant e evitar cross-tenant.
- Contrato de experiência: telas e mensagens não podem expor stack, banco, runtime, fornecedor técnico, segredo ou ferramenta interna ao usuário final.
- Custo: nenhuma dependência paga obrigatória pode ser introduzida no MVP.

## Módulos iniciais

- [`db-workflow-estados`](./db-workflow-estados/README.md) — estrutura de dados, migrations futuras, seeds e controles de isolamento.
- [`worker-workflow-estados`](./worker-workflow-estados/README.md) — BFF HTTP compatível com Cloudflare Workers/Hono.
- [`mfe-workflow-estados`](./mfe-workflow-estados/README.md) — microfrontend Single SPA para transições permitidas, bloqueios, atraso, conflito e próxima ação por papel.

## Próximo gate

Após este scaffold do ciclo `repositorio`, o próximo gate é PR/GitHub Actions. `deploy`, `publicacao`, `banco`, `backend` e `microfrontend` só avançam com evidência remota exigida pelos documentos normativos.

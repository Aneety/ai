# qualidade-evidencias

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** registrar checkpoints de qualidade, evidências, aprovação/reprovação, correções e bloqueios de avanço.
- **Caminho canônico:** `aneety-platform/apps/qualidade-evidencias/...`.
- **Runtime permitido no MVP:** somente Cloudflare Workers e mecanismos compatíveis. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers neste scaffold.

## Ciclos previstos

Ordem operacional registrada em `docs/project/qualidade-evidencias.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`:

1. `repositorio` — criar raiz física, owner, escopo e diretórios folha mínimos.
2. `deploy` — preparar ambiente Cloudflare Workers de custo zero, sem segredo em repositório.
3. `publicacao` — publicar artefato/URL permitida pelo ciclo.
4. `banco` — versionar estruturas de dados da responsabilidade com isolamento por tenant.
5. `backend` — expor contrato BFF em `worker-qualidade-evidencias`.
6. `teste-integracao-api` — validar API integrada à camada de dados real do ciclo.
7. `microfrontend` — entregar fluxo visual em linguagem de produto.
8. `smoke`, `teste`, `documentacao` e `governanca` — consolidar evidências e aceite.

## Contratos e dados

- Dados previstos: `quality_checkpoints, evidence_items, evidence_visibility_rules e quality_decisions`.
- Contrato de isolamento: todo dado precisa preservar fronteira por tenant e evitar cross-tenant.
- Contrato de experiência: telas e mensagens não podem expor stack, banco, runtime, fornecedor técnico, segredo ou ferramenta interna ao usuário final.
- Custo: nenhuma dependência paga obrigatória pode ser introduzida no MVP.

## Módulos iniciais

- [`db-qualidade-evidencias`](./db-qualidade-evidencias/README.md) — estrutura de dados, migrations futuras, seeds e controles de isolamento.
- [`worker-qualidade-evidencias`](./worker-qualidade-evidencias/README.md) — BFF HTTP compatível com Cloudflare Workers/Hono.
- [`mfe-qualidade-evidencias`](./mfe-qualidade-evidencias/README.md) — microfrontend Single SPA para registro de evidências, aprovação de qualidade, checklist e motivo de correção.

## Próximo gate

Após este scaffold do ciclo `repositorio`, o próximo gate é PR/GitHub Actions. `deploy`, `publicacao`, `banco`, `backend` e `microfrontend` só avançam com evidência remota exigida pelos documentos normativos.

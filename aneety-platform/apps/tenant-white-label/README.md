# tenant-white-label

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** administrar tenants e marca white-label da Aneety Platform.
- **Caminho canônico:** `aneety-platform/apps/tenant-white-label/...`.
- **Runtime permitido no MVP:** somente Cloudflare Workers e mecanismos compatíveis. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers neste scaffold.

## Ciclos previstos

Ordem operacional registrada em `docs/project/tenant-white-label.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`:

1. `repositorio` — criar raiz física, owner, escopo e diretórios folha mínimos.
2. `deploy` — preparar ambiente Cloudflare Workers de custo zero, sem segredo em repositório.
3. `publicacao` — publicar artefato/URL permitida pelo ciclo.
4. `banco` — versionar estrutura `tenants` e `tenant_branding` com isolamento por tenant.
5. `backend` — expor contrato BFF em `worker-tenant-white-label`.
6. `teste-integracao-api` — validar API integrada à camada de dados real do ciclo.
7. `microfrontend` — entregar administração de marca em linguagem de produto.
8. `smoke`, `teste`, `documentacao` e `governanca` — consolidar evidências e aceite.

## Contratos e dados

- Dados previstos: `tenants` e `tenant_branding`.
- Contrato de isolamento: todo dado precisa preservar fronteira por tenant e evitar cross-tenant.
- Contrato de marca: configurações visuais e administrativas não podem expor segredos ou detalhes de DNS/CDN ao frontend operacional.
- Custo: nenhuma dependência paga obrigatória pode ser introduzida no MVP.

## Módulos iniciais

- [`db-tenant-white-label`](./db-tenant-white-label/README.md) — estrutura de dados, migrations futuras, seeds e controles de isolamento.
- [`worker-tenant-white-label`](./worker-tenant-white-label/README.md) — BFF HTTP compatível com Cloudflare Workers/Hono.
- [`mfe-tenant-white-label`](./mfe-tenant-white-label/README.md) — microfrontend Single SPA para administração white-label.

## Próximo gate

Com `deploy` já validado por gate remoto dry-run, o próximo gate é `publicacao`: obter URL HTTPS real em Cloudflare Workers pelo `Cloudflare deploy gate` remoto, executar smoke remoto e registrar evidência versionável antes de liberar `banco`, `backend` ou UI.

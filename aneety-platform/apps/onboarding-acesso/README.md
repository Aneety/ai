# onboarding-acesso

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** conduzir convite, primeiro acesso, confirmação de contato, recuperação e eventos de lifecycle de acesso da Aneety Platform.
- **Caminho canônico:** `aneety-platform/apps/onboarding-acesso/...`.
- **Runtime permitido no MVP:** somente Cloudflare Workers e mecanismos compatíveis. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers neste scaffold.

## Ciclos previstos

Ordem operacional registrada em `docs/project/onboarding-acesso.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`:

1. `repositorio` — criar raiz física, owner, escopo e diretórios folha mínimos.
2. `deploy` — preparar ambiente Cloudflare Workers de custo zero, sem segredo em repositório.
3. `publicacao` — publicar artefato/URL permitida pelo ciclo.
4. `banco` — versionar `access_invitations`, `onboarding_progress`, `contact_verification_requests`, `access_recovery_requests` e `access_lifecycle_events` com isolamento por tenant.
5. `backend` — expor contrato BFF em `worker-onboarding-acesso`.
6. `teste-integracao-api` — validar API integrada à camada de dados real do ciclo.
7. `microfrontend` — entregar fluxo visual de primeiro acesso e recuperação em linguagem operacional.
8. `smoke`, `teste`, `documentacao` e `governanca` — consolidar evidências e aceite.

## Contratos e dados

- Dados previstos: `access_invitations`, `onboarding_progress`, `contact_verification_requests`, `access_recovery_requests` e `access_lifecycle_events`.
- Contrato de segurança: tokens de convite, confirmação e recuperação devem ser armazenados apenas como hash, com expiração, revogação e auditoria.
- Contrato de isolamento: todo dado precisa preservar fronteira por tenant e evitar cross-tenant.
- Contrato de experiência: telas e mensagens não podem expor token, segredo, banco, provider ou runtime ao usuário final.
- Custo: nenhuma dependência paga obrigatória pode ser introduzida no MVP.

## Módulos iniciais

- [`db-onboarding-acesso`](./db-onboarding-acesso/README.md) — estrutura de dados, migrations futuras, seeds controlados e controles de isolamento.
- [`worker-onboarding-acesso`](./worker-onboarding-acesso/README.md) — BFF HTTP compatível com Cloudflare Workers/Hono para convites, confirmação e recuperação.
- [`mfe-onboarding-acesso`](./mfe-onboarding-acesso/README.md) — microfrontend Single SPA para primeiro acesso e recuperação.

## Status operacional atual

Conforme `docs/project/onboarding-acesso.md`, os ciclos `repositorio`, `deploy` e `publicacao` já estão `concluido`: o Worker foi validado por dry-run remoto, publicado em URL HTTPS real e registrado com evidência de deploy/smoke remoto. O ciclo ativo agora é `banco`, em `validacao`, para consolidar o contrato D1 de convites, primeiro acesso, confirmação, recuperação e lifecycle com isolamento por tenant antes de liberar `backend`.

## Próximo gate

O próximo gate operacional é `banco`: publicar a PR/checks do contrato persistido e registrar a execução remota D1-backed de migration, rollback e fixture. Não reabrir `deploy` ou `publicacao` sem evidência objetiva de drift, e não avançar `backend` enquanto `banco` não estiver `concluido` no painel operacional.

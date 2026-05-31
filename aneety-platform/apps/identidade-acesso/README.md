# identidade-acesso

## Owner e escopo

- **Owner:** Ricardo Malnati.
- **Responsabilidade:** administrar identidade própria, credenciais, sessões, perfis e permissões da Aneety Platform.
- **Caminho canônico:** `aneety-platform/apps/identidade-acesso/...`.
- **Runtime permitido no MVP:** somente Cloudflare Workers e mecanismos compatíveis. Não há runtime local, container, servidor persistente, Python de runtime MVP ou fallback fora de Workers neste scaffold.

## Ciclos previstos

Ordem operacional registrada em `docs/project/identidade-acesso.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`:

1. `repositorio` — criar raiz física, owner, escopo e diretórios folha mínimos.
2. `deploy` — preparar ambiente Cloudflare Workers de custo zero, sem segredo em repositório.
3. `publicacao` — publicar artefato/URL permitida pelo ciclo.
4. `banco` — versionar estruturas de identidade, credenciais, sessões, perfis e permissões.
5. `backend` — expor contrato BFF em `worker-identidade-acesso`.
6. `teste-integracao-api` — validar API integrada à camada de dados real do ciclo.
7. `microfrontend` — entregar administração de usuários, perfis e permissões sem acesso direto a dados privilegiados.
8. `smoke`, `teste`, `documentacao` e `governanca` — consolidar evidências e aceite.

## Contratos e dados

- Dados previstos: `app_identities`, `auth_credentials`, `auth_sessions`, `app_users`, `access_profiles`, `permissions` e `access_profile_permissions`.
- Contrato de credenciais: nenhuma senha, token bruto, segredo ou material sensível pode ser exposto ao frontend, armazenado sem proteção ou versionado no repositório.
- Contrato de sessão: expiração, revogação e auditoria devem ser tratadas pelo BFF/worker e por bindings compatíveis com Workers.
- Contrato de autorização: perfis e permissões precisam sustentar testes negativos e evitar acesso direto do microfrontend ao banco.
- Custo: nenhuma dependência paga obrigatória pode ser introduzida no MVP.

## Módulos iniciais

- [`db-identidade-acesso`](./db-identidade-acesso/README.md) — estrutura de dados, migrations futuras, seeds sanitizados e controles de segurança.
- [`worker-identidade-acesso`](./worker-identidade-acesso/README.md) — BFF HTTP compatível com Cloudflare Workers/Hono.
- [`mfe-identidade-acesso`](./mfe-identidade-acesso/README.md) — microfrontend Single SPA para administração de usuários, perfis e permissões.

## Próximo gate

Após este scaffold do ciclo `repositorio`, o próximo gate é `deploy`: preparar evidência remota em Cloudflare Workers/GitHub Actions antes de qualquer smoke, integração, E2E ou aceite operacional.

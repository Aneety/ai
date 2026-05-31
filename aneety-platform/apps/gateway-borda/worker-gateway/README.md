# worker-gateway

Contrato inicial do gateway HTTP do MVP.

## Responsabilidade

`worker-gateway` será a borda pública compatível com Cloudflare Workers para:

- validar CORS;
- validar versão de contrato;
- validar sessão pública Aneety quando existir contrato de identidade;
- rotear chamadas para BFFs `worker-*` por service binding ou contrato equivalente;
- padronizar erros de borda sem expor detalhe técnico para usuários finais.

## Ciclo `deploy`

Este diretório agora contém uma implementação mínima versionável para Cloudflare Workers:

- `src/index.js` exporta o handler `fetch` do Worker;
- `wrangler.toml` declara o Worker público sem segredos e os service bindings canônicos para BFFs `worker-*`;
- `package.json` expõe checks leves de sintaxe e testes de módulo para o gate remoto;
- `tests/gateway.test.js` valida CORS, versão de contrato, sessão pública Aneety e roteamento para service binding simulado.

## Ambiente e rollback

- Variáveis versionadas sem segredo: `ANEETY_ALLOWED_ORIGINS` e `ANEETY_CONTRACT_VERSION`.
- Bindings de serviço esperados no ambiente Cloudflare: `IDENTIDADE_ACESSO`, `TENANT_WHITE_LABEL` e `ONBOARDING_ACESSO`, apontando para BFFs `worker-*` canônicos.
- Segredos, quando existirem em ciclos posteriores dos BFFs, devem ser configurados somente no painel/API Cloudflare e nunca no repositório.
- Rollback operacional: reimplantar a última versão verde do Worker pelo gate remoto Cloudflare ou reverter a PR do contrato/roteamento e acionar novo dry-run remoto antes de publicar.

O aceite operacional continua remoto: GitHub Actions da PR devem ficar verdes antes de acionar Cloudflare dry-run/deploy/smoke.

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
- `wrangler.toml` declara o Worker público sem segredos;
- `package.json` expõe checks leves de sintaxe e testes de módulo para o gate remoto;
- `tests/gateway.test.js` valida CORS, versão de contrato, sessão pública Aneety e roteamento para service binding simulado.

O aceite operacional continua remoto: GitHub Actions da PR devem ficar verdes antes de acionar Cloudflare dry-run/deploy/smoke.

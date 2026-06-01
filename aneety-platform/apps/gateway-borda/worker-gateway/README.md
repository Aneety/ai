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
- `package.json` expõe checks leves de sintaxe, testes de módulo e validação do contrato de deploy para o gate remoto;
- `tests/gateway.test.js` valida CORS, versão de contrato, sessão pública Aneety e roteamento para service binding simulado;
- `scripts/validate-deploy-contract.mjs` confere que `wrangler.toml` permanece alinhado ao contrato público, sem variáveis com nomes de segredo e com service bindings canônicos.

## Runbook remoto do gate de deploy

O ciclo `deploy` só pode ser aceito pela superfície remota, sem usar `wrangler dev`, servidor local, container ou fallback fora de Cloudflare Workers:

1. Abrir PR a partir de branch `codex/deploy-gateway-borda-*` contra `main`.
2. Aguardar GitHub Actions verdes na PR para `Remote CI gate`, `Governance policy gate` e `Security gate`.
3. Confirmar que o script `deploy:validate` rodou no `Remote CI gate`, garantindo versão de contrato, variáveis públicas e service bindings coerentes antes do dry-run.
4. Após a PR verde, acionar o workflow remoto `Cloudflare deploy gate` em modo `dry-run` com `module_path` igual a `aneety-platform/apps/gateway-borda/worker-gateway`.
5. Registrar no painel operacional o link do PR, o run do gate Cloudflare e a evidência de que `wrangler.toml` foi validado sem segredos antes de avaliar `deploy` como `concluido`.
6. Manter `publicacao`, `backend`, `teste-integracao-api`, `smoke` e `teste` bloqueados até o gate remoto do ciclo `deploy` estar comprovado.

Exemplo de acionamento remoto após checks verdes da PR:

```bash
gh workflow run cloudflare-gate.yml \
  --repo Aneety/ai \
  --ref <branch-da-pr> \
  -f module_path=aneety-platform/apps/gateway-borda/worker-gateway \
  -f mode=dry-run
```


## Ciclo `publicacao`

O ciclo `publicacao` depende de URL real publicada em ambiente remoto permitido. O aceite não pode ser fechado por runtime local, `wrangler dev`, container ou URL fictícia. Para tornar a evidência auditável, este módulo inclui:

- `publication-evidence.example.json`, template sem segredos para registrar URL publicada, runs remotos de deploy/smoke, SHA e versão do contrato;
- `publication-evidence.json`, arquivo canônico versionado pelo scheduler quando o deploy/smoke remoto conclui com sucesso;
- `scripts/validate-publication-evidence.mjs`, validador leve que rejeita URL não HTTPS, hosts locais/de exemplo, parâmetros com aparência de segredo e runs que não sejam do repositório `Aneety/ai`;
- `npm run publication:validate`, comando usado para validar o template ou um arquivo real informado por `ANEETY_PUBLICATION_EVIDENCE_FILE`.

Sequência remota mínima após PR gate verde:

1. Acionar `Cloudflare deploy gate` em modo `deploy` com `module_path=aneety-platform/apps/gateway-borda/worker-gateway`.
2. Registrar a URL HTTPS publicada pelo Worker, sem expor subconta, token ou variável sensível.
3. Acionar `Cloudflare deploy gate` em modo `smoke` com `smoke_url` igual à URL publicada.
4. Criar um arquivo de evidência fora de secrets seguindo `publication-evidence.example.json` e validar com `ANEETY_PUBLICATION_EVIDENCE_FILE=<arquivo> npm run publication:validate`.
5. Atualizar `docs/project/gateway-borda.md` e `docs/project/index.md` com URL real, runs de GitHub Actions/Cloudflare e SHA final antes de marcar `publicacao` como `concluido`.

## Ambiente e rollback

- Variáveis versionadas sem segredo: `ANEETY_ALLOWED_ORIGINS` e `ANEETY_CONTRACT_VERSION`.
- Bindings de serviço esperados no ambiente Cloudflare: `IDENTIDADE_ACESSO`, `TENANT_WHITE_LABEL` e `ONBOARDING_ACESSO`, apontando para BFFs `worker-*` canônicos.
- Segredos, quando existirem em ciclos posteriores dos BFFs, devem ser configurados somente no painel/API Cloudflare e nunca no repositório.
- Rollback operacional: reimplantar a última versão verde do Worker pelo gate remoto Cloudflare ou reverter a PR do contrato/roteamento e acionar novo dry-run remoto antes de publicar.

O aceite operacional continua remoto: GitHub Actions da PR devem ficar verdes antes de acionar Cloudflare dry-run/deploy/smoke.

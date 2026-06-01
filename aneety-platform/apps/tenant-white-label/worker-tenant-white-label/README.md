# worker-tenant-white-label

## Objetivo

Reservar o BFF da responsabilidade `tenant-white-label` para expor contratos HTTP de tenants e branding em ciclos futuros, mantendo desde o ciclo `deploy` uma superfície deployable em Cloudflare Workers.

## Runtime permitido

- Cloudflare Workers é o runtime alvo e único permitido para o MVP.
- Integrações assíncronas, se necessárias no futuro, devem usar mecanismos compatíveis com Workers.
- Não há servidor local, container, Python de runtime MVP, banco externo obrigatório ou fallback fora de Workers para aceite.

## Ciclo `deploy`

Este diretório agora contém uma casca versionável e fechada para o gate remoto de deploy:

- `src/index.js` exporta o handler `fetch` compatível com Cloudflare Workers;
- `wrangler.toml` declara o serviço canônico `worker-tenant-white-label`, sem segredos e sem bindings prematuros;
- `package.json` expõe `lint`, `typecheck`, `build`, `test` e `deploy:validate` para o `Remote CI gate`;
- `tests/worker.test.js` valida saúde, versão de contrato, erro público e ausência de rotas de produto antes dos ciclos `banco`/`backend`;
- `scripts/validate-deploy-contract.mjs` protege nome de serviço, entrypoint, versão pública e variáveis versionadas sem aparência de segredo.

## Contrato de deploy

Rotas versionadas neste ciclo:

- `GET /health` — saúde mínima do Worker, sem exigir versão de contrato.
- `GET /contract` — catálogo público mínimo, exigindo `x-aneety-contract-version: 2026-06-01.tenant-white-label.deploy.v1`.

As rotas de produto de tenants, marca, storage e permissões permanecem fechadas até os ciclos `banco` e `backend`. O contrato de deploy apenas garante que o serviço `worker-tenant-white-label` exista de forma auditável para desbloquear dependências remotas, incluindo o service binding do `worker-gateway`.

## Runbook remoto do gate de deploy

O ciclo `deploy` só pode ser aceito pela superfície remota, sem usar `wrangler dev`, servidor local, container ou fallback fora de Cloudflare Workers:

1. Abrir PR a partir de branch `codex/deploy-tenant-white-label-*` contra `main`.
2. Aguardar GitHub Actions verdes na PR para `Remote CI gate`, `Governance policy gate`, `Security gate` e demais checks aplicáveis.
3. Confirmar que `npm run deploy:validate` rodou no módulo `aneety-platform/apps/tenant-white-label/worker-tenant-white-label`.
4. Após a PR verde, acionar o workflow remoto `Cloudflare deploy gate` em modo `dry-run` com `module_path` igual a `aneety-platform/apps/tenant-white-label/worker-tenant-white-label`.
5. Registrar no painel operacional o link do PR, o run do gate Cloudflare, o SHA validado e a confirmação de que não houve segredo versionado antes de marcar `deploy` como `concluido`.
6. Manter `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke` e `teste` bloqueados até o gate remoto do ciclo `deploy` estar comprovado.

Exemplo de acionamento remoto após checks verdes da PR:

```bash
gh workflow run cloudflare-gate.yml \
  --repo Aneety/ai \
  --ref <branch-da-pr> \
  -f module_path=aneety-platform/apps/tenant-white-label/worker-tenant-white-label \
  -f mode=dry-run
```


## Ciclo `publicacao`

O ciclo `publicacao` depende de URL HTTPS real publicada pelo gate remoto permitido. O aceite não pode ser fechado por runtime local, `wrangler dev`, container, URL fictícia ou fallback fora de Cloudflare Workers. Para deixar a evidência auditável quando o scheduler publicar o Worker, este módulo inclui:

- `publication-evidence.example.json`, template sem segredos para registrar URL publicada, runs remotos de deploy/smoke, SHA e versão do contrato;
- `publication-evidence.json`, arquivo canônico versionado pelo scheduler somente quando o deploy/smoke remoto concluir com sucesso;
- `scripts/validate-publication-evidence.mjs`, validador leve que rejeita URL não HTTPS, hosts locais/de exemplo, parâmetros com aparência de segredo e runs que não sejam do repositório `Aneety/ai`;
- `npm run publication:validate`, comando usado para validar o template ou um arquivo real informado por `ANEETY_PUBLICATION_EVIDENCE_FILE`.

Sequência remota mínima após PR gate verde:

1. Confirmar que `tenant-white-label/deploy` segue `concluido` no painel operacional, com `Cloudflare deploy gate` em modo `dry-run` já registrado.
2. Acionar `Cloudflare deploy gate` em modo `deploy` com `module_path=aneety-platform/apps/tenant-white-label/worker-tenant-white-label`.
3. Registrar a URL HTTPS publicada pelo Worker, sem expor subconta, token ou variável sensível.
4. Acionar `Cloudflare deploy gate` em modo `smoke` com `smoke_url` igual à URL publicada e validar `/health` e `/contract` com a versão pública do contrato.
5. Criar um arquivo de evidência fora de secrets seguindo `publication-evidence.example.json` e validar com `ANEETY_PUBLICATION_EVIDENCE_FILE=<arquivo> npm run publication:validate`.
6. Atualizar `docs/project/tenant-white-label.md` e `docs/project/index.md` com URL real, runs de GitHub Actions/Cloudflare e SHA final antes de marcar `publicacao` como `concluido`.

## Ambiente e rollback de publicação

- Variáveis versionadas sem segredo: `ANEETY_CONTRACT_VERSION` e `ANEETY_SERVICE_NAME`.
- A publicação inicial não introduz binding, segredo, banco ou rota administrativa antes dos ciclos `banco` e `backend`.
- Segredos, quando existirem em ciclos posteriores, devem ser configurados somente no painel/API Cloudflare e nunca no repositório.
- Rollback operacional: reimplantar a última versão verde do Worker pelo gate remoto Cloudflare ou reverter a PR do contrato/roteamento e acionar novo dry-run remoto antes de publicar.

O aceite operacional continua remoto: GitHub Actions da PR devem ficar verdes antes de acionar Cloudflare deploy/smoke.

## Dados e contratos futuros

- O worker deverá controlar acesso administrativo a tenants e marca por permissão.
- O frontend não pode acessar banco, storage privilegiado, segredo ou fornecedor externo diretamente.
- Erros de domínio devem ser expostos por contrato público sem vazar detalhe técnico.
- As fronteiras `tenant` e `tenant_branding` já aparecem no catálogo de deploy apenas como escopo de responsabilidade; DDL/storage real pertence ao ciclo `banco`.

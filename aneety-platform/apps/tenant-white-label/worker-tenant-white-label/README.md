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

## Dados e contratos futuros

- O worker deverá controlar acesso administrativo a tenants e marca por permissão.
- O frontend não pode acessar banco, storage privilegiado, segredo ou fornecedor externo diretamente.
- Erros de domínio devem ser expostos por contrato público sem vazar detalhe técnico.
- As fronteiras `tenant` e `tenant_branding` já aparecem no catálogo de deploy apenas como escopo de responsabilidade; DDL/storage real pertence ao ciclo `banco`.

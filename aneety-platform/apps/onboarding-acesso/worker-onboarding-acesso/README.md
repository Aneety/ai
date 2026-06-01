# worker-onboarding-acesso

## Objetivo

Reservar o BFF da responsabilidade `onboarding-acesso` para expor contratos HTTP de convite, primeiro acesso, confirmação de contato, recuperação e lifecycle, mantendo desde o ciclo `deploy` uma superfície deployable em Cloudflare Workers.

## Runtime permitido

- Cloudflare Workers é o runtime alvo e único permitido para o MVP.
- Integrações assíncronas, se necessárias no futuro, devem usar mecanismos compatíveis com Workers.
- Não há servidor local, container, Python de runtime MVP, banco externo obrigatório ou fallback fora de Workers para aceite.

## Ciclo `deploy`

Este diretório agora contém uma casca versionável e fechada para o gate remoto de deploy:

- `src/index.js` exporta o handler `fetch` compatível com Cloudflare Workers;
- `wrangler.toml` declara o serviço canônico `worker-onboarding-acesso`, sem segredos e sem bindings prematuros;
- `package.json` expõe `lint`, `typecheck`, `build`, `test` e `deploy:validate` para o `Remote CI gate`;
- `tests/worker.test.js` valida saúde, versão de contrato, erro público e ausência de rotas de produto antes dos ciclos `banco`/`backend`;
- `scripts/validate-deploy-contract.mjs` protege nome de serviço, entrypoint, versão pública e variáveis versionadas sem aparência de segredo.

## Contrato de deploy

Rotas versionadas neste ciclo:

- `GET /health` — saúde mínima do Worker, sem exigir versão de contrato.
- `GET /contract` — catálogo público mínimo, exigindo `x-aneety-contract-version: 2026-06-01.onboarding-acesso.deploy.v1`.

As rotas de produto para convites, primeiro acesso, confirmação, recuperação e lifecycle permanecem fechadas até os ciclos `banco` e `backend`. O contrato de deploy apenas garante que o serviço `worker-onboarding-acesso` exista de forma auditável para desbloquear dependências remotas, incluindo o service binding do `worker-gateway`.

## Runbook remoto do gate de deploy

O ciclo `deploy` só pode ser aceito pela superfície remota, sem usar `wrangler dev`, servidor local, container ou fallback fora de Cloudflare Workers:

1. Abrir PR a partir de branch `codex/deploy-onboarding-acesso-*` contra `main`.
2. Aguardar GitHub Actions verdes na PR para `Remote CI gate`, `Governance policy gate`, `Security gate` e demais checks aplicáveis.
3. Confirmar que `npm run deploy:validate` rodou no módulo `aneety-platform/apps/onboarding-acesso/worker-onboarding-acesso`.
4. Após a PR verde, acionar o workflow remoto `Cloudflare deploy gate` em modo `dry-run` com `module_path` igual a `aneety-platform/apps/onboarding-acesso/worker-onboarding-acesso`.
5. Registrar no painel operacional o link do PR, o run do gate Cloudflare, o SHA validado e a confirmação de que não houve segredo versionado antes de marcar `deploy` como `concluido`.
6. Manter `publicacao`, `banco`, `backend`, `teste-integracao-api`, `microfrontend`, `smoke` e `teste` bloqueados até o gate remoto do ciclo `deploy` estar comprovado.

Exemplo de acionamento remoto após checks verdes da PR:

```bash
gh workflow run cloudflare-gate.yml \
  --repo Aneety/ai \
  --ref <branch-da-pr> \
  -f module_path=aneety-platform/apps/onboarding-acesso/worker-onboarding-acesso \
  -f mode=dry-run
```

## Dados e contratos futuros

- O worker deverá validar convite, expiração, recuperação e bloqueio sem expor token bruto, segredo, banco ou provider externo.
- O frontend não pode acessar banco, storage privilegiado, segredo ou fornecedor externo diretamente.
- Erros de domínio devem orientar o usuário em linguagem operacional, preservando detalhes técnicos e sensíveis.
- As fronteiras `onboarding_invites`, `first_access_tokens`, `contact_confirmations`, `recovery_tokens` e `access_lifecycle_audit` já aparecem no catálogo de deploy apenas como escopo de responsabilidade; DDL/storage real pertence ao ciclo `banco`.

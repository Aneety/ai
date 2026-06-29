# Gate CI remoto antes de deploy Cloudflare

Este repositório usa GitHub Actions como primeiro gate obrigatório para compilar, validar e auditar módulos do monorepo antes de qualquer execução Cloudflare com efeito operacional.

## Fluxo obrigatório

1. Abrir ou atualizar PR.
2. Aguardar os workflows `Remote CI gate`, `Governance policy gate` e `Security gate` no GitHub Actions.
3. Se algum workflow falhar, ler logs/checks da PR, corrigir localmente e fazer novo push.
4. Só iniciar `Cloudflare deploy gate` quando compilação, lint, typecheck, build, testes de módulo, política e segurança estiverem verdes na PR.
5. Validar `docs/ai-guardrails/cost-proofs/current-services.json` antes de qualquer Cloudflare dry-run, deploy, smoke, merge, fechamento ou conclusão final.
6. Depois do deploy, executar smoke, testes integrados de API ou e2e contra a URL publicada.

Resumo: PR -> GitHub Actions -> prova custo zero -> Cloudflare -> smoke/API/e2e publicado.

## O que roda no GitHub Actions

- `ci.yml`: descobre módulos em `aneety-platform/apps/**`, detecta package manager, instala dependências em runner remoto, executa `lint`, `typecheck`, `build` e `test` quando existirem.
- `policy.yml`: valida workflows, arquivos obrigatórios, assets Mermaid, proibições de runtime MVP e vazamento técnico em copy de UI.
- `security.yml`: executa dependency review, CodeQL quando houver fonte compatível e varredura textual de segredos sem imprimir valores.
- `cloudflare-gate.yml`: executa dry-run, deploy manual explícito ou smoke de URL publicada somente depois de CI verde ou por acionamento manual controlado. Quando um módulo publicado tiver `npm run smoke:published`, o gate executa esse smoke funcional além de `/health` e `/contract`.
- `governance.yml`: audita periodicamente `docs/`, workflows, PRs e drift, publicando resumo como artifact/check summary sem auto-commit.
- `validate-cost-proof.mjs`: valida o contrato versionado de custo zero antes de publicação e aceite.

## Restrições operacionais

- Não usar deploy Cloudflare como verificador de compilação ou lint.
- Não gastar ciclos Cloudflare com falhas que o GitHub Actions consegue detectar antes.
- Não usar serviço pago, serviço sem preço oficial verificado, prova expirada ou consumo projetado acima da franquia gratuita.
- Não usar execução local pesada como evidência final de aceite.
- Não usar Podman, Docker, containers, servidor local persistente, Python de runtime MVP, Playwright/Cypress local ou Wrangler local para fechar aceite do MVP.
- Manter o MVP em runtime 100% compatível com Cloudflare Workers.
- Usar máquina local apenas para inspeção, edição, Git, leitura de logs/checks e validações leves/determinísticas.

## Evidência mínima

Antes de deploy, a PR deve mostrar checks verdes de compilação/lint/teste, política e segurança, incluindo a prova de custo zero vigente. Depois do deploy, a evidência deve apontar para a URL real testada, o resultado dos testes de smoke/API/e2e e o `costProofRef` usado. Para `worker-relatorios`, o smoke funcional obrigatório é `POST /reports/pdf`, validando status 200, `Content-Type: application/pdf`, bytes iniciando em `%PDF` e header `X-Browser-Ms-Used` dentro do limite do contrato.

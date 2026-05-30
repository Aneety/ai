# Aneety AI

Repositório canônico da plataforma Aneety.

Este monorepo concentra documentação, backlog operacional, assets reutilizáveis, módulos por responsabilidade, workflows, PRs, checks e evidências da nova linha Aneety. O código dos repositórios históricos Lia não foi importado; a linha Lia permanece apenas como fonte histórica de aprendizado, decisões e massas de demonstração.

## Fontes canônicas

- `docs/` — documentação normativa da plataforma, incluindo arquitetura, requisitos, processos, modelagem, governança e planejamento.
- `docs/project/` — painel operacional versionado com status, owner, evidência, bloqueio e próxima ação por responsabilidade.
- `assets/` — assets reutilizáveis da plataforma, sempre com fonte SVG quando aplicável.
- `aneety-platform/apps/` — raiz dos módulos internos por responsabilidade.

## Regra de implementação

Cada responsabilidade com implementação própria deve nascer como módulo interno em `aneety-platform/apps/<responsabilidade>/...`, seguindo o contrato publicado em `docs/`. Separação em repositório próprio fica fora do contrato atual do MVP e só pode acontecer depois de atualização documental aprovada.

Este monorepo pode ser usado nesta máquina local para gerar, editar, revisar e versionar código fonte, contratos, documentação e artefatos de controle.

## Regra de validação

Para o MVP, compilação, lint, typecheck, build e testes de módulo devem passar primeiro no GitHub Actions da PR. O workflow remoto é o gate inicial para economizar máquina local e evitar gastar limite Cloudflare com falhas detectáveis antes do deploy.

Deploy Cloudflare só deve acontecer depois da PR verde em compilação, lint, testes de módulo, política e segurança. Após o deploy, smoke, testes integrados de API ou e2e devem rodar contra a URL publicada. O processo operacional está em [`docs/remote-ci-gate.md`](docs/remote-ci-gate.md).

Não usar deploy Cloudflare como verificador de compilação ou lint. Não usar execução local pesada como evidência final de aceite do MVP. Simulações locais, servidores persistentes, containers, Python, Playwright/Cypress local, Wrangler local para aceite, VPS, banco externo obrigatório ou runtime fora de Cloudflare Workers não substituem validação remota aprovada.

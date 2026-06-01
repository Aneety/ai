# Painel operacional em Markdown

`docs/project` é a fonte única de backlog, status, owner, evidência e bloqueio da Aneety Platform. O painel operacional anterior foi descontinuado para uso diário. GitHub Issues e PRs continuam apenas como histórico, discussão e vínculo de evidência quando necessário.

## Método

- Atualize primeiro o arquivo da responsabilidade antes de mudar status operacional em qualquer outro lugar.
- Use sempre os campos canônicos: `Status`, `Ciclo`, `Responsabilidade`, `Repo destino`, `Owner`, `Prioridade`, `Gate`, `Evidência`, `Bloqueio`.
- Trate GitHub Issues como trilha histórica; não como painel ativo de status.

## Visão executiva

| Responsabilidade | Owner | Prioridade | Ciclo ativo | Status | Arquivo | Evidência atual | Bloqueio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `gateway-borda` | Ricardo Malnati | alta | `deploy` | `bloqueado` | [gateway-borda](./gateway-borda.md) | Commit local na branch `codex/deploy-gateway-borda-remote-gate-runbook` documenta o runbook remoto do `worker-gateway` para PR, GitHub Actions verdes e `Cloudflare deploy gate` em `dry-run`. | Push para `origin` falhou com `403 Permission to Aneety/ai.git denied to Malnati`; sem PR/checks remotos e sem Cloudflare gate oficial. |
| `tenant-white-label` | Ricardo Malnati | alta | `deploy` | `pronto` | [tenant-white-label](./tenant-white-label.md) | [PR #19](https://github.com/Aneety/ai/pull/19) cria a raiz física e scaffolds mínimos, já mergeada em `main`. | — |
| `identidade-acesso` | Ricardo Malnati | alta | `deploy` | `pronto` | [identidade-acesso](./identidade-acesso.md) | [PR #22](https://github.com/Aneety/ai/pull/22) cria a raiz física e scaffolds mínimos, já mergeada em `main`. | — |
| `onboarding-acesso` | Ricardo Malnati | alta | `deploy` | `pronto` | [onboarding-acesso](./onboarding-acesso.md) | [PR #24](https://github.com/Aneety/ai/pull/24) cria a raiz física e scaffolds mínimos, já mergeada em `main`. | — |
| `pedidos-customizados` | Ricardo Malnati | alta | `repositorio` | `bloqueado` | [pedidos-customizados](./pedidos-customizados.md) | Issue histórica #7 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `workflow-estados` | Ricardo Malnati | alta | `repositorio` | `bloqueado` | [workflow-estados](./workflow-estados.md) | Issue histórica #8 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `catalogo-operacional` | Ricardo Malnati | alta | `repositorio` | `bloqueado` | [catalogo-operacional](./catalogo-operacional.md) | Issue histórica #9 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `identidade-federada` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [identidade-federada](./identidade-federada.md) | Issue histórica #11 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `qualidade-evidencias` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [qualidade-evidencias](./qualidade-evidencias.md) | Issue histórica #12 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `pagamentos` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [pagamentos](./pagamentos.md) | Issue histórica #13 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `offline-sync` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [offline-sync](./offline-sync.md) | Issue histórica #14 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `marketplace-operacional` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [marketplace-operacional](./marketplace-operacional.md) | Issue histórica #15 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `producao-execucao` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [producao-execucao](./producao-execucao.md) | Issue histórica #16 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `logistica-rastreabilidade` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [logistica-rastreabilidade](./logistica-rastreabilidade.md) | Issue histórica #18 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `auditoria-operacional` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [auditoria-operacional](./auditoria-operacional.md) | Issue histórica #19 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `sla-capacidade` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [sla-capacidade](./sla-capacidade.md) | Issue histórica #20 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `orcamentos-precificacao` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [orcamentos-precificacao](./orcamentos-precificacao.md) | Issue histórica #21 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `comunicacao-operacional` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [comunicacao-operacional](./comunicacao-operacional.md) | Issue histórica #22 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `comunicacao-email` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [comunicacao-email](./comunicacao-email.md) | Issue histórica #23 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `suporte-excecoes` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [suporte-excecoes](./suporte-excecoes.md) | Issue histórica #24 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `privacidade-consentimento` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [privacidade-consentimento](./privacidade-consentimento.md) | Issue histórica #25 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |
| `demo-seeds` | Ricardo Malnati | media | `repositorio` | `bloqueado` | [demo-seeds](./demo-seeds.md) | Issue histórica #26 + inspeção local 2026-05-30 | Sem raiz em `Aneety/ai`; checkout local limpo, bloqueio agora é estrutural. |

## Bloqueios globais

- `gateway-borda`, `tenant-white-label`, `identidade-acesso` e `onboarding-acesso` já possuem raiz canônica em `aneety-platform/apps/<responsabilidade>/...`. As demais responsabilidades seguem sem raiz concreta em `aneety-platform/apps/<responsabilidade>/...`.
- Painel operacional ativo consolidado em `Aneety/ai/docs/project`; não há dependência de painel fora do repositório para status, owner, evidência ou bloqueio.
- `Aneety/ai` concentra workflows/checks, documentação, backlog e assets; mudanças passam pelo gate remoto deste repositório.
- GitHub Actions em `main` seguem verdes, mas `gh run view 26675134837` e `26675141018` registraram anotação objetiva de depreciação Node.js 20 em `actions/checkout@v4` e `actions/setup-node@v4`; próxima ação mínima é abrir PR de workflow para remover esse risco antes do corte informado pelo GitHub.

## Últimas atualizações

- 2026-05-30 — transição definida: `Aneety/ai` passa a concentrar documentação, backlog operacional, assets, PRs, checks e evidências.
- 2026-05-30 — `docs/project` neste repositório segue como fonte única de backlog operacional; nenhuma consulta a painel fora do repositório é necessária.
- 2026-05-30 — PR [#7](https://github.com/Aneety/ai/pull/7) já está mergeada em `Aneety/ai`; `gh pr checks 7 --repo Aneety/ai` e `gh run view` confirmaram `Governance audit`, `Security gate`, `Remote CI gate`, `Governance policy gate` e `Cloudflare deploy gate` verdes entre o PR `codex/ai-canonical-transition` e o push em `main` no SHA `33620f5b834a`.
- 2026-05-30 — `gateway-borda` conclui o ciclo `repositorio` pela PR #14; demais responsabilidades seguem bloqueadas em `repositorio` por falta de raiz canônica.
- 2026-05-31 — `gateway-borda` avança o ciclo `deploy` para `validacao` com Worker deployable, contrato público versionado, service bindings canônicos, plano de rollback e configuração Wrangler sem segredos aguardando PR/checks remotos e Cloudflare gate.
- 2026-06-01 — `gateway-borda` mantém `deploy` bloqueado por permissão remota: o `worker-gateway` já possui cobertura leve de CORS, versão de contrato e binding ausente, e esta execução documenta o runbook remoto para PR, GitHub Actions verdes e `Cloudflare deploy gate` em `dry-run`, mas o push para `origin` falhou com `403 Permission to Aneety/ai.git denied to Malnati`.
- 2026-05-31 — `tenant-white-label`, `identidade-acesso` e `onboarding-acesso` concluem `repositorio` pelas PRs [#19](https://github.com/Aneety/ai/pull/19), [#22](https://github.com/Aneety/ai/pull/22) e [#24](https://github.com/Aneety/ai/pull/24), todas mergeadas em `main`, e passam a ter `deploy` como próximo ciclo acionável.

- 2026-05-30 — monitoramento Codex Cloud registrado em [`controller-monitoring-2026-05-30.md`](./controller-monitoring-2026-05-30.md): `gh` autenticado para leitura, nenhum PR aberto no momento da consulta, workflows ativos listados, últimos runs de `main` verdes no SHA `1a039111882ee949722bd3980c4f6550d323fa32`, 22 responsabilidades ainda bloqueadas em `repositorio` por falta de raízes canônicas, e push/PR remoto bloqueado por `403 Permission to Aneety/ai.git denied to Malnati`.

## Governança mínima de atualização

1. Confirmar fonte documental e critério de aceite.
2. Atualizar `docs/project/<responsabilidade>.md` no mesmo branch da mudança.
3. Linkar PR, commit, log, screenshot ou doc na coluna `Evidência`.
4. Registrar bloqueio com causa objetiva e próxima ação.
5. Atualizar esta visão executiva quando `Status`, `Owner`, `Prioridade` ou `Ciclo ativo` mudarem.

## Histórico de migração

- Issue histórica de governança do painel anterior: Issue histórica #3.
- Issues históricas de `ciclo:repositorio` já foram migradas para arquivos por responsabilidade e encerradas; o status ativo continua apenas em `docs/project/`.

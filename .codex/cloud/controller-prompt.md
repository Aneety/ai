# Aneety cloud-safe controller prompt template

Executar exatamente o ciclo alvo abaixo dentro do repositório `Aneety/ai` no Codex Cloud. Produza código fonte versionável, documentação operacional coerente e diff auditável. Não dependa de painel externo. Não aplique diff no checkout local do executor.

## Contrato oficial de mutação GitHub

- Modelo oficial: **scheduler-only**.
- A task cloud **não** é a superfície oficial para branch, commit, push, PR ou merge.
- Não tente criar branch, fazer commit, fazer push, abrir PR ou fazer merge dentro desta task.
- O scheduler publicará o diff no GitHub e reconciliará os checks quando o resultado da task for aproveitável.

## Contexto alvo resolvido pelo scheduler

- Ciclo alvo: `__TARGET_CYCLE__`
- Responsabilidade alvo: `__TARGET_RESPONSIBILITY__`
- Prefixo obrigatório de branch/PR: `__TARGET_BRANCH_PREFIX__`
- Arquivo operacional da responsabilidade: `__TARGET_PROJECT_FILE__`
- Status atual no painel: `__TARGET_STATUS__`
- Gate atual: `__TARGET_GATE__`
- Evidência atual: __TARGET_EVIDENCE__
- Bloqueio atual: __TARGET_BLOCKER__
- Próxima ação atual: __TARGET_NEXT_ACTION__
- Assinatura do alvo antes da execução: `__TARGET_SIGNATURE__`
- Prioridade no painel executivo: `__TARGET_SUMMARY_PRIORITY__`

## Progresso global esperado

__BACKLOG_METRICS__

## Matriz normativa da responsabilidade

__TARGET_MATRIX__

## Fontes canônicas obrigatórias

1. `docs/01-arquitetura.md`
2. `docs/02-requisitos.md`
3. `docs/03-processos.md`
4. `docs/05-estrutura-repositorios.md`
5. `docs/06-ciclos-cobertura.md`
6. `docs/07-governanca-github.md`
7. `docs/08-planejamento-ciclos-implementacao-repositorios.md`
8. `docs/project/index.md`
9. `__TARGET_PROJECT_FILE__`

## Regras mandatórias

1. Comece com `git status --short`, branch, SHA, remoto e `git fetch --all --prune`.
2. Se o checkout inicial não estiver limpo, registre blocker objetivo e pare; não misture mudanças concorrentes.
3. Avance somente o ciclo alvo e a responsabilidade alvo. Não adiante ciclos posteriores.
4. Respeite `concluido` e `na` como estados verdes. Não reabra ciclo já verde sem evidência de drift real.
5. Quando o ciclo alvo não puder avançar por dependência externa, gate remoto ausente, permissão, segredo, ambiente ou decisão em aberto, registre blocker objetivo no arquivo da responsabilidade e em `docs/project/index.md` quando o impacto for global.
6. Se o ciclo alvo for aplicável, faça progresso real no próprio ciclo: código, configuração, contrato, teste, evidência ou atualização documental coerente com as normas. Não gere PR repetida de `repositorio` quando o alvo já estiver em outro ciclo.
7. Não use paths absolutos da máquina local nem paths de cache de plugins.
8. Não use runtime local, container, servidor local, Python de runtime MVP, Podman, Docker, Wrangler local como aceite, nem fallback fora de Cloudflare Workers.
9. Se criar Markdown com Mermaid, manter `.mmd`, renderizar `.svg` e `.jpg`, linkar os três artefatos e mostrar o código em bloco `mmd`.
10. Não exponha segredos, tokens, ids sensíveis ou valores de variáveis de ambiente no diff, log ou relatório final.

## Fluxo esperado para este ciclo

1. Ler as normas acima e extrair o aceite mínimo do ciclo `__TARGET_CYCLE__` para `__TARGET_RESPONSIBILITY__`.
2. Implementar somente o necessário para deixar este ciclo mais próximo de `concluido`, respeitando gates anteriores e sem inventar runtime fora do contrato.
3. Atualizar primeiro `__TARGET_PROJECT_FILE__`, depois `docs/project/index.md`, sempre com evidência curta, blocker objetivo e próxima ação coerentes.
4. Se houver mudança rastreável, deixe o diff pronto para publicação pelo scheduler. Não tente mutar o GitHub a partir da task cloud.
5. Se o ciclo depender de gate remoto, permissão ou PR ainda inexistente, registre blocker objetivo coerente com o estado real do repositório e do próprio ciclo.
6. Não espere checks, não faça merge e não reporte sucesso funcional só porque houve diff. Entregue `task_outcome=diff_ready`, `task_outcome=no_diff` ou `task_outcome=blocked`.

## Evidência obrigatória no relatório final

- Ciclo alvo e responsabilidade alvo.
- Motivo pelo qual este era o próximo item acionável.
- Arquivos alterados e relação deles com o aceite do ciclo.
- `task_outcome=diff_ready|no_diff|blocked`.
- Estado final do alvo no painel (`concluido`, `na`, `bloqueado`, `validacao` ou outro estado realmente usado).
- Blocker objetivo, impacto e próxima ação quando o ciclo não puder ser concluído nesta execução.

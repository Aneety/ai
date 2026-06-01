# Agendamento externo do controlador no Codex Cloud

Este documento descreve o caminho v1 para agendar o controlador Aneety via Codex Cloud e monitorar esse agendamento pela automação local do Codex App.

## Estado atual

- O modo Codex Cloud foi aceito em `docs/project/codex-cloud-validation-2026-05-30.md`.
- A automação local do Codex App fica ativa somente como monitor do agendamento; ela não submete task, não inicia scheduler, não cria PR e não faz merge.
- O agendamento Node.js externo deve chamar `codex cloud exec` contra o ambiente Codex Cloud já validado.
- A task remota deve gerar apenas diff auditável e relatório coerente com `docs/project`; branch/commit/push/PR/merge oficiais são sempre responsabilidade do scheduler via worktree isolado e `gh`, sem tocar no checkout canônico.
- O wrapper foi validado com tasks `READY`; o scheduler roda em worktree isolado para evitar aplicar diffs no checkout canônico.
- Quando existir PR operacional do controlador no padrão `codex/<ciclo>-<responsabilidade>-<YYYY-MM-DD>`, o scheduler entra em reconciliação: consulta checks obrigatórios, aguarda o gate remoto, faz squash merge automático, apaga a branch remota e registra o SHA final de `main`.
- Para blockers `remote_automable`, o scheduler pode acionar GitHub Actions remotos após reavaliar `origin/main`, sem criar task cloud nova: primeiro resolve dependências automáveis declaradas na matriz quando elas não estiverem verdes, depois executa `deploy`, `smoke` e só então abre PR operacional com a evidência versionada.

## Scripts versionados

- `.codex/cloud/submit-controller-task.sh` — submete uma task usando `.codex/cloud/controller-prompt.md`.
- `.codex/cloud/watch-task.sh` — acompanha uma task até `READY` ou falha; permanece disponível para inspeção/manual, mas o scheduler paralelo usa polling do pool rastreado em `runtime-state.json`.
- `.codex/cloud/publish-task-diff.sh` — publica o diff de uma task `READY` em branch/commit/PR usando somente worktree isolado; recusa execução no checkout canônico por padrão.
- `.codex/cloud/reconcile-controller-pr.mjs` — reconcilia PR operacional aberta, classifica `pending|failed|merge_ready|merged|timeout` e executa squash merge automático quando permitido.
- `.codex/cloud/remote-gate.mjs` — dispara workflows remotos suportados, aguarda conclusão, baixa o artefato JSON do run e prepara a evidência operacional versionada.
- `.codex/cloud/publish-operational-update.sh` — publica PR operacional criada pelo próprio scheduler após gates remotos concluídos.
- `.codex/cloud/scheduler.mjs` — agendador Node.js com `node-cron`, resolvendo a janela paralela de targets independentes, submetendo até `CODEX_CLOUD_MAX_PARALLEL_TASKS` tasks cloud por vez, mantendo PR/publicação/merge serializados em worktree isolado fora do checkout canônico e registrando o pool em `runtime-state.json`.
- `.codex/cloud/monitor-scheduler.mjs` — monitor local do agendamento, do arquivo de ambiente, do processo scheduler, do worktree isolado, das tasks Codex Cloud recentes e do estado derivado do backlog/pool (`controller_progress_state`, `scheduler_functional_state`, `active_task_count`, `publish_queue_count`, `tracked_ready_task_count`, `last_success_age_seconds`, `backlog_completion_state`).

## Variáveis do agendador

Obrigatórias:

- `CODEX_CLOUD_ENV_ID`: id do ambiente Codex Cloud validado.

Opcionais:

- `CODEX_CLOUD_BRANCH`: branch usada na task; padrão `main`.
- `CODEX_CLOUD_ATTEMPTS`: tentativas best-of-N; padrão `1`.
- `CODEX_CLOUD_PROMPT_FILE`: prompt da task; padrão `.codex/cloud/controller-prompt.md`.
- `CODEX_CLOUD_CLI`: comando do Codex CLI; se ausente, os wrappers preferem `/opt/homebrew/bin/codex` quando existir e depois `codex`. Use quando o binário global estiver antigo, por exemplo `npx --yes --package @openai/codex@latest codex`.
- `CODEX_CLOUD_WATCH_INTERVAL`: intervalo em segundos para o watcher; padrão `30`.
- `CODEX_CLOUD_WATCH_MAX_POLLS`: número máximo de leituras; padrão `40`.
- `CODEX_CLOUD_ENV_FILE`: arquivo local carregado pelo agendador Node.js; padrão `$HOME/.codex/automations/aneety-project-hourly-controller/cloud-env.sh`.
- `CODEX_CLOUD_WORKTREE_DIR`: worktree isolado usado pelo agendador para submit/watch; padrão `$HOME/.codex/automations/aneety-project-hourly-controller/scheduler-worktree/ai`.
- `CODEX_CLOUD_SCHEDULE`: expressão cron do agendador Node.js; padrão `*/30 * * * *`.
- `CODEX_CLOUD_SCHEDULE_TZ`: timezone do agendador Node.js; padrão `America/Asuncion`.
- `CODEX_CLOUD_AUTO_PUBLISH_DIFF`: publica o diff `READY` como PR pelo worktree isolado; padrão ligado. Use `0` para desativar.
- `CODEX_CLOUD_AUTO_MERGE`: habilita merge automático pelo scheduler; padrão ligado.
- `CODEX_CLOUD_AUTO_MERGE_METHOD`: estratégia de merge; padrão `squash`.
- `CODEX_CLOUD_PR_WATCH_INTERVAL`: intervalo em segundos para reconciliar checks da PR; padrão `30`.
- `CODEX_CLOUD_PR_WATCH_MAX_POLLS`: máximo de leituras dos checks da PR no mesmo ciclo; padrão `60`.
- `CODEX_CLOUD_MAX_PARALLEL_TASKS`: limite de tasks cloud simultâneas rastreadas pelo scheduler; padrão `4`.
- `CODEX_CLOUD_AUTO_DELETE_BRANCH`: apaga branch remota depois do merge; padrão ligado.
- `CODEX_CLOUD_GITHUB_REPO`: repositório usado pelo publicador de PR; padrão `Aneety/ai`.
- `CODEX_CLOUD_PUBLISH_USE_ENV_GH_TOKEN`: usar `GH_TOKEN` do ambiente para criar PR; padrão desligado para preferir a sessão `gh` do keychain local, evitando tokens de ambiente com permissão incompleta para pull requests.
- `CODEX_CLOUD_PUBLISH_WORKTREE_DIR`: worktree autorizado para aplicar diff antes do push; por padrão acompanha `CODEX_CLOUD_WORKTREE_DIR`.
- `CODEX_CLOUD_STATE_FILE`: arquivo local de estado runtime do scheduler/monitor; padrão `$HOME/.codex/automations/aneety-project-hourly-controller/runtime-state.json`.

## Campos mínimos esperados em `runtime-state.json`

O arquivo local de estado deve preservar saúde operacional entre ciclos, incluindo no mínimo:

- `lastScheduledSlotAt`
- `lastCycleStartedAt`
- `lastCycleState`
- `lastTaskId`
- `lastTaskCompletedAt`
- `activeTasks[]`
- `publishQueue[]`
- `lastPrNumber`
- `lastPrUrl`
- `lastMergedPrNumber`
- `lastMergedSha`
- `lastMergedAt`
- `lastError`
- `lastActionableResponsibility`
- `lastActionableCycle`
- `lastMutationSurface`
- `healthState`
- `lastFunctionalState`
- `lastPauseStatus`
- `lastPauseReason`
- `lastRemoteAction`
- `lastRemoteActionState`
- `lastRemoteDeployRunId`
- `lastRemoteDeployUrl`
- `lastPublishedUrl`
- `lastRemoteSmokeRunId`
- `lastRemoteSmokeUrl`
- `lastRemoteConclusion`
- `lastDependencyParentResponsibility`
- `lastDependencyParentCycle`
- `lastDependencyTargetResponsibility`
- `lastDependencyTargetCycle`
- `lastDependencyReason`
- `lastDependencyState`
- `lastParallelLimit`
- `lastActiveTaskCount`
- `lastPublishQueueCount`
- `lastTrackedReadyTaskCount`
- `lastSupersededTaskCount`
- `lastActiveDependencyChainCount`
- `lastParallelEligibleTargets`
- `lastParallelExcludedTargets`

`npm run codex-cloud:scheduler:dry-run` pode atualizar somente campos próprios de pré-checagem, como `lastDryRunAt`, sem apagar os campos operacionais acima.

## Pré-requisito do executor

O executor externo precisa ter Codex CLI com suporte a `codex cloud exec`. Se `codex cloud exec --help` falhar, atualize o CLI ou configure `CODEX_CLOUD_CLI` para um comando mais novo antes de agendar.

## Execução manual

```sh
CODEX_CLOUD_ENV_ID='<env-id>' .codex/cloud/submit-controller-task.sh
```


Quando o `codex` global ainda não expõe `cloud exec`, use:

```sh
CODEX_CLOUD_CLI='npx --yes --package @openai/codex@latest codex' CODEX_CLOUD_ENV_ID='<env-id>' .codex/cloud/submit-controller-task.sh
```

O comando imprime a URL da task. Para acompanhar:

```sh
.codex/cloud/watch-task.sh '<task-id>'
```

## Agendamento com Node.js

Use um executor persistente que consiga executar o Codex CLI autenticado e preservar `CODEX_CLOUD_ENV_ID`, por exemplo:

```sh
cd /path/to/Aneety/ai
CODEX_CLOUD_ENV_ID='<env-id>' .codex/cloud/submit-controller-task.sh
```

O caminho recomendado é o agendador Node.js versionado. Antes de iniciar, crie um arquivo local fora do repositório com permissão restrita:

```sh
mkdir -p "$HOME/.codex/automations/aneety-project-hourly-controller"
umask 077
cat > "$HOME/.codex/automations/aneety-project-hourly-controller/cloud-env.sh" <<'EOF'
export CODEX_CLOUD_ENV_ID='<env-id>'
export CODEX_CLOUD_BRANCH='main'
export CODEX_CLOUD_ATTEMPTS='1'
export CODEX_CLOUD_WATCH_INTERVAL='30'
export CODEX_CLOUD_WATCH_MAX_POLLS='40'
EOF
chmod 600 "$HOME/.codex/automations/aneety-project-hourly-controller/cloud-env.sh"
```

Instale as dependências e valide sem submeter task:

```sh
npm ci
npm run codex-cloud:scheduler:dry-run
```

O `dry-run` valida submit/watch/status, a presença do helper de reconciliação e a capacidade de preparar o worktree isolado sem submeter task real.

Para executar uma vez e acompanhar até estado final:

```sh
npm run codex-cloud:scheduler:once
```

Para iniciar o agendador recorrente:

```sh
npm run codex-cloud:scheduler
```

## Monitoramento pela automação local

A automação local `aneety-project-hourly-controller` deve rodar a cada 30 minutos somente para observar o estado do agendamento cloud. Ela executa `npm ci` e depois:

```sh
npm run codex-cloud:monitor
```

Interpretação do monitor:

- `env_file_missing`: falta o arquivo local de ambiente.
- `env_file_mode_expected_600_actual_*`: permissão do arquivo local está mais aberta que o permitido.
- `scheduler_process_not_running`: o executor persistente do agendador Node.js não está rodando.
- `scheduler_worktree_missing`: o worktree isolado ainda não foi criado pelo scheduler.
- `scheduler_worktree_dirty_count_*`: o worktree isolado ficou sujo após submit/watch; o checkout canônico deve permanecer limpo.
- `cloud_task_list_failed`: o CLI não conseguiu consultar tasks do Codex Cloud.
- `cloud_task_list_empty`: nenhuma task recente foi encontrada. Só vira blocker quando também não houver PR em reconciliação, merge recente, task recente em `runtime-state.json` nem janela válida `awaiting_next_tick`.
- `scheduler_dry_run=ok`: a pré-checagem local passou, mas isso ainda não comprova task real.
- `controller_progress_state`: estado derivado do controlador (`ready_for_more_parallel_work`, `ready_for_dependency_cycle`, `parallel_tasks_running`, `publish_queue_pending`, `dependency_chain_in_progress`, `awaiting_next_tick`, `idle_between_slots`, `pending_pr_checks`, `running_remote_deploy`, `running_remote_smoke`, `paused_waiting_manual_external_gate`, `degraded_health`, `complete`).
- `parallel_limit`: limite operacional atual de tasks cloud paralelas.
- `active_task_count`: quantidade de tasks rastreadas em `pending|running`.
- `publish_queue_count`: quantidade de tasks `ready` aguardando publicação serial.
- `tracked_ready_task_count`: quantidade de tasks prontas ou em publicação.
- `superseded_task_count`: quantidade de tasks descartadas por duplicidade/obsolescência.
- `active_dependency_chain_count`: quantidade de cadeias de dependência ativas no pool rastreado.
- `awaiting_next_tick=true`: o processo iniciou ou reiniciou perto do boundary do cron e ainda aguarda o próximo slot válido antes da primeira task nova.
- `last_success_age_seconds`: idade do sucesso operacional mais recente (`merge` ou conclusão útil de ciclo).
- `backlog_completion_state`: `in_progress`, `blocked` ou `complete` para a matriz inteira.
- `open_controller_pr_state=pending`: há PR operacional aberta aguardando checks obrigatórios.
- `open_controller_pr_state=failed`: há PR operacional aberta com falha de checks ou blocker de merge.
- `open_controller_pr_state=merge_ready`: a PR já ficou apta para merge; o scheduler deve concluir o merge no mesmo ciclo quando `CODEX_CLOUD_AUTO_MERGE=1`.
- `open_controller_pr_state=merged`: o último ciclo concluiu merge automático e registrou o SHA final de `main`.
- `open_controller_pr_state=timeout`: a PR continuou aberta além da janela `CODEX_CLOUD_PR_WATCH_INTERVAL * CODEX_CLOUD_PR_WATCH_MAX_POLLS`.

Regras:

1. Não usar a automação local do Codex App como executor/submissor; ela é somente monitor.
2. Não armazenar tokens no repositório.
3. Não expor `GH_TOKEN` em logs.
4. Conferir task, branch, commit, PR e checks antes de aceitar a mudança.
5. Manter o aceite de código em GitHub Actions e Cloudflare gate.
6. Nunca executar submit/watch/publish diretamente no checkout canônico; o scheduler deve usar worktree isolado, fazer merge no GitHub e reconciliar o worktree de volta para `origin/main`.
7. Se já existir PR aberta do controlador no padrão `codex/<ciclo>-<responsabilidade>-<YYYY-MM-DD>`, o scheduler não publica outra PR; primeiro reconcilia a PR aberta até `merged` ou blocker objetivo.
8. Tasks cloud podem rodar em paralelo até `CODEX_CLOUD_MAX_PARALLEL_TASKS`, mas o scheduler publica e mergeia no máximo uma PR operacional por vez.
9. Se o ciclo atual depender de outros módulos declarados na matriz, o scheduler deve preemptar o item pai e avançar as dependências não verdes elegíveis no pool paralelo antes de voltar ao alvo original.
10. `remote gate` de ciclos pausados (`validacao`/`bloqueado`) só roda quando não houver tasks ativas, fila de publicação ou targets paralelos elegíveis; blockers remotos não congelam o restante do pool cloud.
11. Para ciclos de dados, Supabase pode ser usado como provedor operacional permitido/padrão quando a responsabilidade exigir, sem virar dependência obrigatória do contrato de produto nem copy de usuário final.
12. `GH_TOKEN` continua no domínio Codex Cloud/scheduler; `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` precisam existir também no escopo de GitHub Actions usado por `.github/workflows/cloudflare-gate.yml` para que `publicacao` seja automável.
13. Se um diff pronto ficar stale depois de outro merge serial em `main`, o publisher deve marcá-lo como `stale_conflict`/`superseded` e voltar ao backlog para gerar uma task nova, nunca falhar o ciclo inteiro por patch drift esperado.

## Critério de aceite do agendamento

O agendamento só está operacional quando uma execução recorrente conseguir:

1. submeter a task;
2. terminar em `READY`;
3. deixar evidência de URL/id da task;
4. abrir PR no GitHub a partir do diff `READY` ou registrar blocker objetivo de permissão/autenticação;
5. acompanhar os checks obrigatórios, concluir squash merge automático e registrar o SHA final de `main`;
6. apagar branch remota quando o merge concluir;
7. quando o ciclo exigir aceite remoto, disparar `Cloudflare deploy gate`, capturar a URL publicada, executar `smoke`, gerar artefato versionado e abrir/mergear a PR operacional correspondente;
8. ser visível pelo monitor local sem blockers críticos.

# Agendamento externo do controlador no Codex Cloud

Este documento descreve o caminho v1 para agendar o controlador Aneety via Codex Cloud e monitorar esse agendamento pela automação local do Codex App.

## Estado atual

- O modo Codex Cloud foi aceito em `docs/project/codex-cloud-validation-2026-05-30.md`.
- A automação local do Codex App fica ativa somente como monitor do agendamento; ela não submete task, não inicia scheduler, não cria PR e não faz merge.
- O agendamento Node.js externo deve chamar `codex cloud exec` contra o ambiente Codex Cloud já validado.
- A task remota pode gerar diff ou PR, mas não deve fazer merge automático.
- O wrapper foi validado com a task `task_e_6a1a82c1423883278473fd88ccdb8cae`, que terminou `READY` e gerou diff de monitoramento sem merge automático.

## Scripts versionados

- `.codex/cloud/submit-controller-task.sh` — submete uma task usando `.codex/cloud/controller-prompt.md`.
- `.codex/cloud/watch-task.sh` — acompanha uma task até `READY` ou falha.
- `.codex/cloud/scheduler.mjs` — agendador Node.js com `node-cron`, executando submit/watch a cada 30 minutos por padrão.
- `.codex/cloud/monitor-scheduler.mjs` — monitor local do agendamento, do arquivo de ambiente, do processo scheduler e das tasks Codex Cloud recentes.

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
- `CODEX_CLOUD_SCHEDULE`: expressão cron do agendador Node.js; padrão `*/30 * * * *`.
- `CODEX_CLOUD_SCHEDULE_TZ`: timezone do agendador Node.js; padrão `America/Asuncion`.

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
- `cloud_task_list_failed`: o CLI não conseguiu consultar tasks do Codex Cloud.
- `cloud_task_list_empty`: nenhuma task recente foi encontrada.
- `scheduler_dry_run=ok`: a pré-checagem local passou, mas isso ainda não comprova task real.

Regras:

1. Não usar a automação local como executor/submissor; ela é somente monitor.
2. Não armazenar tokens no repositório.
3. Não expor `GH_TOKEN` em logs.
4. Conferir a task e seus diffs antes de abrir ou aceitar PR.
5. Manter o aceite de código em GitHub Actions e Cloudflare gate.

## Critério de aceite do agendamento

O agendamento só está operacional quando uma execução recorrente conseguir:

1. submeter a task;
2. terminar em `READY`;
3. deixar evidência de URL/id da task;
4. não fazer merge automático;
5. ser visível pelo monitor local sem blockers críticos.

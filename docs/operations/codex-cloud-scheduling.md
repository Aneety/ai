# Agendamento externo do controlador no Codex Cloud

Este documento descreve o caminho v1 para agendar o controlador Aneety fora da automação local do Codex App.

## Estado atual

- O modo Codex Cloud foi aceito em `docs/project/codex-cloud-validation-2026-05-30.md`.
- A automação local permanece pausada.
- O agendamento externo deve chamar `codex cloud exec` contra o ambiente Codex Cloud já validado.
- A task remota pode gerar diff ou PR, mas não deve fazer merge automático.
- O wrapper foi validado com a task `task_e_6a1a82c1423883278473fd88ccdb8cae`, que terminou `READY` e gerou diff de monitoramento sem merge automático.

## Scripts versionados

- `.codex/cloud/submit-controller-task.sh` — submete uma task usando `.codex/cloud/controller-prompt.md`.
- `.codex/cloud/watch-task.sh` — acompanha uma task até `READY` ou falha.

## Variáveis do agendador

Obrigatórias:

- `CODEX_CLOUD_ENV_ID`: id do ambiente Codex Cloud validado.

Opcionais:

- `CODEX_CLOUD_BRANCH`: branch usada na task; padrão `main`.
- `CODEX_CLOUD_ATTEMPTS`: tentativas best-of-N; padrão `1`.
- `CODEX_CLOUD_PROMPT_FILE`: prompt da task; padrão `.codex/cloud/controller-prompt.md`.
- `CODEX_CLOUD_CLI`: comando do Codex CLI; padrão `codex`. Use quando o binário global estiver antigo, por exemplo `npx --yes --package @openai/codex@latest codex`.
- `CODEX_CLOUD_WATCH_INTERVAL`: intervalo em segundos para o watcher; padrão `30`.
- `CODEX_CLOUD_WATCH_MAX_POLLS`: número máximo de leituras; padrão `40`.

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

## Agendamento externo

Use um scheduler externo que consiga executar o Codex CLI autenticado e preservar `CODEX_CLOUD_ENV_ID`, por exemplo:

```sh
cd /path/to/Aneety/ai
CODEX_CLOUD_ENV_ID='<env-id>' .codex/cloud/submit-controller-task.sh
```

Regras:

1. Não usar a automação local pausada como fallback.
2. Não armazenar tokens no repositório.
3. Não expor `GH_TOKEN` em logs.
4. Conferir a task e seus diffs antes de abrir ou aceitar PR.
5. Manter o aceite de código em GitHub Actions e Cloudflare gate.

## Critério de aceite do agendamento

O agendamento só está operacional quando uma execução externa recorrente conseguir:

1. submeter a task;
2. terminar em `READY`;
3. deixar evidência de URL/id da task;
4. não fazer merge automático;
5. manter a automação local pausada.

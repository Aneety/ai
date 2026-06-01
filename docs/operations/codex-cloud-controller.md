# Controlador Aneety no Codex Cloud

Este documento descreve o modo cloud-safe do controlador de implementação da Aneety. Ele não substitui a automação local de monitoramento; cria um caminho auditável para executar tarefas no Codex Cloud sem depender de paths locais ou arquivos fora do repositório.

## Diferença entre automação local e Codex Cloud

- Automação local do Codex App depende do app em execução, de projeto disponível em disco e de configuração fora do repositório.
- Codex Cloud cria um container, faz checkout do repositório selecionado, executa setup/maintenance scripts e roda uma task isolada.
- O modo cloud-safe usa apenas arquivos versionados neste repositório: `.codex/cloud/*`, `docs/`, `docs/project/`, `assets/` e workflows.

## Arquivos do modo cloud-safe

- `.codex/cloud/setup.sh` — valida ferramentas mínimas, instala `gh` em `${HOME}/.local/bin` quando ele não existir na imagem Linux e valida autenticação GitHub quando `GH_TOKEN` estiver presente.
- `.codex/cloud/maintenance.sh` — atualiza referências Git, valida YAML dos workflows e lista PRs/runs quando possível.
- `.codex/cloud/run-controller-check.sh` — gera diagnóstico idempotente do painel, implementação e checks sem editar arquivos.
- `.codex/cloud/controller-prompt.md` — template durável e parametrizado pelo scheduler para a task executar exatamente um par `{ciclo, responsabilidade}`, atualizar `docs/project` e produzir apenas diff auditável + relatório de resultado. A task cloud não faz push, não abre PR e não faz merge.
- `.codex/cloud/submit-controller-task.sh` — wrapper para submeter o prompt do controlador via `codex cloud exec`.
- `.codex/cloud/watch-task.sh` — wrapper para acompanhar uma task remota até `READY` ou falha.
- `.codex/cloud/publish-task-diff.sh` — fallback operacional versionado para publicar o diff de uma task `READY` como branch/commit/PR a partir do worktree isolado local, sem aplicar nada no checkout canônico.
- `.codex/cloud/reconcile-controller-pr.mjs` — helper versionado para reconciliar qualquer PR operacional do controlador, classificar `pending|failed|merge_ready|merged|timeout` e concluir squash merge automático quando o gate remoto estiver verde.
- `.codex/cloud/remote-gate.mjs` — orquestra blockers `remote_automable` depois do merge, disparando `Cloudflare deploy gate`, baixando o artefato JSON do workflow e preparando a evidência versionada do ciclo. Hoje cobre `deploy` e `publicacao` dos Workers suportados, além de `gateway-borda/publicacao`.
- `.codex/cloud/publish-operational-update.sh` — publica mudanças operacionais geradas pelo próprio scheduler, sem depender de diff vindo da task cloud.
- `.codex/cloud/mirror-actions-secrets.sh` — bootstrap operacional para espelhar segredos Cloudflare do ambiente Codex Cloud para GitHub Actions secrets, sem imprimir valores.

O controlador suporta múltiplas tasks cloud em paralelo quando os targets forem independentes, mas continua com uma única fila serial de publicação/PR/merge. Em outras palavras: o Codex Cloud pode trabalhar em mais de uma responsabilidade ao mesmo tempo; o GitHub continua sendo reconciliado um item por vez.

## Variáveis e segredos

`GH_TOKEN` é necessário para o **scheduler** publicar PRs, ler checks e reconciliar merge. A task cloud não é mais writer oficial do GitHub. Configure como environment variable do executor local do scheduler e, se a task cloud precisar apenas consultar GitHub, limite o uso a leitura.

`CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` podem existir no ambiente Codex Cloud para tarefas futuras, mas o fluxo oficial de `publicacao` continua **actions-first**: o deploy e o smoke remotos dependem do escopo de **GitHub Actions secrets** usado por `.github/workflows/cloudflare-gate.yml`. O scheduler não passa segredos Cloudflare via diff, input de workflow ou log.

`CLOUDFLARE_EMAIL` não faz parte do contrato atual do workflow remoto e não deve ser exposto em artefatos versionados. O controlador também não usa `OPENAI_API_KEY`.

Quando os valores existirem apenas no ambiente Codex Cloud, use `.codex/cloud/mirror-actions-secrets.sh` dentro desse ambiente para espelhar `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` para GitHub Actions antes de reexecutar `publicacao`.

## Internet do agente

Use allowlist mínima:

- `github.com`
- `api.github.com`
- `githubusercontent.com`
- `release-assets.githubusercontent.com` e `objects.githubusercontent.com`, quando o setup precisar baixar o pacote oficial do GitHub CLI a partir de release hospedada no GitHub.
- `npmjs.com` e `npmjs.org` somente se uma etapa futura instalar pacotes durante setup.

## Comandos permitidos

- Git: `git status`, `git fetch --all --prune`, `git branch`, `git switch`, `git add`, `git commit`, `git push`.
- GitHub CLI: `gh pr`, `gh run`, `gh workflow` para `Aneety/ai`.
- Validação leve: `bash -n`, Ruby YAML parse, leitura de Markdown e inspeção de árvore.

## Limites

- Codex Cloud deve preparar código fonte, documentação operacional e diff auditável; a mutação GitHub oficial é **scheduler-only**.
- O scheduler publica o diff com `.codex/cloud/publish-task-diff.sh` exclusivamente em worktree isolado e sem tocar no checkout canônico, e reconcilia checks/merge com `.codex/cloud/reconcile-controller-pr.mjs`.
- Cada ciclo real do scheduler usa lock local antes de preparar/limpar o worktree isolado; isso evita corrida entre `scheduler:once`, `scheduler:dry-run` e o processo residente.
- Quando um ciclo estiver pausado por blocker `remote_automable`, o scheduler só tenta o trecho remoto por GitHub Actions depois que a fila de publicação e a janela paralela de tasks cloud estiverem vazias; assim, o blocker remoto não congela outras responsabilidades independentes.
- Quando o ciclo pausado também declarar dependências automáveis na matriz, o scheduler deve preemptar o item pai e abrir/avançar tasks dos dependentes até `deploy=concluido` antes de voltar ao gate remoto do pai.
- Para `gateway-borda/publicacao`, o contrato atual exige primeiro `tenant-white-label/publicacao`, `identidade-acesso/publicacao` e `onboarding-acesso/publicacao` verdes; só depois o scheduler pode insistir em `deploy`/`smoke` do gateway.
- Nem Codex Cloud nem scheduler devem aplicar diff no checkout canônico do executor; o merge automático acontece no GitHub e o worktree isolado é apenas reconciliado de volta para `origin/main`.
- O controlador não fecha aceite do MVP com execução local ou cloud. Aceite de código fonte continua em GitHub Actions, Cloudflare gate e smoke/API/e2e publicado.
- Para ciclos de dados do MVP, Supabase pode ser usado como provedor operacional padrão quando o contrato da responsabilidade exigir persistência compatível com Workers, sem virar dependência obrigatória do contrato de produto ou texto visível ao usuário final.
- Se credencial, ambiente ou permissão estiverem ausentes, registrar bloqueio objetivo em `docs/project` em vez de criar fallback.

## Validação manual recomendada

1. Criar ambiente Codex Cloud apontando para `Aneety/ai`.
2. Configurar setup script como `.codex/cloud/setup.sh`.
3. Configurar maintenance script como `.codex/cloud/maintenance.sh`.
4. Configurar `GH_TOKEN` apenas se a task precisar de `gh`. Se a imagem base não trouxer `gh`, deixar `github.com`, `release-assets.githubusercontent.com` e `objects.githubusercontent.com` liberados para o bootstrap do setup.
5. Executar uma task manual usando `.codex/cloud/controller-prompt.md`.
6. Aceitar o modo remoto somente se a task conseguir ler repo, gerar diff auditável coerente com `docs/project` e devolver relatório sem contradizer o contrato scheduler-only.
7. Para recorrência, seguir `docs/operations/codex-cloud-scheduling.md` em scheduler externo; não reativar a automação local como fallback.

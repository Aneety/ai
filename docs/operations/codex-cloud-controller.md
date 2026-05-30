# Controlador Aneety no Codex Cloud

Este documento descreve o modo cloud-safe do controlador Markdown da Aneety. Ele não substitui a automação local pausada; cria um caminho auditável para executar tarefas do controlador em Codex Cloud sem depender de paths locais ou arquivos fora do repositório.

## Diferença entre automação local e Codex Cloud

- Automação local do Codex App depende do app em execução, de projeto disponível em disco e de configuração fora do repositório.
- Codex Cloud cria um container, faz checkout do repositório selecionado, executa setup/maintenance scripts e roda uma task isolada.
- O modo cloud-safe usa apenas arquivos versionados neste repositório: `.codex/cloud/*`, `docs/`, `docs/project/`, `assets/` e workflows.

## Arquivos do modo cloud-safe

- `.codex/cloud/setup.sh` — valida ferramentas mínimas, instala `gh` em `${HOME}/.local/bin` quando ele não existir na imagem Linux e valida autenticação GitHub quando `GH_TOKEN` estiver presente.
- `.codex/cloud/maintenance.sh` — atualiza referências Git, valida YAML dos workflows e lista PRs/runs quando possível.
- `.codex/cloud/run-controller-check.sh` — gera diagnóstico idempotente do painel, implementação e checks sem editar arquivos.
- `.codex/cloud/controller-prompt.md` — prompt durável para uma task manual no Codex Cloud.

## Variáveis e segredos

`GH_TOKEN` é necessário somente quando a task precisa usar `gh` para consultar ou criar PRs e ler checks. Configure como environment variable do Codex Cloud, não como secret, se o agente precisar chamar `gh` durante a task. Use token dedicado, curto e revogável, com escopos mínimos `repo` e `workflow`.

Não configurar `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` ou `OPENAI_API_KEY` para este controlador. Deploy Cloudflare real permanece em GitHub Actions secrets, e o controlador não usa OpenAI API.

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

- Codex Cloud pode preparar branch, diff e PR, mas não deve fazer merge automático.
- O controlador não fecha aceite do MVP com execução local ou cloud. Aceite de código fonte continua em GitHub Actions, Cloudflare gate e smoke/API/e2e publicado.
- Se credencial, ambiente ou permissão estiverem ausentes, registrar bloqueio objetivo em `docs/project` em vez de criar fallback.

## Validação manual recomendada

1. Criar ambiente Codex Cloud apontando para `Aneety/ai`.
2. Configurar setup script como `.codex/cloud/setup.sh`.
3. Configurar maintenance script como `.codex/cloud/maintenance.sh`.
4. Configurar `GH_TOKEN` apenas se a task precisar de `gh`. Se a imagem base não trouxer `gh`, deixar `github.com`, `release-assets.githubusercontent.com` e `objects.githubusercontent.com` liberados para o bootstrap do setup.
5. Executar uma task manual usando `.codex/cloud/controller-prompt.md`.
6. Aceitar o modo remoto somente se a task conseguir ler repo, PRs/checks e gerar relatório sem depender de máquina local.

# Aneety cloud-safe source controller prompt

Executar o próximo ciclo operacional da Aneety Platform dentro do repositório `Aneety/ai` no Codex Cloud, produzindo PR no GitHub quando houver mudança. O controlador não deve depender de painel externo e não deve fazer merge automático.

## Fontes canônicas

- Documentação e contratos: `docs/`.
- Backlog operacional: `docs/project/index.md` e `docs/project/<responsabilidade>.md`.
- Implementação: `aneety-platform/apps/<responsabilidade>/...`.
- Assets reutilizáveis: `assets/`.

## Objetivo corrente

Avançar o ciclo `repositorio` da próxima responsabilidade bloqueada por ausência de raiz física, seguindo a ordem e prioridades em `docs/project/index.md` e `docs/08-planejamento-ciclos-implementacao-repositorios.md`.

A próxima responsabilidade padrão é a primeira linha de prioridade alta em `docs/project/index.md` com `Ciclo ativo = repositorio`, `Status = bloqueado` e bloqueio de raiz ausente. No estado atual, se ainda estiver bloqueada, use `tenant-white-label`.

## Regras obrigatórias

1. Comece com `git status --short`, branch, SHA, remoto e `git fetch --all --prune`.
2. Se o checkout inicial não estiver limpo, registre blocker objetivo e pare; não misture mudanças concorrentes.
3. Leia `docs/01-arquitetura.md`, `docs/05-estrutura-repositorios.md`, `docs/06-ciclos-cobertura.md`, `docs/08-planejamento-ciclos-implementacao-repositorios.md`, `docs/project/index.md` e o arquivo da responsabilidade escolhida.
4. Não consulte nem dependa de painel fora deste repositório.
5. Não use paths absolutos da máquina local nem paths de cache de plugins.
6. Não execute runtime local, container, servidor local, Wrangler local como aceite, Python de runtime MVP ou fallback fora de Cloudflare Workers.
7. Não faça merge automático.
8. Não use `codex cloud apply` nem qualquer comando que aplique diff de task no checkout local do executor; a saída deve ser branch/commit/PR no GitHub ou blocker.
9. Se criar Markdown com Mermaid, manter `.mmd`, renderizar `.svg` e `.jpg`, linkar os três artefatos e mostrar o código em bloco `mmd`.

## Implementação esperada para ciclo `repositorio`

Para a responsabilidade escolhida:

1. Criar a raiz física em `aneety-platform/apps/<responsabilidade>/`.
2. Criar somente scaffolds mínimos e compatíveis com Cloudflare Workers, sem runtime pesado:
   - `README.md` da responsabilidade, com owner, escopo, ciclos, contratos e próximos módulos.
   - Um ou mais diretórios folha previstos em `docs/08-planejamento-ciclos-implementacao-repositorios.md` para essa responsabilidade, por exemplo `db-*`, `worker-*`, `mfe-*`, `pkg-*` ou outros listados na matriz.
   - `README.md` mínimo em cada diretório folha criado, descrevendo objetivo, runtime permitido, dados/contratos e próximo gate.
3. Não implementar lógica de produto além do scaffold contratual do ciclo `repositorio`, salvo se a matriz exigir arquivo de contrato textual mínimo.
4. Atualizar `docs/project/<responsabilidade>.md` para marcar `repositorio` como concluído somente se a raiz física e os arquivos mínimos existirem no mesmo diff.
5. Atualizar `docs/project/index.md` para refletir a conclusão do ciclo `repositorio` da responsabilidade. Antes do PR existir, use a branch/commit como evidência temporária; depois que o PR existir, atualize a evidência para a URL do PR e faça novo commit/push se necessário.
6. Se a raiz já existir e o ciclo já estiver concluído, escolher a próxima responsabilidade bloqueada por raiz ausente.

## Fluxo GitHub obrigatório

1. Confirmar `gh auth status --hostname github.com`; se autenticado, executar `gh auth setup-git --hostname github.com` antes do push.
2. Criar branch com padrão `codex/repositorio-<responsabilidade>-<YYYY-MM-DD>`.
3. Fazer commit Conventional Commits, por exemplo `feat(<responsabilidade>): add repository scaffold`.
4. Fazer push para `origin`.
5. Criar PR no GitHub contra `main`, preferencialmente draft se ainda faltarem checks.
6. Se a evidência em `docs/project` ainda não tiver a URL do PR, atualizar os documentos com a URL, fazer segundo commit e push.
7. Acompanhar `gh pr checks` e `gh run` quando disponíveis.
8. Se os checks ficarem verdes, deixar PR pronto para revisão, mas não fazer merge.
9. Se `gh` não estiver autenticado ou o push/PR falhar por permissão, registrar blocker objetivo com causa, impacto e próxima ação. Nesse caso, deixe o diff preparado na task, mas não tente credenciais alternativas.

## Evidência obrigatória no relatório final

- Responsabilidade escolhida e motivo da escolha.
- Arquivos fonte criados em `aneety-platform/apps/<responsabilidade>/...`.
- Arquivos Markdown atualizados em `docs/project`.
- Comandos executados e resultados.
- Branch, commit e URL do PR, quando criados.
- Checks de PR ou blocker de permissão/autenticação.
- Declaração explícita de que não houve merge automático.

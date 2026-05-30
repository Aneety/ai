# Aneety cloud-safe Markdown controller prompt

Controlar e monitorar o backlog operacional da Aneety Platform usando exclusivamente este checkout do repositório `Aneety/ai` no Codex Cloud.

## Fontes canônicas

- Documentação: `docs/`.
- Backlog operacional: `docs/project/index.md` e `docs/project/<responsabilidade>.md`.
- Assets reutilizáveis: `assets/`.
- Implementação: `aneety-platform/apps/<responsabilidade>/...`.

## Regras operacionais

1. Comece com `git status --short`, branch, SHA, remoto e `git fetch --all --prune`.
2. Leia os documentos normativos relevantes em `docs/` antes de concluir status operacional.
3. Leia `docs/project/index.md` e arquivos de responsabilidade relevantes.
4. Use `gh pr`, `gh run` e `gh workflow` somente para `Aneety/ai` quando `gh` estiver autenticado.
5. Não consulte nem dependa de painel fora deste repositório.
6. Não use paths absolutos da máquina local nem paths de cache de plugins.
7. Não execute runtime local, container, servidor local, Wrangler local como aceite, Python de runtime MVP ou fallback fora de Cloudflare Workers.
8. Não faça merge automático. Prepare branch/PR/diff e registre evidência; deixe merge para revisão humana.
9. Se houver lacuna de permissão, segredo, ambiente, contrato ou evidência, registre bloqueio objetivo em Markdown com causa, impacto e próxima ação.
10. Se criar Markdown com Mermaid, manter `.mmd`, renderizar `.svg` e `.jpg`, linkar os três artefatos e mostrar o código em bloco `mmd`.

## Saída esperada

- Relatório curto em português.
- Evidência separada de inferência.
- Documentos lidos, arquivos `docs/project` inspecionados/atualizados, PRs/checks consultados, comandos executados e bloqueios registrados.
- Próxima ação mínima sugerida.

# Documentação Aneety

Este diretório é a documentação canônica da plataforma Aneety dentro do monorepo `Aneety/ai`.

A implementação nova deve nascer em `aneety-platform/apps/<responsabilidade>/...`. O backlog operacional ativo fica em `docs/project/`. Assets reutilizáveis ficam em `assets/`. GitHub Issues e PRs continuam como histórico, discussão e evidência quando necessário, mas o status ativo é registrado em Markdown versionado neste repositório.

## Índice

- `00-estrategia-descontinuacao-mvp.md` — estratégia de transição a partir da linha Lia.
- `01-arquitetura.md` — runtime alvo, fronteiras, responsabilidades e diretrizes arquiteturais.
- `02-requisitos.md` — requisitos funcionais e não funcionais.
- `03-processos.md` — processos de negócio e fluxo operacional.
- `04-modelagem-banco.md` — modelagem de dados e premissas de persistência.
- `05-estrutura-repositorios.md` — estrutura do monorepo e regras de módulos internos.
- `06-ciclos-cobertura.md` — ciclos de cobertura e gates.
- `07-governanca-github.md` — governança de PRs, issues históricas e painel Markdown.
- `08-planejamento-ciclos-implementacao-repositorios.md` — backlog normativo por responsabilidade e ciclo.
- `remote-ci-gate.md` — gate Actions-first antes de Cloudflare.
- `project/` — painel operacional versionado.

## Regras rápidas

- Documentação canônica: `Aneety/ai/docs`.
- Backlog operacional: `Aneety/ai/docs/project`.
- Assets reutilizáveis: `Aneety/ai/assets`.
- Implementação: `Aneety/ai/aneety-platform/apps/<responsabilidade>/...`.
- Evidência de MVP: PR com GitHub Actions verdes antes de Cloudflare e smoke/API/e2e publicado depois.

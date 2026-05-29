# Aneety AI

Repositório orquestrador e monorepo de implementação do MVP da Aneety Platform.

Este repositório nasce limpo: o código dos repositórios históricos Lia não foi importado. A linha Lia permanece como fonte histórica de aprendizado, evidências, decisões e massas de demonstração. Novas responsabilidades Aneety devem nascer dentro deste monorepo, no caminho canônico `aneety-platform/apps/<responsabilidade>/...`, quando houver contrato, owner, dados tratados, custo zero, testes e critério de aceite.

## Documentação canônica

A documentação oficial da plataforma fica em [`Aneety/.github/docs`](https://github.com/Aneety/.github/tree/main/docs).

Este repositório mantém apenas README mínimo, ponteiros e documentação técnica estritamente necessária para a implementação. Não duplique arquitetura, ADRs, guias ou catálogo de repositórios aqui.

## Estrutura inicial

- `docs/` — ponteiro para documentação canônica.
- `aneety-platform/apps/` — raiz reservada para módulos internos por responsabilidade.

## Regra de implementação

Cada responsabilidade com implementação própria deve seguir o contrato vigente em `Aneety/.github/docs` e ser criada dentro de `Aneety/ai`, no caminho `aneety-platform/apps/<responsabilidade>/...`.

Categorias estruturais do MVP:

- `worker-<nome>` — BFF ou workload HTTP/assíncrono compatível com Cloudflare Workers.
- `job-<nome>` — rotina assíncrona compatível com Workers.
- `mfe-<nome>` — microfrontend operacional.
- `db-<nome>` — estrutura de dados, migrations, seeds e controles de isolamento.
- `pkg-<nome>`, `core-<nome>`, `int-<nome>`, `auto-<nome>` — módulos internos compartilhados, contratos, integrações e automações.

Não faz parte do contrato atual criar repositório separado ou submódulo por responsabilidade no MVP.

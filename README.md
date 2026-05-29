# Aneety AI

Repositório orquestrador da nova plataforma Aneety.

Este repositório nasce limpo: o código dos repositórios históricos Lia não foi importado. A linha Lia permanece como fonte histórica de aprendizado, evidências, decisões e massas de demonstração, enquanto novas responsabilidades Aneety devem ser criadas como módulos internos do monorepo quando houver contrato, owner, dados tratados, custo zero, testes e critério de aceite.

## Documentação canônica

A documentação oficial da plataforma fica em [`Aneety/.github/docs`](https://github.com/Aneety/.github/tree/main/docs).

Este repositório mantém apenas ponteiros e estrutura de orquestração. Não duplique arquitetura, ADRs, guias ou catálogo de repositórios aqui.

## Estrutura inicial

- `docs/` — ponteiro para documentação canônica.
- `aneety-platform/apps/` — raiz reservada para módulos internos por responsabilidade.

## Regra de implementação e validação

Cada responsabilidade com implementação própria deve nascer como módulo interno em `aneety-platform/apps/<responsabilidade>/...`, seguindo o contrato canônico publicado em `Aneety/.github/docs`. Separação em repositório próprio fica fora do contrato atual do MVP e só pode acontecer depois de atualização documental aprovada.

Este monorepo pode ser usado nesta máquina local para gerar, editar, revisar e versionar código fonte, contratos, documentação e artefatos de controle.

Para o MVP, compilar, executar, testar, publicar, validar smoke ou gerar evidência operacional de código fonte deve acontecer exclusivamente no ecossistema Cloudflare Workers, por Cloudflare Workers Builds, preview remoto, runtime remoto, `wrangler deploy --dry-run`, `wrangler dev --remote` ou mecanismo Cloudflare equivalente aprovado em documentação canônica.

Não usar execução local como evidência de aceite do MVP. Simulações locais, servidores persistentes, containers, Python, VPS, banco externo obrigatório ou runtime fora de Cloudflare Workers não substituem validação Cloudflare-backed.

# Governança GitHub — Aneety Platform

## Objetivo da governança

Controlar a execução da Aneety Platform com rastreabilidade objetiva entre arquitetura, requisitos, processos, ciclos, evidências e trabalho operacional.

A fonte operacional de backlog, status, owner, evidência e bloqueio vive em `docs/project/`. GitHub continua útil para versionamento, PRs, CI, comentários e issues históricas, mas não é mais o painel ativo de status.

Este documento é governança de transição. A documentação canônica vive em `Aneety/ai/docs`, que mantém a base normativa do novo produto enquanto a migração do MVP Lia para Aneety Platform estiver em andamento.

## Fontes de verdade e precedência

A precedência documental é:

1. `01-arquitetura.md` — decisões estruturais, runtime, responsabilidades, NFR estruturais, limites de fornecedores e documentação canônica.
2. `02-requisitos.md` — requisitos de produto, técnicos e critérios verificáveis de aceite.
3. `03-processos.md` — modo de execução, gates operacionais e sequência de validação.
4. `04-modelagem-banco.md` — modelagem conceitual, índices mínimos, isolamento e regras de acesso.
5. `05-estrutura-repositorios.md` — organização dos repositórios centrais, monorepo, clones locais e regras de runtime do MVP.
6. `06-ciclos-cobertura.md` — ordem incremental dos ciclos, gates de E2E e critérios de conclusão.
7. `08-planejamento-ciclos-implementacao-repositorios.md` — backlog operacional derivado das normas anteriores; não substitui contrato, mas organiza execução e aceite.
8. `docs/project/index.md` e `docs/project/<responsabilidade>.md` — painel operacional versionado; não muda contrato, apenas registra status e evidência.

Regras:

- Issue, arquivo em `docs/project`, PR, comentário ou automação não pode alterar contrato por conta própria.
- Se `docs/project` disser `concluido`, mas a fonte documental ou a evidência estiver ausente, o ciclo continua aberto.
- Se houver conflito entre issue histórica e documento normativo, vale o documento normativo até existir PR documental aprovado.
- Decisão arquitetural nova exige atualização documental antes de virar implementação.
- Antes de ler ou alterar qualquer repo local da org `Aneety`, registrar `git status --short`, branch atual, SHA atual, remoto `origin` e executar `git fetch --all --prune`.
- Mudança local humana não pode ser sobrescrita pela automação. Repo sujo deve ficar fora de edição até normalização.
- Se `Aneety/ai` local estiver sujo ou não conseguir atualizar `origin/main`, esse checkout não pode ser fonte de verdade; a automação deve ler a documentação canônica por `origin/main` ou por clone/worktree limpo antes de decidir backlog, status ou bloqueio.

## Papel do GitHub

GitHub é permitido para versionamento, revisão, PRs, CI, Issues históricas e documentação.

GitHub não é runtime operacional da plataforma. GitHub Pages, quando existir, só pode publicar ou apontar documentação mantida em `Aneety/ai/docs`; nunca app, smoke, E2E, fluxo operacional ou URL pública de aceite.

Referências operacionais do próprio GitHub:

- [Issue forms/templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository) podem padronizar entradas futuras em `.github/ISSUE_TEMPLATE` quando uma issue realmente for necessária.
- PRs, comentários e checks continuam como evidência rastreável para atualizar `docs/project`.

## Papel do Codex local e da Cloudflare

Codex nesta máquina local é ambiente de controle, monitoramento, definição de Markdown, geração de código fonte e preparação de artefatos. Ele não deve executar o produto MVP como runtime de aceite.

Para código fonte do MVP, evidência de build, execução, teste, smoke, publicação ou validação manual só fecha ciclo quando vier de Cloudflare Workers Builds, preview remoto, runtime remoto, `wrangler deploy --dry-run`, `wrangler dev --remote` ou mecanismo Cloudflare equivalente aprovado em documentação canônica.

Se Codex encontrar lacuna de implementação mas não houver ambiente Cloudflare permitido, segredo seguro, contrato ou gate anterior verde, deve atualizar `docs/project` com bloqueio objetivo e próxima ação. Não deve compensar a lacuna com servidor local, container, Python, VPS, banco externo obrigatório ou runtime fora de Cloudflare Workers.

## Proteção de checkout e leitura canônica

Antes de comparar, revisar ou alterar qualquer repositório Aneety, a automação deve proteger o trabalho humano:

- executar `git status --short`, registrar branch atual, SHA atual e remotos do repositório;
- executar `git fetch --all --prune` antes de usar o checkout como base de comparação;
- se houver mudança local não criada no ciclo atual, não sobrescrever, não limpar e não editar aquele checkout; registrar bloqueio objetivo em `docs/project/<responsabilidade>.md` ou em `docs/project/index.md` quando o impacto for global;
- se `/Users/mal/GitHub/Aneety/ai` estiver sujo, esse checkout não pode ser usado como fonte de verdade para decisão documental; a leitura canônica deve acontecer por `origin/main`, worktree limpo ou clone limpo equivalente;
- alterações documentais em `Aneety/ai` devem acontecer somente em branch derivada de `main` atualizado dentro de worktree limpo.

## Modelo de Issues

Criar issue apenas para incremento, lacuna, decisão, bloqueio ou evidência que realmente precise de thread própria.

Não usar issue como painel ativo de status. O status ativo vive em `docs/project/<responsabilidade>.md`.

### Título

Usar o padrão:

```text
[ciclo][responsabilidade] ação objetiva
```

Exemplos:

```text
[banco][pedidos] criar estrutura de dados inicial de pedidos customizados
[backend][pedidos] publicar contrato HTTP de criação de pedido
[governanca][documentacao] formalizar atualização do painel em Markdown
[bloqueio][deploy] registrar domínio sem resolução pública
```

### Corpo obrigatório

Toda issue deve conter:

- **Fonte documental:** link para `01-arquitetura.md`, `02-requisitos.md`, `03-processos.md`, `04-modelagem-banco.md`, `05-estrutura-repositorios.md`, `06-ciclos-cobertura.md` ou `08-planejamento-ciclos-implementacao-repositorios.md`.
- **Ciclo:** um valor da ordem fixa definida em `06-ciclos-cobertura.md`.
- **Responsabilidade:** domínio ou capacidade em `aneety-platform/apps/<responsabilidade>/...`.
- **Owner:** pessoa responsável por conduzir a issue até fechamento.
- **Critério de aceite:** condição objetiva de conclusão.
- **Evidência esperada:** PR, diff, GitHub Actions verde, build/lint/teste remoto, log Cloudflare, smoke, screenshot, URL pública Cloudflare permitida ou documento atualizado.
- **Repo destino:** repositório onde o trabalho será implementado ou documentado.
- **Riscos:** segredo, custo, lock-in, dado real, permissão, arquitetura ou dependência externa.
- **Links:** PRs, documentos, issues relacionadas, runs de CI, evidências e decisões.

### Modelo textual mínimo

```markdown
## Fonte documental

- Documento:
- Seção:

## Ciclo e responsabilidade

- Ciclo:
- Responsabilidade:
- Repo destino:
- Owner:

## Critério de aceite

-

## Evidência esperada

-

## Riscos e bloqueios

-

## Links

-
```

## Taxonomia de labels

Labels devem classificar tipo, ciclo e status. Evitar labels que dupliquem texto livre sem melhorar filtro ou relatório.

### Tipo

- `tipo:requisito`
- `tipo:arquitetura`
- `tipo:processo`
- `tipo:bug`
- `tipo:bloqueio`
- `tipo:evidencia`

### Ciclo

- `ciclo:repositorio`
- `ciclo:deploy`
- `ciclo:publicacao`
- `ciclo:banco`
- `ciclo:jobs`
- `ciclo:backend`
- `ciclo:teste-integracao-api`
- `ciclo:microfrontend`
- `ciclo:smoke`
- `ciclo:teste`
- `ciclo:documentacao`
- `ciclo:governanca`

Normalização obrigatória:

- Em labels, automações e filtros técnicos, usar slugs sem acento: `ciclo:publicacao`, `ciclo:documentacao`, `ciclo:teste-integracao-api`.
- Em texto de negócio e documentação narrativa, manter grafia legível: `publicação`, `documentação`, `Testes de integração de API`.

### Status

- `status:triagem` — item ainda sem fonte documental, owner ou aceite completo.
- `status:pronto` — item pronto para entrar em ciclo.
- `status:em-ciclo` — item em execução ativa.
- `status:validacao` — implementação feita, aguardando evidência final ou revisão.
- `status:bloqueado` — item parado por decisão, dependência, acesso, dado, secret, custo, runtime, arquitetura ou evidência ausente.
- `status:concluido` — item encerrado com evidência final e painel Markdown atualizado.

Regras:

- Cada issue deve ter no mínimo um `tipo:*`, um `ciclo:*` e um `status:*`.
- Issue bloqueada deve registrar causa objetiva e próxima ação.
- Issue de evidência deve linkar o artefato verificável.

## Modelo de `docs/project`

`docs/project/` é o painel operacional versionado em Git.

### Arquivos obrigatórios

- `docs/project/index.md` — visão executiva única do backlog e dos bloqueios globais.
- `docs/project/<responsabilidade>.md` — status detalhado por responsabilidade.

### Campos obrigatórios

- **Status:** triagem, pronto, em ciclo, validação, bloqueado, concluído.
- **Ciclo:** uma etapa da ordem fixa de `06-ciclos-cobertura.md`.
- **Responsabilidade:** domínio/capacidade da plataforma.
- **Repo destino:** repositório onde a mudança será feita.
- **Owner:** responsável pela conclusão.
- **Prioridade:** alta, média ou baixa.
- **Gate:** requisito, arquitetura, processo, DB, job, backend, microfrontend, smoke, teste, documentação ou governança.
- **Evidência:** link ou descrição curta da evidência esperada/final.
- **Bloqueio:** vazio quando livre; causa objetiva quando bloqueado.

### Regras de atualização

- Atualizar o arquivo da responsabilidade antes de executar mudança de estado operacional em qualquer outro lugar.
- Mover para `em ciclo` somente se a etapa anterior estiver verde com evidência.
- Mover para `validacao` somente com PR, diff ou artefato pronto para revisão.
- Mover para `concluido` somente com evidência final linkada.
- Atualizar `docs/project/index.md` sempre que `Status`, `Owner`, `Prioridade`, `Ciclo ativo` ou bloqueio global mudarem.
- Quando o bloqueio vier de checkout sujo, branch errada, SHA defasado ou fetch pendente, registrar a causa objetiva e o repo afetado no painel Markdown antes de qualquer outra ação.

## Fluxo de ciclo

Antes de iniciar um ciclo:

1. Proteger checkout humano com `git status --short`, branch, SHA, remotos e `git fetch --all --prune`.
2. Confirmar fonte documental e critério de aceite.
3. Confirmar ciclo pela ordem fixa de `06-ciclos-cobertura.md`.
4. Confirmar responsabilidade e repo destino.
5. Confirmar owner.
6. Confirmar evidência esperada.
7. Abrir ou atualizar issue somente se ela ainda for necessária como thread histórica.
8. Atualizar `docs/project/<responsabilidade>.md`.
9. Marcar `status:pronto` no arquivo correspondente.

Durante o ciclo:

1. Atualizar para `status:em-ciclo` no arquivo correspondente.
2. Executar apenas a responsabilidade declarada.
3. Linkar PRs, commits, checks, screenshots, logs ou documentos na coluna `Evidência`.
4. Registrar bloqueios com causa objetiva e próxima ação.
5. Não expandir E2E se algum gate anterior estiver vermelho ou sem evidência.

Para fechar o ciclo:

1. Atualizar para `status:validacao` no arquivo correspondente.
2. Verificar PR, docs, checks do GitHub Actions, testes remotos e smoke aplicáveis.
3. Conferir ausência de segredos em diff, log, screenshot e bundle.
4. Conferir ausência de vazamento técnico em UI final.
5. Linkar evidência final.
6. Fechar issue histórica, quando existir.
7. Atualizar `docs/project/<responsabilidade>.md` para `concluido`.
8. Refletir a mudança em `docs/project/index.md`.

## Definition of Done

Uma entrega só pode ser concluída quando todos os itens aplicáveis forem verdadeiros:

- Requisito rastreado para fonte documental.
- Arquitetura e processo sincronizados.
- Ciclo correto preservado.
- Owner declarado.
- Repo destino correto.
- Critério de aceite cumprido.
- Evidência objetiva anexada ou linkada.
- Testes, smoke ou validação manual aplicável registrados com evidência Cloudflare-backed quando envolver código fonte do MVP.
- Sem segredo em diff, log, screenshot, bundle, fixture pública ou documentação de usuário final.
- Sem UI final com vazamento técnico de infraestrutura, banco, runtime, framework, secrets, fornecedor ou ferramenta interna.
- Custo zero preservado.
- Dependência externa classificada por função semântica quando aplicável.
- `docs/project` atualizado com status final.

## Regras de bloqueio

Bloquear a responsabilidade quando faltar qualquer item essencial:

- Fonte documental.
- Owner.
- Critério de aceite.
- Evidência esperada.
- Decisão arquitetural.
- Repo destino.
- Permissão, secret ou acesso necessário.
- Smoke, teste ou validação obrigatória.
- Plano de saída para fornecedor externo.
- Garantia de custo zero.
- Confirmação de que GitHub não virou runtime operacional.
- Confirmação de que build, execução, teste, smoke e evidência operacional de código fonte do MVP não foram substituídos por validação local fora de Cloudflare Workers.

Bloqueio deve registrar:

- causa objetiva;
- impacto;
- próxima ação;
- responsável;
- data ou condição para reavaliação.

`status:concluido` sem evidência não fecha ciclo. Issue histórica fechada sem evidência deve ser reaberta ou substituída por issue de correção de governança.

## Evolução futura

Fluxo manual base passa a contar com `docs/project/` como painel operacional versionado, issue form em `.github/ISSUE_TEMPLATE/backlog-operacional.yml` e taxonomia de labels padronizada nos repositórios Aneety atuais. Evolução futura deve focar em:

- relatórios derivados de `docs/project`;
- automação leve para validar campos obrigatórios nos arquivos Markdown;
- integração com CI para linkar checks relevantes;
- melhorias de busca, diff e auditoria do painel versionado.

Essa evolução futura deve acontecer sem reintroduzir dependência de painel fora do repositório como fonte operacional.

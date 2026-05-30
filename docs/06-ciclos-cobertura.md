# Ciclos de desenvolvimento por cobertura — Aneety Platform

## Objetivo

Definir ciclos incrementais de implementação guiados por cobertura. Cada ciclo deve aumentar evidência objetiva sem misturar responsabilidades, sem pular gates e sem criar E2E novo antes de estabilizar a base vigente.

## Ordem fixa de responsabilidades

A ordem fixa dos ciclos é: `repositorio`, `deploy`, `publicação`, `banco`, `jobs`, `backend`, `Testes de integração de API`, `microfrontend`, `smoke`, `teste`, `documentação`, `governança`.

Descrição do ciclo novo:

- **Testes de integração de API:** Valida API + banco/serviços reais, mas pode soar mais técnico que negócio.

Normalização obrigatória para labels, automações e campos do Project:

- `publicação` -> `ciclo:publicacao`
- `Testes de integração de API` -> `ciclo:teste-integracao-api`
- `documentação` -> `ciclo:documentacao`
- `governança` -> `ciclo:governanca`

Regras obrigatórias:

- Cada ciclo trata apenas 1 responsabilidade da lista acima.
- Nenhum ciclo pode antecipar responsabilidade posterior enquanto a anterior estiver pendente, vermelha ou sem evidência.
- A responsabilidade do ciclo deve estar mapeada em `aneety-platform/apps/<responsabilidade>/...` quando virar implementação própria.
- Implementação própria exige módulo interno em `Aneety/ai`, no caminho `aneety-platform/apps/<responsabilidade>/...`, com documentação canônica correspondente em `docs/`.
- Documentação canônica vive em `Aneety/ai/docs`; este diretório mantém o contrato vigente da transição.
- Custo zero sempre: qualquer dependência paga bloqueia o ciclo até redesenho.
- Codex pode gerar e editar código fonte localmente, mas build, execução, teste, smoke e evidência operacional do MVP devem ser Cloudflare-backed por Cloudflare Workers Builds, preview remoto, runtime remoto, `wrangler deploy --dry-run`, `wrangler dev --remote` ou mecanismo Cloudflare equivalente aprovado. Validação local ou cloud não fecha ciclo.

## Sequência CRUD obrigatória

Dentro de cada responsabilidade funcional implementada, a cobertura deve avançar sempre nesta ordem:

1. Incluir.
2. Pesquisar por `id` ou `eid`.
3. Pesquisar 1 por parâmetros.
4. Pesquisar N paginado por parâmetros.
5. Atualizar 1 por parâmetros.
6. Atualizar N por parâmetros.
7. Excluir 1 por parâmetros.
8. Excluir N por parâmetros.
9. Jobs associados à responsabilidade.

Uma etapa só pode ser considerada coberta quando houver contrato, implementação, teste e evidência compatíveis com o nível atual. Não basta existir tela, endpoint, tabela ou script isolado.

## Ordem interna por responsabilidade funcional

Para responsabilidades com dado, regra e interface, a ordem interna é: DB completo -> backend completo -> job completo -> Testes de integração de API -> microfrontend completo.

Critérios por camada:

- **DB completo:** migrations, constraints, índices, controles de isolamento quando aplicável, seeds/fixtures, rollback seguro, auditoria mínima e testes de leitura/escrita para todas as operações CRUD previstas, validados por mecanismo Cloudflare permitido quando virarem evidência de aceite.
- **Backend completo:** contratos HTTP ou eventos, validação, autorização, erros de domínio, paginação, idempotência quando necessária, auditoria e testes de contrato para todas as operações CRUD já verdes no DB, com execução em Cloudflare Workers.
- **Job completo:** execução idempotente, retries, logs operacionais, critérios de reprocessamento, isolamento por tenant/responsabilidade e testes com massa controlada, usando Queue, Cron Trigger, Workflow, Durable Object ou mecanismo compatível com Workers.
- **Testes de integração de API:** validação da API integrada ao banco e aos serviços reais previstos para o ciclo, em preview remoto ou runtime Cloudflare permitido, sem substituir smoke, E2E ou critérios de negócio.
- **Microfrontend completo:** fluxo visual com shadcn/ui e tokens semânticos, estados de carregamento/vazio/erro/sucesso, permissões, acessibilidade básica e integração somente via gateway/BFF, nunca por acesso direto ao banco.

## Gate de cobertura E2E

Nova cobertura E2E só pode ser adicionada quando todos os itens abaixo estiverem verdes no incremento vigente:

- Requisitos.
- Processos.
- Arquitetura.
- Repositórios.
- Docs.
- Smoke.
- DB.
- Job.
- Backend.
- Testes de integração de API.
- Microfrontend.
- E2E vigente.

Se qualquer item estiver vermelho, ausente, sem evidência ou dependente de decisão aberta, o ciclo deve corrigir essa base antes de expandir E2E. O E2E deve crescer por menor próxima cobertura útil, privilegiando fluxo crítico real antes de exceções secundárias.

## Checklist de execução de ciclo

Para iniciar um ciclo:

1. Confirmar a próxima responsabilidade pela ordem fixa.
2. Confirmar que a responsabilidade anterior está verde com evidência.
3. Registrar objetivo, owner, dados tratados, custo, segredo, contrato local, testes e plano de saída de fornecedores.
4. Criar ou atualizar o módulo interno no monorepo apenas se houver implementação própria.
5. Implementar a sequência CRUD obrigatória sem pular etapas.
6. Respeitar a ordem DB completo -> backend completo -> job completo -> Testes de integração de API -> microfrontend completo quando a responsabilidade envolver dado, regra e interface.
7. Rodar smoke e testes do escopo tocado em ambiente Cloudflare permitido para o ciclo.
8. Avaliar se os gates permitem adicionar exatamente a próxima cobertura E2E.
9. Atualizar documentação canônica e evidências antes de fechar o ciclo.

## Status de conclusão

Um ciclo só fecha quando entrega evidência verificável de:

- responsabilidade única tratada;
- ordem incremental preservada;
- sequência CRUD coberta até o ponto declarado;
- contratos e docs sincronizados;
- testes e smoke verdes com evidência Cloudflare-backed;
- nenhuma exposição de detalhe técnico em UI final;
- nenhuma dependência paga obrigatória;
- decisão explícita sobre adicionar ou não nova cobertura E2E.

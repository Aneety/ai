# db-pedidos-customizados

## Objetivo

Preparar o módulo de estrutura de dados da responsabilidade `pedidos-customizados` para os ciclos futuros de banco, isolamento, histórico e seeds controlados.

## Runtime permitido

- Persistência deve usar bindings compatíveis com Cloudflare Workers, com D1 como caminho preferencial quando houver modelo relacional.
- Este diretório ainda não contém migrations, DDL, seeds ou testes de dados; eles pertencem ao ciclo `banco`.
- Não usar containers, banco local persistente, Python de runtime MVP, servidor tradicional ou fallback fora de Cloudflare Workers como aceite.

## Dados e contratos

- Tabelas/coleções previstas: `orders` e `order_checkpoints`.
- Requisitos futuros: UUIDs, datas de criação/atualização, versionamento, exclusão lógica, índices por tenant, checkpoints auditáveis e controles explícitos de isolamento.
- Seeds futuros devem ser sanitizados e genéricos, sem dados reais de consumidores, produtores, pedidos ou anexos.

## Próximo gate

O próximo gate deste diretório é o ciclo `banco`, com migration/DDL ou contrato de storage, rollback, seeds sanitizados e testes remotos aceitos pelo fluxo GitHub Actions/Cloudflare.

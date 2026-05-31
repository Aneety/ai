# db-tenant-white-label

## Objetivo

Preparar o módulo de estrutura de dados da responsabilidade `tenant-white-label` para os ciclos futuros de banco, isolamento e seeds.

## Runtime permitido

- Persistência deve usar bindings compatíveis com Cloudflare Workers, com D1 como caminho preferencial quando houver modelo relacional.
- Este diretório ainda não contém migrations, DDL, seeds ou testes de dados; eles pertencem ao ciclo `banco`.
- Não usar containers, banco local persistente, Python de runtime MVP, servidor tradicional ou fallback fora de Cloudflare Workers como aceite.

## Dados e contratos

- Tabelas/coleções previstas: `tenants` e `tenant_branding`.
- Requisitos futuros: UUIDs, datas de criação/atualização, exclusão lógica, índices e controles explícitos de isolamento por tenant.
- Metadados de marca devem evitar segredos e não podem transformar DNS/CDN em dependência obrigatória.

## Próximo gate

O próximo gate deste diretório é o ciclo `banco`, com migration/DDL ou contrato de storage, rollback, seed sanitizado da marca inicial e testes remotos aceitos pelo fluxo GitHub Actions/Cloudflare.

# worker-tenant-white-label

## Objetivo

Reservar o BFF da responsabilidade `tenant-white-label` para expor contratos HTTP de tenants e branding em ciclos futuros.

## Runtime permitido

- Cloudflare Workers/Hono é o runtime alvo do MVP.
- Integrações assíncronas, se necessárias no futuro, devem usar mecanismos compatíveis com Workers.
- Este scaffold não implementa rotas, handlers, bindings ou lógica de produto.

## Dados e contratos

- O worker deverá controlar acesso administrativo a tenants e marca por permissão.
- O frontend não pode acessar banco, storage privilegiado, segredo ou fornecedor externo diretamente.
- Erros de domínio devem ser expostos por contrato público sem vazar detalhe técnico.

## Próximo gate

O próximo gate deste diretório é o ciclo `backend`, após `banco`, com contrato HTTP, testes de autorização e evidência remota via PR/GitHub Actions.

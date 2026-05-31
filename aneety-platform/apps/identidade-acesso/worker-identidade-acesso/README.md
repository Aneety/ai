# worker-identidade-acesso

## Objetivo

Reservar o BFF da responsabilidade `identidade-acesso` para expor contratos HTTP de identidade, sessão, perfis e permissões em ciclos futuros.

## Runtime permitido

- Cloudflare Workers/Hono é o runtime alvo do MVP.
- Integrações assíncronas, se necessárias no futuro, devem usar mecanismos compatíveis com Workers.
- Este scaffold não implementa rotas, handlers, bindings, autenticação real ou lógica de produto.

## Dados e contratos

- O worker deverá centralizar login, sessão, revogação e autorização; microfrontends não podem acessar banco, storage privilegiado, segredo ou fornecedor externo diretamente.
- Contratos públicos devem diferenciar falhas de autenticação, autorização, sessão expirada e indisponibilidade sem vazar hash, segredo, stack trace ou detalhe de fornecedor.
- Testes negativos futuros precisam cobrir credencial inválida, sessão revogada, permissão ausente e tentativa de escalonamento de privilégio.

## Próximo gate

O próximo gate deste diretório é o ciclo `backend`, após `banco`, com contrato HTTP, testes de autorização/autenticação e evidência remota via PR/GitHub Actions.

# worker-onboarding-acesso

## Objetivo

Reservar o BFF da responsabilidade `onboarding-acesso` para expor contratos HTTP de convite, primeiro acesso, confirmação de contato, recuperação e lifecycle em ciclos futuros.

## Runtime permitido

- Cloudflare Workers/Hono é o runtime alvo do MVP.
- Integrações assíncronas, se necessárias no futuro, devem usar mecanismos compatíveis com Workers.
- Este scaffold não implementa rotas, handlers, bindings ou lógica de produto.

## Dados e contratos

- O worker deverá validar convite, expiração, recuperação e bloqueio sem expor token bruto, segredo, banco ou provider externo.
- O frontend não pode acessar banco, storage privilegiado, segredo ou fornecedor externo diretamente.
- Erros de domínio devem orientar o usuário em linguagem operacional, preservando detalhes técnicos e sensíveis.

## Próximo gate

O próximo gate deste diretório é o ciclo `backend`, após `banco`, com contrato HTTP, testes de convite/recuperação e evidência remota via PR/GitHub Actions.

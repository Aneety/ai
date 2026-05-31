# worker-pedidos-customizados

## Objetivo

Reservar o BFF da responsabilidade `pedidos-customizados` para expor contratos HTTP de criação, consulta, atualização, exclusão lógica e checkpoints em ciclos futuros.

## Runtime permitido

- Cloudflare Workers/Hono é o runtime alvo do MVP.
- Integrações assíncronas, se necessárias no futuro, devem usar mecanismos compatíveis com Workers.
- Este scaffold não implementa rotas, handlers, bindings ou lógica de produto.

## Dados e contratos

- O worker deverá validar tenant, permissão, versão e transição de checkpoint antes de qualquer mutação futura.
- O frontend não pode acessar banco, storage privilegiado, segredo ou fornecedor externo diretamente.
- Erros de domínio devem orientar o usuário em linguagem operacional, preservando detalhes técnicos e sensíveis.

## Próximo gate

O próximo gate deste diretório é o ciclo `backend`, após `banco`, com contrato HTTP, testes CRUD/checkpoint e evidência remota via PR/GitHub Actions.

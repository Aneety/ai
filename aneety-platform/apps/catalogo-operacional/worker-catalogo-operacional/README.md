# worker-catalogo-operacional

## Objetivo

Reservar o BFF da responsabilidade `catalogo-operacional` para expor contratos HTTP/eventos em ciclos futuros.

## Runtime permitido

- Cloudflare Workers/Hono é o runtime alvo do MVP.
- O worker deve centralizar validação, autorização, isolamento por tenant, erros de domínio e auditoria mínima.
- Este scaffold não implementa rotas, handlers, bindings ou lógica de produto.

## Contrato de experiência

Erros de domínio devem orientar o usuário em linguagem operacional e não vazar detalhe técnico, fornecedor, segredo, stack trace ou banco.

## Próximo gate

O próximo gate deste diretório é `backend`, após `banco`, com contrato, testes e evidência remota via PR/GitHub Actions.

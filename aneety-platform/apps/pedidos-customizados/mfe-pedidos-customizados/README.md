# mfe-pedidos-customizados

## Objetivo

Reservar o microfrontend operacional de pedidos customizados para o ciclo futuro de interface.

## Runtime permitido

- Microfrontend Single SPA é o padrão para frontends operacionais do MVP.
- A interface deve consumir somente gateway/BFF autorizados; nunca banco, segredo, storage privilegiado ou fornecedor externo diretamente.
- Este scaffold não implementa build, rotas, componentes ou lógica visual.

## Dados e contratos

- A tela futura deve orientar criação, listagem, edição, acompanhamento e exclusão lógica de pedidos sem termos técnicos.
- Estados obrigatórios futuros: carregamento, vazio, erro, sucesso, pedido em criação, checkpoint pendente, atualização salva e operação bloqueada.
- Banco, worker, runtime, fornecedor e detalhes de autorização não devem aparecer em UI ou evidência visual.

## Próximo gate

O próximo gate deste diretório é o ciclo `microfrontend`, após backend e teste de integração de API verdes em GitHub Actions/Cloudflare.

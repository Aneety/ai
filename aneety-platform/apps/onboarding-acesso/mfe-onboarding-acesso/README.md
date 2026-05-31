# mfe-onboarding-acesso

## Objetivo

Reservar o microfrontend operacional de primeiro acesso e recuperação para o ciclo futuro de interface.

## Runtime permitido

- Microfrontend Single SPA é o padrão para frontends operacionais do MVP.
- A interface deve consumir somente gateway/BFF autorizados; nunca banco, segredo, storage privilegiado ou fornecedor externo diretamente.
- Este scaffold não implementa build, rotas, componentes ou lógica visual.

## Dados e contratos

- A tela futura deve orientar convite, primeiro acesso, confirmação e recuperação sem termos técnicos.
- Estados obrigatórios futuros: carregamento, vazio, erro, sucesso, convite expirado, recuperação solicitada e bloqueio.
- Tokens, providers, banco e runtime não devem aparecer em UI ou evidência visual.

## Próximo gate

O próximo gate deste diretório é o ciclo `microfrontend`, após backend e teste de integração de API verdes em GitHub Actions/Cloudflare.

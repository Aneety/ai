# mfe-identidade-acesso

## Objetivo

Reservar o microfrontend operacional de administração de usuários, perfis e permissões para o ciclo futuro de interface.

## Runtime permitido

- Microfrontend Single SPA é o padrão para frontends operacionais do MVP.
- A interface deve consumir somente gateway/BFF autorizados; nunca banco, segredo, storage privilegiado ou fornecedor externo diretamente.
- Este scaffold não implementa build, rotas, componentes, autenticação no cliente ou lógica visual.

## Dados e contratos

- A tela futura deve operar usuários, perfis e permissões em linguagem de produto, sem expor hashes, tokens, detalhes de sessão, banco ou fornecedor.
- Estados obrigatórios futuros: carregamento, vazio, erro, sucesso, sessão expirada, permissão insuficiente e operação confirmada.
- Qualquer fluxo de redefinição, convite ou verificação deve respeitar a separação contratual com `onboarding-acesso` quando esse ciclo existir.

## Próximo gate

O próximo gate deste diretório é o ciclo `microfrontend`, após backend e teste de integração de API verdes em GitHub Actions/Cloudflare.

# mfe-tenant-white-label

## Objetivo

Reservar o microfrontend operacional de administração white-label para o ciclo futuro de interface.

## Runtime permitido

- Microfrontend Single SPA é o padrão para frontends operacionais do MVP.
- A interface deve consumir somente gateway/BFF autorizados; nunca banco, segredo, storage privilegiado ou fornecedor externo diretamente.
- Este scaffold não implementa build, rotas, componentes ou lógica visual.

## Dados e contratos

- A tela futura deve administrar tenants e marca em linguagem de produto, sem expor termos de runtime, DNS/CDN, banco ou fornecedor.
- Estados obrigatórios futuros: carregamento, vazio, erro, sucesso e permissões.
- Configurações visuais devem respeitar assets canônicos em `assets/` quando virarem reutilizáveis.

## Próximo gate

O próximo gate deste diretório é o ciclo `microfrontend`, após backend e teste de integração de API verdes em GitHub Actions/Cloudflare.


## Design Google Stitch

- Telas Stitch relacionadas: administração mobile, gestão de tenants, usuários recentes e fluxos ativos.
- Implementar primeiro painel administrativo sem expor chaves, integrações técnicas, runtime ou fornecedor.
- Copy aprovada: “configuração precisa de atenção”, “fluxos ativos”, “usuários recentes”, “permissão insuficiente”.

Referência de triagem: `docs/design/google-stitch-mvp-triage.md`. Template técnico: `aneety-platform/templates/mfe-react-shadcn/`.

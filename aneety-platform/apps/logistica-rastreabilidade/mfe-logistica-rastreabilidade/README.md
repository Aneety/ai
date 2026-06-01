# mfe-logistica-rastreabilidade

## Objetivo

Reservar o microfrontend operacional da responsabilidade `logistica-rastreabilidade` para coleta/entrega, mapa operacional, rastreamento, comprovante e histórico logístico.

## Runtime permitido

- Microfrontend Single SPA é o padrão para frontends operacionais do MVP.
- A interface deve consumir somente gateway/BFF autorizados; nunca banco, segredo, storage privilegiado ou fornecedor externo diretamente.
- Este scaffold não implementa build, rotas, componentes ou lógica visual.

## Design Google Stitch

- Usar `docs/design/google-stitch-mvp-triage.md` como referência de escopo visual.
- Usar `aneety-platform/templates/mfe-react-shadcn/` como base de arquitetura de UI.
- Usar tokens semânticos inspirados no `Aneety Core Identity`, sem copiar HTML do Stitch.
- Remover copy técnica, inglês operacional e acoplamento odontológico fora de demo/seed Lia.

## Estados obrigatórios futuros

Carregando, vazio, erro recuperável, sucesso, offline quando aplicável, conflito quando aplicável, permissão insuficiente e operação confirmada.

## Próximo gate

O próximo gate deste diretório é `microfrontend`, após backend e teste de integração de API verdes em GitHub Actions/Cloudflare.

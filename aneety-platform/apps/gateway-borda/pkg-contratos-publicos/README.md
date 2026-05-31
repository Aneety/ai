# pkg-contratos-publicos

Contrato inicial para tipos, versões e convenções públicas compartilhadas pela borda.

## Conteúdo previsto

- versão de contrato HTTP;
- envelope de erro público;
- convenções de cabeçalho permitidas;
- nomes semânticos de rotas e BFFs;
- tipos compartilhados sem segredo e sem detalhe de infraestrutura.

## Ciclo `deploy`

Este pacote local agora publica constantes versionadas e catálogo de rotas públicas consumidos pelo `worker-gateway`. Ele permanece privado ao monorepo e não contém segredo, token ou detalhe de infraestrutura sensível.

O contrato cobre versão HTTP, cabeçalhos públicos, envelope de erro e nomes semânticos das primeiras rotas para BFFs `worker-*`.

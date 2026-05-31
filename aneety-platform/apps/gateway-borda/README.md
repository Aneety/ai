# gateway-borda

Responsabilidade transversal da borda HTTP do MVP Aneety Platform.

## Escopo inicial

- Runtime alvo: Cloudflare Workers compatível com Hono.
- Módulo de entrada: `worker-gateway`.
- Contratos públicos compartilhados: `pkg-contratos-publicos`.
- Funções mínimas: CORS, versão de contrato, sessão pública Aneety, roteamento e service bindings para BFFs `worker-*`.

## Limites

- O ciclo `deploy` adiciona implementação versionável do `worker-gateway`, pacote local de contratos públicos e configuração Wrangler para dry-run/deploy remoto no Cloudflare gate.
- Não contém segredo, token, binding real sensível ou configuração de ambiente privada.
- Não fecha `publicacao`, `backend`, `teste-integracao-api`, `smoke` ou `teste`.
- O aceite de deploy exige PR, GitHub Actions verdes e Cloudflare gate remoto antes de evidência publicada.

## Evidência do ciclo

A criação desta raiz canônica desbloqueou o ciclo `repositorio` da responsabilidade `gateway-borda` em `docs/project/gateway-borda.md`. O ciclo `deploy` passa a ter artefato deployable em `worker-gateway/wrangler.toml`, mas permanece dependente do gate remoto da PR antes de marcar conclusão operacional.

# gateway-borda

Responsabilidade transversal da borda HTTP do MVP Aneety Platform.

## Escopo inicial

- Runtime alvo: Cloudflare Workers compatível com Hono.
- Módulo de entrada: `worker-gateway`.
- Contratos públicos compartilhados: `pkg-contratos-publicos`.
- Funções mínimas: CORS, versão de contrato, sessão pública Aneety, roteamento e service bindings para BFFs `worker-*`.

## Limites

- Não contém implementação executável neste ciclo `repositorio`.
- Não contém segredo, token, binding real ou configuração de ambiente.
- Não fecha `deploy`, `publicacao`, `backend`, `teste-integracao-api`, `smoke` ou `teste`.
- Qualquer aceite posterior deve passar por PR, GitHub Actions verdes e Cloudflare gate antes de evidência publicada.

## Evidência do ciclo

A criação desta raiz canônica desbloqueia apenas o ciclo `repositorio` da responsabilidade `gateway-borda` em `docs/project/gateway-borda.md`.

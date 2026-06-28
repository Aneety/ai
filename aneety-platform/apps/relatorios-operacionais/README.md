# relatorios-operacionais

Responsabilidade funcional para geração operacional de relatórios PDF sob demanda.

## Módulos

- `worker-relatorios`: Worker Cloudflare que recebe HTML final ou `templateHtml + content` e retorna PDF direto, sem persistência na v1.

## Contrato v1

- Runtime: Cloudflare Workers.
- Renderização PDF: Browser Run Quick Actions por binding `BROWSER`.
- Storage/fila/banco: fora de escopo na v1.
- Custo: deve permanecer dentro da prova de custo zero versionada em `docs/ai-guardrails/cost-proofs/current-services.json`.

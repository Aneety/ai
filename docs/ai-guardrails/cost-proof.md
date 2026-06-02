# Aneety zero-cost proof

Este contrato e a prova JSON versionada em `docs/ai-guardrails/cost-proofs/current-services.json` sao o gate publico de custo zero para Aneety.

## Regra obrigatoria

- Todo servico usado para runtime, CI, publicacao, automacao ou integracao de Aneety deve estar em plano gratuito ou em uso gratuito comprovado.
- Servico pago, desconhecido, expirado, sem fonte oficial de preco ou acima da franquia gratuita bloqueia deploy, merge, fechamento e conclusao final.
- Quando o painel de custo real nao estiver disponivel no Codex, a prova deve registrar consumo observado por evidencias versionadas e projetar o periodo: `projectedUsage = observedUsage / elapsedPeriodRatio`.
- Prova expira em no maximo 7 dias e precisa ser renovada antes de qualquer aceite final.

## Formato minimo

```json
{
  "project": "Aneety/ai",
  "validatedAt": "2026-06-02T21:40:57Z",
  "validUntil": "2026-06-09T21:40:57Z",
  "result": "free",
  "services": [
    {
      "provider": "Cloudflare",
      "service": "Workers Free runtime requests",
      "planName": "Workers Free",
      "pricingSourceUrl": "https://developers.cloudflare.com/workers/platform/limits/",
      "pricingCheckedAt": "2026-06-02T20:40:41Z",
      "usageSource": "publicacao evidence + smoke runs versionados no repo",
      "observedUsage": { "quantity": 2, "unit": "requests/month-to-date" },
      "periodStart": "2026-06-01T00:00:00Z",
      "periodEnd": "2026-07-01T00:00:00Z",
      "freeAllowance": { "quantity": 3000000, "unit": "requests/month" },
      "projectedUsage": { "quantity": 32.24, "unit": "requests/month" },
      "projectedCostUsd": 0,
      "status": "free",
      "calculation": "2 requests observed / 0.062052854938271604 elapsed month ratio = 32.24 projected requests, below 3,000,000 free requests/month."
    }
  ]
}
```

## Fontes oficiais usadas na prova atual

- GitHub Actions: public repositories using standard GitHub-hosted runners are free; private repositories receive plan quotas. See https://docs.github.com/en/billing/concepts/product-billing/github-actions.
- Cloudflare Workers Free: 100,000 requests/day, 10 ms CPU/request, 100 Workers/account and excess free-plan requests fail with Cloudflare error 1027 instead of silently becoming paid usage. See https://developers.cloudflare.com/workers/platform/limits/.
- Cloudflare Workers pricing: Workers Paid is a separate plan; KV/Hyperdrive/Logs have free-plan allowances and paid overages only on paid-capable usage. See https://developers.cloudflare.com/workers/platform/pricing/.
- Cloudflare D1 pricing: Workers Free includes 5,000,000 rows read/day, 100,000 rows written/day and 5 GB total storage; D1 returns errors after daily free limits and does not charge for egress. See https://developers.cloudflare.com/d1/platform/pricing/.

## Uso em evidencias de publicacao

Cada `publication-evidence.json` deve incluir:

```json
{
  "costProofRef": "docs/ai-guardrails/cost-proofs/current-services.json",
  "costProofValidatedAt": "2026-06-02T21:40:57Z",
  "servicesChecked": 6,
  "costResult": "free"
}
```

Sem esses campos, a publicacao nao pode virar aceite.

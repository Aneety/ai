# Template `mfe-*` React, Vite, Single SPA e shadcn/ui

## Objetivo

Padronizar microfrontends operacionais do Aneety MVP antes dos ciclos `microfrontend` de cada responsabilidade.

## Contrato de runtime

- Cada frontend operacional nasce como `aneety-platform/apps/<responsabilidade>/mfe-<responsabilidade>/...`.
- O runtime alvo é Single SPA publicado pelo gate remoto permitido.
- O microfrontend consome somente gateway/BFF autorizados.
- O microfrontend não acessa banco, storage privilegiado, segredo, provedor externo ou função administrativa fora do contrato público.

## Stack padrão

- React + Vite.
- Single SPA para montagem/desmontagem.
- shadcn/ui como base de componentes.
- Tokens semânticos inspirados no `Aneety Core Identity` do Stitch, mapeados para nomes de produto.
- Copy final sem termos técnicos de implementação.

## Componentes obrigatórios por MFE

- `AneetyAppShell`: cabeçalho, navegação responsiva, área principal e slot de alertas.
- `StatusBadge`: status de pedido, etapa, permissão, evidência, pagamento e sincronização.
- `Timeline`: histórico operacional com responsável, data e motivo.
- `DecisionCard`: próxima ação, bloqueio, evidência e consequência.
- `EvidenceCapture`: foto, assinatura, documento, data/hora e localização quando permitida.
- `ComparisonTable`: preço, prazo, capacidade, distância, score e restrições sem expor regra sensível.
- `EmptyState`, `ErrorState`, `LoadingState`, `OfflineState`, `ConflictState`.

## Estados mínimos

- Carregando: informa que dados estão sendo preparados.
- Vazio: explica o que falta e oferece próxima ação.
- Erro recuperável: informa impacto e preserva ação quando possível.
- Sucesso: confirma consequência operacional.
- Offline: mostra fila, itens pendentes e último envio.
- Conflito: bloqueia avanço automático e pede decisão humana.

## Proibição de UI final

Não exibir stack, banco, runtime, fornecedor técnico, segredo, chave, token, hash, adapter, algoritmo, ferramenta interna ou IDs técnicos de operador. Quando precisar comunicar estado técnico, traduzir para impacto de usuário.

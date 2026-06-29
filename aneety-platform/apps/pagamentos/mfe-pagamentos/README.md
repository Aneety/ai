# mfe-pagamentos

## Objetivo

Microfrontend React/Single SPA para gerar faturas simples em PDF a partir de dados de cliente, pagamento e itens.

## Experiência v1

- Form à esquerda com seções `Cliente`, `Pagamento` e `Itens da fatura`.
- Resumo lateral com subtotal, desconto, acréscimos, total, vencimento, status e ação `Gerar PDF`.
- Paleta lavanda/branca e copy em linguagem de produto.
- Sem login/autenticação na v1, por escopo aprovado.
- Sem segredo no browser.

## Stack de UI

- React + Vite;
- Single SPA via `single-spa-react` com exports `bootstrap`, `mount`, `unmount`;
- componentes locais shadcn-style: `Card`, `FieldGroup`, `Field`, `Input`, `Textarea`, `Select`, `Button`, `Alert`, `Separator`, `Badge`, `Skeleton`.

## Contrato de integração

O form chama `POST /api/invoices/pdf` no mesmo Worker, com header `x-aneety-contract-version` e payload de fatura. O template HTML/CSS não vive no frontend; ele é propriedade de `worker-pagamentos`.

## Validação local leve

```bash
npm install
npm run lint
npm run build
npm test
```

Aceite visual final depende de URL publicada e screenshot remoto quando PR/issue exigir evidência UI.

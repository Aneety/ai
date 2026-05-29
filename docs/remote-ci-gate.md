# Gate CI remoto antes de deploy Cloudflare

Este repositório usa GitHub Actions como primeiro gate obrigatório para compilar e validar módulos do monorepo antes de qualquer deploy Cloudflare.

## Fluxo obrigatório

1. Abrir ou atualizar PR.
2. Aguardar o workflow `Remote CI gate` executar no GitHub Actions.
3. Se o workflow falhar, ler logs/checks da PR, corrigir localmente e fazer novo push.
4. Só iniciar deploy Cloudflare quando compilação, lint, typecheck, build e testes de módulo estiverem verdes na PR.
5. Depois do deploy, executar smoke, testes integrados de API ou e2e contra a URL publicada.

## Restrições operacionais

- Não usar deploy Cloudflare como verificador de compilação ou lint.
- Não gastar ciclos Cloudflare com falhas que o GitHub Actions consegue detectar antes.
- Não usar execução local pesada como evidência final de aceite.
- Manter o MVP em runtime 100% compatível com Cloudflare Workers.
- Usar máquina local apenas para inspeção, edição e validações leves/determinísticas.

## Evidência mínima

Antes de deploy, a PR deve mostrar o check `Compile and lint modules` como aprovado. Depois do deploy, a evidência deve apontar para a URL real testada e para o resultado dos testes de smoke/API/e2e.

# Arquitetura — Aneety Platform

A implementação nasce na org `https://github.com/Aneety`, com `Aneety/ai` como monorepo único de implementação, documentação, backlog operacional e assets reutilizáveis do MVP e da evolução inicial. Cada responsabilidade ou derivação deve viver como diretório ou módulo interno sob `aneety-platform/apps/<responsabilidade>/...`, sem repositório próprio nem submódulo por responsabilidade no contrato atual. A documentação canônica vive em `docs/`, o painel operacional em `docs/project/` e os assets reutilizáveis em `assets/` com versão SVG canônica.

Aneety Platform será uma plataforma white-label para operar pedidos de produtos ou serviços customizados. O domínio genérico envolve consumidor, produtor, entrega, evidências, mapas, rastreabilidade em tempo real e garantia de qualidade do pedido e do item personalizado. Lia será o primeiro tenant/marca, e os fluxos odontológicos do MVP ficam como carga inicial de demonstração, seeds e massas de teste.


## Regra de módulos no monorepo

Toda responsabilidade deve existir sob `aneety-platform/apps/<responsabilidade>/...` dentro do monorepo `Aneety/ai`. Dentro de cada responsabilidade, o nome do diretório deve seguir o padrão `aneety-platform/apps/<responsabilidade>/<mfe|mc|gw|worker|fe|job|auto|db|pkg|core|int|wl>-<nome>`.

```text
Aneety/ai -> /Users/mal/GitHub/Aneety/ai
  aneety-platform/
    apps/
      <responsabilidade>/
        mfe-<nome>       Microfrontend Single SPA.
        mc-<nome>        Categoria reservada para cenário pós-MVP com runtime próprio futuro.
        gw-<nome>        Categoria reservada para gateway dedicado futuro, fora do MVP.
        worker-<nome>    BFF ou workload HTTP/assíncrono em Cloudflare Workers/Hono.
        fe-<nome>        Frontend não operacional ou superfície fora do Single SPA.
        job-<nome>       Rotina assíncrona compatível com Cloudflare Workers.
        auto-<nome>      Automação de repositório, CI ou operação interna.
        db-<nome>        Estrutura de dados, migrations, controles de isolamento e seeds do BFF.
        pkg-<nome>       Pacote compartilhado local da responsabilidade.
        core-<nome>      Contrato/domínio central compartilhado.
        int-<nome>       Integração ou adapter externo.
        wl-<nome>        Categoria reservada para workload futuro fora do escopo do MVP.
    tests/
    scripts/
```

Cada diretório folha representa um módulo, pacote, app ou adapter interno do monorepo quando existir implementação própria. A lista define categorias possíveis; não obriga toda responsabilidade a possuir todos os módulos. Cada responsabilidade será criada somente quando houver contrato, owner, dados, aceite, custo zero sempre e limite de escopo.

Regra mandatória do MVP atual: execução 100% Cloudflare Workers. Enquanto o MVP estiver vigente, `worker-*` e `job-*` devem rodar apenas com mecanismos compatíveis com Workers, como rotas HTTP, Queues, Cron Triggers, Workflows ou Durable Objects. `mc-*`, `gw-*` e `wl-*` ficam reservados para cenário pós-MVP mediante PR documental aprovado. Não entram no MVP container, Python, VPS, servidor tradicional, cron externo ou runtime persistente fora de Workers.

## Contrato estrutural permanente

- Toda responsabilidade começa com requisito, interface e critério de aceite antes da implementação.
- Toda responsabilidade deve ser classificada em `aneety-platform/apps/<responsabilidade>/...` antes de criar módulo, package, app ou adapter interno.
- Quando uma responsabilidade virar implementação própria, ela deve nascer dentro do monorepo `Aneety/ai` no caminho canônico correspondente. Separação em repositório próprio só pode acontecer depois do MVP e com ADR/PR documental aprovado.
- O contrato atual usa `Aneety/ai` como repositório único: remoto `https://github.com/Aneety/ai` e clone local `/Users/mal/GitHub/Aneety/ai`.
- A documentação canônica vive em `docs/`, com objetivo, owner, status, runtime, dados, contratos, critérios de aceite e links operacionais.
- Assets reutilizáveis vivem em `assets/`, com SVG canônico e histórico versionado antes de uso por microfrontends, documentação, apresentação, marketing ou operação.
- Dependências entre responsabilidades passam por gateway, BFF ou contrato compartilhado versionado; microfrontend não chama banco nem serviço externo privilegiado diretamente.
- Para responsabilidades com dados e UI, a dependência arquitetural é estrutura de dados/migrations/controles de isolamento -> BFF/worker -> gateway/contrato público -> microfrontend.

## Runtime alvo do MVP

- Todos os frontends operacionais serão microfrontends Single SPA.
- BFFs do MVP serão `worker-<nome>` em Cloudflare Workers/Hono.
- Gateway inicial será `worker-gateway`, também em Cloudflare Workers/Hono.
- Gateway dedicado futuro fica fora do escopo do MVP atual e exige PR documental aprovado.
- Persistência do MVP usa apenas bindings compatíveis com Cloudflare Workers, definidos por responsabilidade conforme contrato local.
- Quando uma responsabilidade exigir modelo relacional, `D1` é caminho preferencial no MVP; `KV`, `R2`, `Durable Objects`, `Queues` e `Workflows` complementam conforme a natureza do dado e do fluxo.
- Storage atua como adapter para bytes; metadados, autorização e lifecycle pertencem à estrutura de dados da responsabilidade.
- Pagamentos atuam como adapter; pedido e conciliação permanecem no domínio Aneety.
- Mapas, localização, mensagens, IA, observabilidade e integrações futuras entram por interfaces substituíveis.
- Documentação oficial fica em `docs/`: guias de usuário, documentação de desenvolvedor, especificações, ADRs, arquitetura e catálogo de módulos.
- Assets reutilizáveis ficam em `assets/`, versionados em SVG e referenciados pelos módulos quando necessário.

## Fluxo de dados

1. Usuário entra por um microfrontend Single SPA publicado sob `aneety.com`.
2. O microfrontend chama `worker-gateway` para login, sessão e roteamento de operações.
3. `worker-gateway` valida borda, CORS, versão de contrato e encaminha para o BFF `worker-*` da responsabilidade.
4. O BFF valida sessão própria, resolve tenant, usuário, perfil e permissões.
5. O BFF executa regra de domínio e persiste usando bindings compatíveis com Workers da sua responsabilidade.
6. Controles de isolamento e autorização reforçam tenant, perfil e permissões dentro da estrutura de dados local.
7. Eventos de status, localização e evidência alimentam mapas e rastreabilidade em tempo real por contrato local.
8. Apps nunca recebem segredo privilegiado nem acessam banco diretamente.

## Integrações opcionais do MVP

Gmail e Google SSO são responsabilidades opcionais separadas no MVP. Elas devem ser ativadas por contrato local e adapter substituível, sem bloquear login, pedido, evidência, auditoria, rastreabilidade ou aceite quando estiverem desligadas ou indisponíveis.

### Gmail em `comunicacao-email`

- `comunicacao-email` cobre a função semântica de e-mail; Gmail é adapter opcional em `int-gmail`.
- BFFs da plataforma chamam `worker-email` ou contrato equivalente; o worker aciona `int-gmail` somente quando a integração estiver habilitada para o tenant.
- Metadados, vínculo com pedido, trilha de auditoria, status de tentativa e regra de permissão ficam em `db-email` ou na estrutura de dados da responsabilidade, não no Gmail.
- Falha, limite ou indisponibilidade do Gmail gera degradação controlada: registrar pendência ou erro operacional sem corromper pedido, evidência, auditoria ou estado de domínio.
- Gmail não pode ser fonte única de pedido, evidência, auditoria, status operacional ou histórico obrigatório.

### Google SSO em `identidade-federada`

- `identidade-federada` cobre a função semântica de vínculo/verificação externa de identidade; Google SSO é adapter opcional em `int-google-sso`.
- O token externo serve somente para confirmar vínculo de identidade externa permitido pelo tenant.
- `worker-gateway` e BFF de identidade emitem sessão própria Aneety depois de validar identidade interna, tenant, perfil, status e permissões.
- Sessão final, revogação, expiração, auditoria e autorização continuam no modelo próprio Aneety.
- Google SSO não pode substituir cadastro interno, permissões internas, sessão própria, controles internos de isolamento ou regra de tenant.

## Evolução planejada

- `worker-gateway` é escolha de MVP para custo zero sempre e simplicidade operacional.
- Quando tráfego, governança ou roteamento exigirem após o MVP, gateway pode migrar para categoria dedicada `gw-*`, sem gasto obrigatório e somente com PR documental aprovado.
- Persistência por responsabilidade via bindings Workers é escolha de MVP para custo zero, simplicidade operacional e aderência ao runtime único.
- Quando operação exigir outro motor de dados, cada responsabilidade só pode evoluir com PR documental aprovado, sem quebrar contratos.
- A migração futura não pode alterar contratos de microfrontend, sessão, permissão, erro, auditoria, mapa ou rastreabilidade sem ADR explícita.

## Limites semânticos de serviços externos

Cloudflare, GitHub, provedores de persistência, storage, pagamento, e-mail, mapas, IA, observabilidade ou qualquer serviço equivalente são **meios substituíveis**, não requisitos de produto por marca. A decisão arquitetural deve sempre registrar a função semântica exercida:

- hospedagem estática de microfrontends;
- runtime stateless de gateway e BFF;
- persistência transacional e histórico do domínio;
- autenticação e autorização modeladas na camada de persistência da plataforma;
- armazenamento de bytes com metadados e permissão na estrutura de dados do BFF responsável;
- versionamento, PR e CI do monorepo;
- documentação centralizada em `Aneety/ai`;
- acervo de assets reutilizáveis em SVG centralizado em `Aneety/ai/assets`;
- DNS/CDN;
- integrações auxiliares como pagamentos, mensagens, e-mail, mapas, IA, filas, analytics e observabilidade.

Limites obrigatórios:

- nenhum serviço pago, proprietário ou específico de fornecedor pode virar caminho obrigatório de aceite;
- SDK, claim, id de usuário, URL ou recurso exclusivo de fornecedor não pode definir regra de domínio;
- cada integração deve ter contrato local, dados tratados, segredos, custo, owner, testes e plano de saída;
- smoke/E2E validam a função semântica, não apenas o nome do fornecedor;
- frontends nunca dependem de banco, IdP externo ou chave pública de fornecedor para autenticação;
- GitHub Pages não hospeda operação transacional; se existir, deve publicar ou apontar somente para documentação mantida em `Aneety/ai/docs`.

## Regras arquiteturais

- Custo zero sempre; qualquer dependência paga vira bloqueio até redesenho ou decisão formal que não seja critério obrigatório do MVP.
- Segredos ficam somente em gateway, BFF, CI seguro ou ambiente local ignorado pelo Git; segredo privilegiado não aparece em frontend, Git, bundle, log, screenshot, fixture pública ou documentação de usuário final.
- Verificação de secrets confirma presença e escopo sem imprimir valores.
- Frontends não acessam banco diretamente para autenticação ou autorização.
- Controles de isolamento, autorização, migrations e índices/keys necessários são pré-condição arquitetural para concluir responsabilidade com dados.
- Monitoramento recorrente segue contrato Aneety vigente, não histórico de implementação.
- Serviço externo deve degradar sem corromper pedido, sessão, permissão, evidência, mapa, rastreabilidade ou auditoria.
- UI de usuário final não expõe nomes de infraestrutura, banco, runtime, framework, secrets ou fornecedores.
- Termos técnicos ficam em docs internas, logs técnicos, runbooks e telas de operador técnico quando existirem.
- Mapas, localização e rastreabilidade em tempo real exigem contrato, permissão e teste quando fizerem parte do fluxo.
- Cada módulo deve ter contrato, testes e owner claro antes de expandir escopo.
- Cada implementação com responsabilidade própria deve viver em `Aneety/ai` no caminho canônico da responsabilidade. Novo repositório de implementação por responsabilidade fica fora do contrato atual.
- Todos os módulos devem ser documentados em `docs/`; o monorepo mantém README, documentação canônica e painel operacional alinhados.
- O contrato atual usa `Aneety/ai` como repositório único: remoto `https://github.com/Aneety/ai` e clone local `/Users/mal/GitHub/Aneety/ai`.
- Todos os assets reutilizáveis devem ser versionados em SVG em `assets/`; módulos de implementação não devem criar variações locais sem registrar a fonte SVG canônica.

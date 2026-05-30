# Processos — Aneety Platform

Este arquivo descreve **como executar** a transição e os incrementos. Regras arquiteturais permanentes ficam em `01-arquitetura.md`; requisitos, requisitos não funcionais e critérios de aceite ficam em `02-requisitos.md`.

## Fluxos operacionais

Os diagramas abaixo mantêm a fonte Mermaid ao lado dos artefatos renderizados em SVG e JPEG.

### Pedidos customizados

Registra a criação e o acompanhamento do pedido customizado, mantendo responsáveis, status, pendências e rastreabilidade até a conclusão.

- Links: [fonte Mermaid](assets/diagrams/fluxo-pedidos-customizados.mmd) / [SVG](assets/diagrams/fluxo-pedidos-customizados.svg) / [JPEG](assets/diagrams/fluxo-pedidos-customizados.jpg)

```mmd
flowchart TD
  A["Consumidor inicia pedido"] --> B["Operação registra dados do pedido"]
  B --> C["Define produto ou serviço customizado"]
  C --> D["Atribui responsável e etapa atual"]
  D --> E["Acompanha status e pendências"]
  E --> F{"Pedido concluído?"}
  F -->|"Não"| D
  F -->|"Sim"| G["Histórico e rastreabilidade disponíveis"]
```

### Produção ou execução

Mostra como a demanda sai do pedido aprovado, passa por aceite ou rejeição do responsável e registra execução, notas, checklist e evidências.

- Links: [fonte Mermaid](assets/diagrams/fluxo-producao-execucao.mmd) / [SVG](assets/diagrams/fluxo-producao-execucao.svg) / [JPEG](assets/diagrams/fluxo-producao-execucao.jpg)

```mmd
flowchart TD
  A["Pedido aprovado"] --> B["Demanda enviada ao produtor ou equipe"]
  B --> C{"Responsável aceita?"}
  C -->|"Não"| D["Registrar rejeição ou reatribuir"]
  C -->|"Sim"| E["Iniciar produção ou execução"]
  E --> F["Registrar notas, checklist e evidências"]
  F --> G["Concluir etapa operacional"]
  D --> B
```

### Garantia de qualidade

Controla checkpoints sensíveis, exigindo evidência e aprovação antes de liberar a próxima etapa do pedido.

- Links: [fonte Mermaid](assets/diagrams/fluxo-garantia-qualidade.mmd) / [SVG](assets/diagrams/fluxo-garantia-qualidade.svg) / [JPEG](assets/diagrams/fluxo-garantia-qualidade.jpg)

```mmd
flowchart TD
  A["Etapa exige qualidade"] --> B["Registrar checkpoint"]
  B --> C{"Evidência obrigatória presente?"}
  C -->|"Não"| D["Bloquear avanço e solicitar correção"]
  C -->|"Sim"| E["Revisar aprovação"]
  E --> F{"Aprovado?"}
  F -->|"Não"| D
  F -->|"Sim"| G["Liberar próxima etapa"]
```

### Retirada, entrega e mapas

Organiza coleta e entrega com aceite do entregador, check-in, localização, mapa, check-out e atualização da rastreabilidade.

- Links: [fonte Mermaid](assets/diagrams/fluxo-retirada-entrega-mapas.mmd) / [SVG](assets/diagrams/fluxo-retirada-entrega-mapas.svg) / [JPEG](assets/diagrams/fluxo-retirada-entrega-mapas.jpg)

```mmd
flowchart TD
  A["Pedido pronto para logística"] --> B["Criar demanda de coleta ou entrega"]
  B --> C{"Entregador aceita?"}
  C -->|"Não"| D["Registrar rejeição e oferecer novamente"]
  C -->|"Sim"| E["Registrar check-in na origem"]
  E --> F["Atualizar localização e mapa"]
  F --> G["Registrar check-out no destino"]
  G --> H["Atualizar rastreabilidade do pedido"]
  D --> B
```

### Anexos e evidências

Descreve captura, validação, armazenamento de bytes, metadados e disponibilização das evidências conforme permissão.

- Links: [fonte Mermaid](assets/diagrams/fluxo-anexos-evidencias.mmd) / [SVG](assets/diagrams/fluxo-anexos-evidencias.svg) / [JPEG](assets/diagrams/fluxo-anexos-evidencias.jpg)

```mmd
flowchart TD
  A["Checkpoint solicita evidência"] --> B["Capturar foto, assinatura ou documento"]
  B --> C["Validar tipo, tamanho e permissão"]
  C --> D{"Arquivo aceito?"}
  D -->|"Não"| E["Informar erro operacional"]
  D -->|"Sim"| F["Salvar bytes no adapter"]
  F --> G["Salvar metadados e vínculo no banco"]
  G --> H["Disponibilizar por permissão"]
```

### Pagamentos

Conduz intenção, consulta e conciliação de pagamento, preservando o pedido mesmo quando o provedor estiver indisponível.

- Links: [fonte Mermaid](assets/diagrams/fluxo-pagamentos.mmd) / [SVG](assets/diagrams/fluxo-pagamentos.svg) / [JPEG](assets/diagrams/fluxo-pagamentos.jpg)

```mmd
flowchart TD
  A["Pedido exige pagamento"] --> B["Criar intenção de pagamento"]
  B --> C["Enviar ao adapter de pagamento"]
  C --> D{"Provedor disponível?"}
  D -->|"Não"| E["Registrar pendência sem corromper pedido"]
  D -->|"Sim"| F["Consultar status"]
  F --> G["Conciliar pagamento com pedido"]
  G --> H["Atualizar status financeiro"]
```

### Marketplace operacional

Permite listar, filtrar, favoritar e acionar atores operacionais, registrando aceite ou rejeição da demanda.

- Links: [fonte Mermaid](assets/diagrams/fluxo-marketplace-operacional.mmd) / [SVG](assets/diagrams/fluxo-marketplace-operacional.svg) / [JPEG](assets/diagrams/fluxo-marketplace-operacional.jpg)

```mmd
flowchart TD
  A["Operação abre marketplace"] --> B["Listar atores permitidos pelo tenant"]
  B --> C["Filtrar por tipo, proximidade ou disponibilidade"]
  C --> D["Favoritar ou selecionar ator"]
  D --> E["Enviar demanda operacional"]
  E --> F{"Ator aceita?"}
  F -->|"Não"| G["Registrar motivo e escolher alternativa"]
  F -->|"Sim"| H["Vincular ator ao fluxo do pedido"]
  G --> C
```

### White-label por tenant

Define marca, logo, cores, textos e fluxos ativos para publicar a experiência de cada tenant sem acoplar o produto a uma única marca.

- Links: [fonte Mermaid](assets/diagrams/fluxo-white-label-tenant.mmd) / [SVG](assets/diagrams/fluxo-white-label-tenant.svg) / [JPEG](assets/diagrams/fluxo-white-label-tenant.jpg)

```mmd
flowchart TD
  A["Administrador configura tenant"] --> B["Definir nome, marca, logo e cores"]
  B --> C["Selecionar textos e fluxos ativos"]
  C --> D["Aplicar tokens semânticos"]
  D --> E["Publicar experiência da marca"]
  E --> F["Validar operação sem acoplar ao tenant Lia"]
```

### Carga inicial de demonstração e testes

Reclassifica evidências úteis do MVP Lia como demo, seed ou massa de teste, sem limitar o produto Aneety à vertical odontológica.

- Links: [fonte Mermaid](assets/diagrams/fluxo-carga-demo-testes.mmd) / [SVG](assets/diagrams/fluxo-carga-demo-testes.svg) / [JPEG](assets/diagrams/fluxo-carga-demo-testes.jpg)

```mmd
flowchart TD
  A["Selecionar evidência útil do MVP Lia"] --> B["Reclassificar como demo, seed ou massa de teste"]
  B --> C["Remover acoplamento à vertical odontológica"]
  C --> D["Validar pedido, produção, qualidade, anexos, mapa e entrega"]
  D --> E["Publicar caso controlado para testes"]
  E --> F["Usar como evidência sem limitar o produto Aneety"]
```

### Administração

Gerencia usuários, identidades, tenants, perfis, permissões, status de acesso e métricas operacionais.

- Links: [fonte Mermaid](assets/diagrams/fluxo-administracao.mmd) / [SVG](assets/diagrams/fluxo-administracao.svg) / [JPEG](assets/diagrams/fluxo-administracao.jpg)

```mmd
flowchart TD
  A["Administrador acessa gestão"] --> B["Gerir usuários e identidades"]
  B --> C["Associar tenant, perfil e permissões"]
  C --> D{"Usuário ativo?"}
  D -->|"Não"| E["Bloquear acesso operacional"]
  D -->|"Sim"| F["Liberar ações por perfil"]
  F --> G["Exibir métricas por tenant e operação"]
```

### Onboarding, catálogo e estados

Conduz entrada de usuários e atores, seleção de catálogo e transições permitidas pela máquina de estados.

- Links: [fonte Mermaid](assets/diagrams/fluxo-onboarding-catalogo-estados.mmd) / [SVG](assets/diagrams/fluxo-onboarding-catalogo-estados.svg) / [JPEG](assets/diagrams/fluxo-onboarding-catalogo-estados.jpg)

```mmd
flowchart TD
  A["Administrador convida usuário ou ator"] --> B["Usuário aceita convite e completa primeiro acesso"]
  B --> C["Operação escolhe item do catálogo"]
  C --> D["Formulário captura atributos de personalização"]
  D --> E["Máquina de estados define próximo passo permitido"]
  E --> F{"Transição permitida para o papel?"}
  F -->|"Não"| G["Bloquear ação e orientar próxima etapa"]
  F -->|"Sim"| H["Registrar evento e liberar próxima ação"]
```

### Precificação, SLA e capacidade

Define orçamento, promessa operacional, disponibilidade e alternativas quando não houver capacidade.

- Links: [fonte Mermaid](assets/diagrams/fluxo-precificacao-sla-capacidade.mmd) / [SVG](assets/diagrams/fluxo-precificacao-sla-capacidade.svg) / [JPEG](assets/diagrams/fluxo-precificacao-sla-capacidade.jpg)

```mmd
flowchart TD
  A["Pedido ou orçamento iniciado"] --> B["Calcular preço base, personalização e urgência"]
  B --> C["Verificar agenda, capacidade e raio de atendimento"]
  C --> D{"Capacidade disponível?"}
  D -->|"Não"| E["Sugerir prazo, responsável ou alternativa"]
  D -->|"Sim"| F["Gerar orçamento e promessa operacional"]
  F --> G{"Cliente aprova?"}
  G -->|"Não"| H["Registrar recusa ou ajuste"]
  G -->|"Sim"| I["Criar pedido com SLA e responsáveis"]
```

### Comunicação, exceções e suporte

Registra mensagens, notificações, disputas, retrabalho e chamados sem perder rastreabilidade do pedido.

- Links: [fonte Mermaid](assets/diagrams/fluxo-comunicacao-excecoes-suporte.mmd) / [SVG](assets/diagrams/fluxo-comunicacao-excecoes-suporte.svg) / [JPEG](assets/diagrams/fluxo-comunicacao-excecoes-suporte.jpg)

```mmd
flowchart TD
  A["Evento operacional ocorre"] --> B["Gerar notificação ou mensagem interna"]
  B --> C{"Há exceção?"}
  C -->|"Não"| D["Registrar comunicação no histórico"]
  C -->|"Sim"| E["Abrir disputa, correção, retrabalho ou suporte"]
  E --> F["Responsável analisa e propõe ação"]
  F --> G{"Resolvido?"}
  G -->|"Não"| H["Escalar ou manter pendência"]
  G -->|"Sim"| I["Atualizar pedido e auditar decisão"]
```

### Offline, privacidade e auditoria

Sincroniza ações de campo, trata conflitos e aplica consentimento, retenção, permissão e auditoria.

- Links: [fonte Mermaid](assets/diagrams/fluxo-offline-privacidade-auditoria.mmd) / [SVG](assets/diagrams/fluxo-offline-privacidade-auditoria.svg) / [JPEG](assets/diagrams/fluxo-offline-privacidade-auditoria.jpg)

```mmd
flowchart TD
  A["Usuário atua em campo"] --> B{"Há conexão?"}
  B -->|"Não"| C["Salvar ação e evidência na fila local"]
  B -->|"Sim"| D["Enviar ação ao gateway"]
  C --> E["Sincronizar quando rede voltar"]
  E --> F{"Conflito detectado?"}
  F -->|"Sim"| G["Bloquear merge automático e pedir resolução"]
  F -->|"Não"| H["Persistir ação"]
  D --> H
  H --> I["Aplicar consentimento, permissão e retenção"]
  I --> J["Registrar auditoria operacional"]
```

### Integração opcional Gmail

Mostra o modo opcional de e-mail: operar sem Gmail quando desligado ou acionar o adapter com degradação controlada quando habilitado.

- Links: [fonte Mermaid](assets/diagrams/fluxo-integracao-gmail.mmd) / [SVG](assets/diagrams/fluxo-integracao-gmail.svg) / [JPEG](assets/diagrams/fluxo-integracao-gmail.jpg)

```mmd
flowchart TD
  A["Fluxo precisa de e-mail"] --> B{"Gmail habilitado para tenant?"}
  B -->|"Não"| C["Operar sem Gmail"]
  B -->|"Sim"| D["Chamar worker de e-mail"]
  D --> E["Adapter int-gmail executa envio ou registro"]
  E --> F{"Falha ou limite?"}
  F -->|"Sim"| G["Registrar pendência controlada"]
  F -->|"Não"| H["Persistir metadados e auditoria fora do Gmail"]
  G --> C
```

### Integração opcional Google SSO

Mostra o vínculo externo opcional de identidade, preservando autenticação, sessão, tenant, perfil e permissões no modelo Aneety.

- Links: [fonte Mermaid](assets/diagrams/fluxo-integracao-google-sso.mmd) / [SVG](assets/diagrams/fluxo-integracao-google-sso.svg) / [JPEG](assets/diagrams/fluxo-integracao-google-sso.jpg)

```mmd
flowchart TD
  A["Usuário solicita acesso"] --> B{"Google SSO habilitado para tenant?"}
  B -->|"Não"| C["Autenticar pelo modelo próprio Aneety"]
  B -->|"Sim"| D["Validar vínculo externo permitido"]
  D --> E{"Vínculo válido?"}
  E -->|"Não"| F["Recusar acesso e auditar"]
  E -->|"Sim"| G["Emitir sessão própria Aneety"]
  G --> H["Aplicar tenant, perfil, permissões e expiração"]
```

## Desenvolvimento

1. Registrar requisito, interface e critério de aceite em `02-requisitos.md` antes de implementar.
2. Classificar responsabilidade, módulo e caminho interno no monorepo conforme `01-arquitetura.md`.
3. Registrar documentação e assets nos destinos canônicos definidos em `01-arquitetura.md` quando o incremento precisar deles.
4. Para responsabilidades com dados e UI, executar na ordem: DB -> BFF/worker -> gateway/contrato público -> microfrontend.
5. Antes de implementar pedidos em produção, fechar contratos mínimos de catálogo, máquina de estados, SLA, orçamento, comunicação, exceções, offline, privacidade, suporte e auditoria.
6. Validar contrato, permissões, erros, estados de UI e copy conforme `02-requisitos.md`.
7. Testar por camada: unitários em contratos/pacotes, integração nos BFFs e E2E público por fluxo crítico quando houver URL publicada.
8. Fechar incremento somente com evidência objetiva de build, smoke, publicação e testes do escopo tocado.

## Limite de execução do Codex

Codex local ou Codex Cloud pode gerar, editar, revisar e versionar código fonte, contratos, documentação e artefatos Markdown de controle. Para código fonte do MVP, compilação, lint, typecheck, build e testes de módulo devem passar primeiro em GitHub Actions na PR. Nenhum ambiente Codex local ou cloud é runtime de aceite do MVP.

A ordem mandatória é: PR -> GitHub Actions verdes -> Cloudflare -> smoke/API/e2e publicado. Deploy, preview, dry-run Cloudflare, smoke, teste integrado de API ou e2e só entram depois do gate remoto da PR, salvo investigação manual explícita registrada como bloqueio ou exceção.

Execução local serve apenas para inspeção, edição, análise estática leve, Git, leitura de logs/checks e preparação de comandos remotos. Simulação local, servidor persistente, container, Python de runtime MVP, Playwright/Cypress local, Wrangler local para aceite, VPS, banco externo obrigatório ou runtime fora de Cloudflare Workers não fecha aceite, não substitui smoke e não vira evidência de produção do MVP.

## Operação

1. Preparar massa controlada e idempotente para smoke/E2E quando o incremento exigir.
2. Verificar secrets antes de deploy real sem imprimir valores.
3. Confirmar backup/export antes de usar dados reais relevantes.
4. Rodar smoke público dos componentes afetados somente em ambiente Cloudflare permitido para o ciclo.
5. Verificar fila offline, conflito de sincronização, consentimento, retenção e auditoria quando houver ação de campo, evidência, localização ou exceção.
6. Conferir monitoramento recorrente contra o contrato Aneety vigente.
7. Registrar bloqueios com causa objetiva e próxima ação.
8. Validar modo desligado de integrações opcionais antes de ativação por tenant.

## Migração do MVP para Aneety Platform

1. Extrair requisitos úteis do MVP atual e docs existentes.
2. Reescrever requisitos no vocabulário white-label genérico, mantendo Lia como tenant inicial.
3. Reclassificar pedidos, moldes, próteses, retirada, entrega e evidências odontológicas como demo, seeds e massas de teste.
4. Ignorar decisões temporárias que pertenciam ao protótipo.
5. Definir responsabilidades genéricas antes de criar diretórios concretos.
6. Criar módulo interno em `Aneety/ai`, documentação e assets somente quando os contratos de `01-arquitetura.md` e `02-requisitos.md` estiverem atendidos.
7. Implementar primeiro contratos compartilhados, DB e BFF da responsabilidade.
8. Integrar microfrontend Single SPA somente depois de BFF e estrutura de dados verificável.
9. Migrar evidências úteis: screenshots, E2E, nomes de status, permissões, fluxos, mapas, rastreabilidade e componentes shadcn.
10. Copiar código legado somente depois de revisar contrato, segurança, isolamento por tenant e copy de usuário final.

## Gate de conclusão por incremento

Executar o gate como checklist operacional, apontando a evidência para `01-arquitetura.md` e `02-requisitos.md`:

1. Requisito rastreado e critério de aceite definido.
2. Responsabilidade, módulo, caminho interno no monorepo, documentação e assets conferidos contra a arquitetura.
3. Migration, controles de isolamento, permissões e isolamento por tenant verificados quando houver dados.
4. BFF/worker com caso feliz e erros esperados verificados quando houver API.
5. Mapas e rastreabilidade testados quando o fluxo exigir localização ou status em tempo real.
6. Catálogo, estados, SLA, orçamento, comunicação, suporte, exceções, offline, privacidade e auditoria testados quando o incremento tocar essas regras.
7. Microfrontend validado com estados de carregamento, vazio, erro e sucesso quando houver UI.
8. Build, execução, smoke, teste de integração de API ou E2E executado em Cloudflare Workers Builds, preview remoto, runtime remoto ou comando Wrangler que use Cloudflare como alvo de validação.
9. Diff, logs e bundle revisados para ausência de segredos.

## Gate de serviços externos

Antes de aceitar qualquer dependência externa, executar:

1. Classificar função semântica em `01-arquitetura.md`.
2. Confirmar requisitos de custo, dados, segredos, contrato local, degradação e plano de saída em `02-requisitos.md`.
3. Registrar owner, adapter e testes do modo feliz e do modo de falha.
4. Se houver violação de requisito ou limite arquitetural, bloquear o incremento e redesenhar.

## Gate de integração opcional do MVP

Antes de ativar Gmail ou Google SSO:

1. Conferir responsabilidade e adapter na arquitetura.
2. Conferir requisitos técnicos e não funcionais da integração.
3. Validar modo desligado por smoke ou E2E.
4. Validar degradação com fornecedor indisponível, recusando acesso ou excedendo limite.
5. Conferir que dados de domínio, sessão final, permissões e auditoria permanecem no modelo Aneety.
6. Revisar evidências para ausência de segredos privilegiados.

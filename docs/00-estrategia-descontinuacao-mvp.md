# Estratégia de descontinuação do MVP Lia

## Objetivo

Encerrar o MVP Lia como linha ativa de implementação e preservar seu valor como evidência histórica, fonte de requisitos, massa inicial de demonstração e aprendizado técnico. O sucessor é **Aneety Platform**, uma plataforma white-label para operar qualquer produto ou serviço customizado que envolva consumidor, produtor, entrega, evidências, rastreabilidade em tempo real e garantia de qualidade do pedido e do item personalizado.

## Motivos para encerrar a linha atual

- O MVP acumulou pivôs de arquitetura, produto, runtime, autenticação e publicação em pouco tempo.
- A divisão em vários repositórios surgiu antes de contratos, banco e processos estarem estáveis.
- Partes da implementação e testes ainda carregam decisões temporárias de protótipo e autenticação transitória.
- O contrato atual evoluiu mais rápido que a base de código, criando diferença entre intenção, documentação e apps publicados.
- A nova linha deve nascer no monorepo `Aneety/ai`, com responsabilidades próprias como módulos internos em `aneety-platform/apps/<responsabilidade>/...`.
- Todos os projetos/repositórios Aneety devem ser clonados em `/Users/mal/GitHub/Aneety/*`, sempre alinhando `https://github.com/Aneety/<repo>` com `/Users/mal/GitHub/Aneety/<repo>`.

## O que preservar

- Fluxos de pedidos, produção de moldes, produção de próteses, retirada, entrega e evidências como carga inicial de demonstração, seeds e massas de teste.
- Regras de acompanhamento ponta a ponta: consumidor, pedido, produtor, etapas de qualidade, coleta, entrega e evidências.
- Marketplace operacional para consumidores, produtores, operadores e entregadores, sem limitar o produto a uma vertical específica.
- Mapas, localização operacional e rastreabilidade em tempo real de pedidos, etapas, retirada e entrega.
- Experiência offline-first para campo e entregadores.
- Superfície operacional para atendimento, produção, qualidade e logística.
- Administração de usuários, perfis, tenants, permissões e white-label.
- Estrutura `aneety-platform/apps/<responsabilidade>/<prefixo>-<nome>` descrita em `01-arquitetura.md` e `05-estrutura-repositorios.md`.
- Clone local obrigatório de todos os projetos/repositórios em `/Users/mal/GitHub/Aneety/*`, incluindo `/Users/mal/GitHub/Aneety/ai`, `/Users/mal/GitHub/Aneety/ai` e `/Users/mal/GitHub/Aneety/ai/assets`.
- Documentação canônica de todos os projetos/repositórios em `Aneety/ai`, com clone local em `/Users/mal/GitHub/Aneety/ai`, incluindo arquitetura, catálogo de repositórios, guias de usuário, documentação de desenvolvedor, ADRs e especificações.
- Assets reutilizáveis do projeto em `Aneety/ai/assets`, com clone local em `/Users/mal/GitHub/Aneety/ai/assets` e versão SVG canônica para logos, ícones, ilustrações, diagramas, marcas, pictogramas e elementos visuais compartilhados.
- Publicação sob `aneety.com` e regra de **custo zero sempre**.

## O que não carregar para o sucessor

- Vertical odontológica do Paraguai como limite de produto; ela permanece somente como demonstração inicial e massa de teste.
- Protótipo local no navegador como critério de aceite.
- Backend convencional de servidor como arquitetura final do MVP.
- Banco documental do primeiro desenho como fonte transacional.
- Publicação operacional em páginas de documentação ou preview de fornecedor.
- Login de frontend acoplado a chave pública de banco ou provedor externo de identidade.
- Segredos, chaves privilegiadas ou credenciais em frontend, Git, screenshots ou logs.
- Apps finais acoplados a módulos fixos antes de estabilizar responsabilidades, contratos, BFFs e schemas.
- Dependências pagas como caminho de aceite; se exigir gasto, o incremento fica bloqueado ou deve ser redesenhado.

## Processo de arquivamento

1. Criar branch ou tag final do MVP com data e commit de referência.
2. Manter os repositórios Lia anteriores acessíveis como fontes históricas.
3. Atualizar o README principal do projeto atual em etapa posterior, apontando para `Aneety/ai` quando o orquestrador estiver público e pronto.
4. Preservar screenshots, E2E, migrations, fluxos odontológicos e contratos como evidência, demo e massa de teste, não como base obrigatória de implementação.
5. Bloquear novas features no MVP atual; aceitar apenas correções documentais ou segurança de transição.
6. Criar checklist de evidências para cada decisão transferida ao orquestrador `Aneety/ai`.
7. Transferir documentação oficial, catálogo de repositórios e decisões arquiteturais para `Aneety/ai`.
8. Transferir ou redesenhar assets reutilizáveis em SVG em `assets/`.

## Checklist mínimo de evidências

- Requisito rastreado para fonte original.
- Decisão registrada nesta documentação canônica em `Aneety/ai/docs`.
- Responsabilidade mapeada para `aneety-platform/apps/<responsabilidade>/...`.
- Implementação própria prevista como módulo interno no monorepo `Aneety/ai`, em `aneety-platform/apps/<responsabilidade>/...`.
- Clone local previsto para o contrato atual em `/Users/mal/GitHub/Aneety/ai`, com documentação em `docs/` e assets em `assets/`.
- Documentação e governança previstas primeiro em `docs/`, antes de qualquer separação futura em repositório próprio pós-MVP.
- Registro documental previsto em `Aneety/ai`, clonado em `/Users/mal/GitHub/Aneety/ai`.
- Asset reutilizável previsto em `Aneety/ai/assets`, clonado em `/Users/mal/GitHub/Aneety/ai/assets`, com SVG canônico quando houver visual compartilhado.
- Prefixo técnico escolhido conforme o contrato de nomes.
- Regra de custo zero sempre e runtime explicitada.
- Dados, segredos e permissões classificados.
- Schema ou migração proposto antes da UI.
- Teste ou critério de aceite associado.

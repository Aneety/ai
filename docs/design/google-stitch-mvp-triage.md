# Triagem Google Stitch para MVP Aneety

## Fonte e regra de uso

- Referência visual: `/Users/mal/GitHub/Aneety/assets/stitch`.
- Briefing Stitch: `/Users/mal/GitHub/Aneety/assets/stitch/Aneety Platform para Google Stitch.pdf`.
- Contrato comparado: `docs/02-requisitos.md`, `docs/03-processos.md` e `docs/project/*`.
- O repositório `assets` é somente fonte de referência. Não copiar HTML gerado pelo Stitch nem editar arquivos nesse repositório.
- Implementação ocorre em `/Users/mal/GitHub/Aneety/ai`.
- Odontologia aparece como demo/seed Lia. O núcleo MVP deve permanecer genérico para produtos e serviços customizados.

## Legenda

- `mvp`: funcionalidade pertence ao MVP e pode orientar implementação quando o ciclo técnico estiver liberado.
- `mvp-parcial`: manter somente o núcleo contratado; itens ricos ou verticais ficam futuros.
- `futuro`: registrar como evolução, sem implementar no MVP.
- `corrigir-copy`: tela tem valor funcional, mas a copy precisa remover vazamento técnico, inglês ou acoplamento vertical.

## Inventário das telas Stitch

| Tela Stitch | Responsabilidade Aneety | Status | Decisão para MVP |
| --- | --- | --- | --- |
| `comparativo_de_cota_es_desktop` | `marketplace-operacional`, `orcamentos-precificacao`, `pagamentos` | `corrigir-copy` | Implementar comparação preço, prazo, capacidade, distância, score e escolha. Remover “System Recommendation”, “confidence score” sensível e copy em inglês; usar “recomendação operacional” explicável sem regra sensível. |
| `dashboard_do_fornecedor_mobile` | `pedidos-customizados`, `producao-execucao`, `qualidade-evidencias` | `mvp-parcial` | Manter painel de demandas, cotações, produção e qualidade. Marketplace visual rico e busca de oportunidades ficam futuros. |
| `detalhe_do_pedido_operador` | `pedidos-customizados`, `workflow-estados`, `pagamentos`, `qualidade-evidencias` | `corrigir-copy` | Implementar detalhe com status, responsável, timeline, evidências, custódia e ações permitidas. Remover anexos CAD/3D/OBJ como requisito de produto; aceitar somente como evidência/demo. |
| `abertura_de_disputa_mobile` | `suporte-excecoes`, `pagamentos`, `auditoria-operacional` | `mvp` | Implementar abertura de disputa com motivo, evidências, nexo causal, impacto financeiro e auditoria. Trocar “inquilino” por “tenant” apenas em admin ou “operação” para usuário final. |
| `aprova_o_de_qualidade_operador` | `qualidade-evidencias`, `workflow-estados`, `auditoria-operacional` | `corrigir-copy` | Implementar aprovação/reprovação bloqueante com checklist, evidências, responsável e motivo. Remover IDs técnicos e termos em inglês. |
| `coleta_e_entrega_entregador` | `logistica-rastreabilidade`, `offline-sync`, `qualidade-evidencias` | `corrigir-copy` | Implementar aceite, rota, check-in/check-out, foto e offline. Trocar “OFFLINE MODE — SYNC PENDING” por “ações pendentes de envio”. |
| `dashboard_de_administra_o_mobile` | `tenant-white-label`, `identidade-acesso`, `workflow-estados` | `corrigir-copy` | Implementar tenants, usuários, fluxos ativos e métricas. Remover “chaves de API” e qualquer referência técnica; usar “configuração precisa de atenção”. |
| `registro_de_evid_ncias_mobile` | `qualidade-evidencias`, `offline-sync`, `auditoria-operacional` | `mvp` | Implementar captura de foto, assinatura, documento, data/hora, localização quando permitida e envio com estados pendentes. |
| `boas_vindas_ao_fornecedor` | `onboarding-acesso`, `marketplace-operacional` | `mvp-parcial` | Manter boas-vindas e passos de cadastro/catálogo/verificação. Promessas de crescimento e dashboard analítico avançado ficam futuras. |
| `cadastro_em_an_lise` | `onboarding-acesso`, `identidade-acesso` | `mvp` | Implementar estado de cadastro enviado, análise, próximos passos e suporte. Evitar promessa automática sem contrato. |
| `configura_o_de_recebimento` | `pagamentos`, `privacidade-consentimento` | `mvp-parcial` | Manter dados necessários a repasse e recebimento. Seleção bancária completa, PIX detalhado e nível de segurança visual ficam para ciclo `pagamentos`. |
| `configura_o_operacional` | `catalogo-operacional`, `sla-capacidade`, `marketplace-operacional` | `mvp` | Implementar categorias, raio de atuação, capacidade e região. Remover menção a algoritmo; usar “priorização operacional”. |
| `detalhes_da_transa_o_mobile` | `pagamentos`, `auditoria-operacional` | `corrigir-copy` | Implementar custódia, status, referência de pedido e comprovante. Remover “hash da transação” da UI final. |
| `extrato_financeiro_detalhado_mobile` | `pagamentos` | `mvp-parcial` | Manter saldo, custódia, a receber e histórico básico. Filtros avançados e taxas recorrentes ficam futuras. |
| `identifica_o_do_neg_cio` | `onboarding-acesso`, `identidade-acesso`, `privacidade-consentimento` | `mvp` | Implementar cadastro de negócio, contato, documentação e rascunho. Copy deve evitar jargão jurídico excessivo. |
| `aprova_o_final_e_ativa_o` | `onboarding-acesso`, `identidade-acesso` | `mvp-parcial` | Implementar ativação e próximos passos. Marketplace, fretes automáticos e gerente de conta ficam futuros. |
| `confirma_o_de_reenvio_fornecedor` | `onboarding-acesso`, `comunicacao-operacional` | `mvp` | Implementar confirmação de correção reenviada e status de reavaliação. E-mail/push não pode ser obrigatório. |
| `detalhes_do_cadastro_administrador` | `onboarding-acesso`, `identidade-acesso`, `tenant-white-label` | `corrigir-copy` | Implementar revisão administrativa de cadastro, documentos, capacidade e decisão. Trocar labels inglesas por português operacional. |
| `modal_de_motivo_de_rejei_o_mobile` | `onboarding-acesso`, `suporte-excecoes`, `auditoria-operacional` | `mvp` | Implementar motivo obrigatório para rejeição/correção e trilha auditável. |
| `painel_de_aprova_o_de_fornecedores_mobile` | `onboarding-acesso`, `marketplace-operacional` | `mvp` | Implementar fila de aprovação, prioridade, atraso e análise. |
| `solicita_o_de_corre_o_fornecedor` | `onboarding-acesso`, `comunicacao-operacional` | `mvp` | Implementar lista de correções e reenvio com motivo. |
| `avaliar_fornecedor_pedido_2948` | `marketplace-operacional`, `qualidade-evidencias` | `mvp-parcial` | Manter avaliação simples para histórico/score. Reviews públicos e recursos sociais ficam futuros. |
| `chat_com_envio_de_foto_pedido_2948` | `comunicacao-operacional`, `qualidade-evidencias` | `mvp-parcial` | Manter mensagem vinculada a pedido e evidência anexada. Chat em tempo real fica futuro. |
| `chat_com_o_comprador_pedido_2948` | `comunicacao-operacional` | `mvp-parcial` | Manter registro de mensagens por pedido. Chamada, presença online e chat ao vivo ficam futuros. |
| `close_up_photo_of_a_dental_zirconia_crown_being_polished_in_a_laboratory` | `demo-seeds` | `futuro` | Usar somente como referência visual/demo Lia, não como asset obrigatório do MVP. |
| `confirma_o_de_envio_pedido_2948` | `logistica-rastreabilidade`, `pedidos-customizados` | `mvp` | Implementar confirmação de despacho, comprovante e código de rastreio quando aplicável. |
| `detalhes_do_pedido_2948` | `pedidos-customizados`, `pagamentos`, `logistica-rastreabilidade` | `mvp-parcial` | Manter status, itens, entrega e resumo financeiro. Taxa de plataforma explícita e vertical odontológica ficam parametrizadas por tenant/demo. |
| `perfil_do_fornecedor_laborat_rio_central` | `marketplace-operacional`, `catalogo-operacional` | `mvp-parcial` | Manter capacidade, região, SLA, score e credenciamento. Portfólio, top vendas e avaliações públicas ficam futuras. |
| `rastreamento_do_pedido_2948` | `logistica-rastreabilidade` | `mvp` | Implementar eventos de rastreabilidade, destino, status e visibilidade por permissão. |
| `aviso_de_atraso_mobile` | `sla-capacidade`, `comunicacao-operacional`, `workflow-estados` | `mvp` | Implementar motivo de atraso, nova estimativa e aviso operacional. E-mail/push obrigatório fica fora. |
| `confirma_o_de_recebimento_pedido_2948` | `logistica-rastreabilidade`, `suporte-excecoes`, `pagamentos` | `mvp` | Implementar confirmação de entrega/recebimento e opção de disputa. |
| `dashboard_do_laborat_rio_laborat_rio_central` | `producao-execucao`, `marketplace-operacional` | `mvp-parcial` | Manter demandas, produção e finalizados. Especialização odontológica fica demo Lia. |
| `gerenciar_ordem_de_produ_o_pedido_2948` | `producao-execucao`, `qualidade-evidencias`, `workflow-estados` | `corrigir-copy` | Implementar etapas, conclusão, anexos e observação. Remover CAD/CNC como regra geral; usar “etapa de execução” genérica. |
| `hist_rico_de_produ_o_atualizado` | `producao-execucao`, `auditoria-operacional`, `sla-capacidade` | `corrigir-copy` | Implementar histórico com atraso, justificativa, responsável e nova estimativa. Remover “sistema automatizado”. |
| `perfil_do_fornecedor_atualizado_laborat_rio_central` | `marketplace-operacional`, `catalogo-operacional` | `mvp-parcial` | Mesma decisão do perfil de fornecedor: núcleo operacional no MVP; vitrine pública futura. |
| `solicitar_or_amento_laborat_rio_central_1` | `orcamentos-precificacao`, `pedidos-customizados`, `qualidade-evidencias` | `corrigir-copy` | Implementar solicitação de orçamento e anexos decisórios. Remover STL/scans como requisito de produto. |
| `solicitar_or_amento_laborat_rio_central_2` | `orcamentos-precificacao`, `catalogo-operacional`, `pedidos-customizados` | `mvp-parcial` | Manter seleção de item, dados decisórios, anexos e urgência. Campos odontológicos ficam demo/configuração por tenant. |
| `comprovante_de_entrega_mobile` | `logistica-rastreabilidade`, `qualidade-evidencias` | `mvp` | Implementar recebedor, foto, assinatura, rascunho e finalização. |
| `dashboard_de_performance_log_stica_mobile` | `logistica-rastreabilidade` | `mvp-parcial` | Manter métricas operacionais básicas. Ranking, níveis e gamificação de motoristas ficam futuro. |
| `hist_rico_log_stico_pedido_2948` | `logistica-rastreabilidade`, `auditoria-operacional` | `mvp` | Implementar histórico de eventos de coleta, rota, hub e entrega com responsável quando permitido. |

As pastas `stitch_aneety_b2b_white_label_platform 8/*` repetem telas de disputa, qualidade, coleta/entrega, administração e evidências já classificadas acima; usar como referência duplicada, sem nova funcionalidade.

## Funcionalidades futuras explícitas

- Marketplace público rico, vitrine/portfólio, “top vendas” e reviews detalhados.
- Chat em tempo real, presença online, chamada telefônica embutida, push/e-mail obrigatório.
- Ranking/níveis de motoristas, gamificação e leaderboard.
- Benchmarking, gráficos financeiros avançados e confidence score sensível.
- CAD/3D/STL/OBJ como ferramenta ou requisito de produto.
- Recomendações que exponham regra sensível ou pareçam decisão automática sem explicação operacional.

## Gaps que o Stitch não fechou completamente

- Entrada/seleção de tenant e papel antes do dashboard.
- Login próprio, recuperação, sessão expirada e permissão insuficiente.
- Estados carregando, vazio, erro recuperável, sucesso, offline e conflito em todas as telas críticas.
- Workspace de revisão com versões, comentários, aprovação e pedido de complemento.
- Cold-start operacional: nicho, região, catálogo inicial, convite de oferta, cobertura mínima e liberação do marketplace.
- Modo desligado para e-mail e SSO externo.

## Regras de copy antes de implementar UI

- Usuário final não vê fornecedor técnico, runtime, banco, segredo, hash, token, chave, stack, adapter, algoritmo ou ferramenta interna.
- Usar: “configuração precisa de atenção”, “ação pendente de envio”, “recomendação operacional”, “comprovante”, “custódia protegida”, “responsável”, “permissão insuficiente”.
- Não usar: “API keys”, “HASH”, “automated escrow system”, “System Recommendation”, “algorithm”, “Field Technician ID”, “OFFLINE MODE”.
- Labels e botões devem ficar em português operacional, exceto nomes próprios de tenant/marca.

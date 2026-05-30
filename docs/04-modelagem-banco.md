# Modelagem de dados — Aneety Platform

## Princípios

- A persistência transacional do MVP usa apenas bindings compatíveis com Cloudflare Workers.
- Quando a responsabilidade exigir modelo relacional no MVP, `D1` é o caminho preferencial; `KV`, `R2`, `Durable Objects`, `Queues` e `Workflows` complementam conforme contrato local.
- Cada estrutura de dados pertence ao `db-<nome>` da mesma responsabilidade do BFF `worker-<nome>`.
- Cada estrutura de dados deve ser independente das demais responsabilidades.
- Quando for necessário relacionar um dado com outro dado de outra responsabilidade, a ligação lógica deve usar identificadores externos com sufixo `_eid` (`External ID`), não dependência física direta entre stores.
- As modelagens devem assumir migração futura por responsabilidade para outro motor de dados somente com PR documental aprovado e preservação de contratos.
- Essas definições são obrigatórias para todas as modelagens de dados.
- Toda entidade operacional tem `tenant_id`.
- Chaves primárias usam UUID.
- Datas usam `timestamptz`.
- Nenhum registro pode ser excluído fisicamente do banco.
- Toda alteração operacional deve criar um novo registro com nova versão, preservando o histórico anterior.
- Exclusão lógica marca todos os registros da mesma série histórica com a mesma data-hora em `deleted_at`.
- Todas as tabelas devem ter `created_at` e `deleted_at`.
- Índices mínimos cobrem `tenant_id`, status, responsáveis e `updated_at`.
- Controles de isolamento por tenant, perfil e permissão são obrigatórios em estruturas expostas ou sensíveis.
- Credenciais são armazenadas apenas como hash forte e salgado, nunca em texto puro.
- Tokens de convite, confirmação, recuperação, sessão e integração são armazenados somente como hash ou referência segura, nunca em texto puro.
- Configurações de integrações opcionais guardam somente adapter, status e referência segura de credencial; segredo real permanece fora do banco operacional e fora do Git.
- Sessões têm expiração, revogação, rotação e vínculo explícito com identidade, tenant e perfil efetivo.
- Frontends e microfrontends Single SPA nunca acessam banco diretamente.
- Mapas e rastreabilidade em tempo real usam eventos e snapshots com permissão por tenant/perfil; fornecedor de mapa não define regra de domínio.
- Pedidos, moldes, próteses, retirada, entrega e evidências odontológicas são seeds/demo/test mass, não limite do modelo.

## Posse e isolamento

- Cada BFF acessa somente bindings e estruturas da sua responsabilidade, salvo contrato explícito em `core-<nome>` ou `pkg-<nome>`.
- Dependência entre responsabilidades deve passar por contrato versionado, não por leitura informal de estrutura alheia.
- Funções auxiliares e namespaces privados devem permanecer isolados quando aplicável.
- Controles de isolamento devem reforçar tenant, perfil e permissões mesmo quando o acesso partir de BFF privilegiado.
- Migração futura para outro motor por responsabilidade deve preservar nomes semânticos, contratos HTTP e políticas de autorização.

## Tabelas conceituais iniciais

As tabelas abaixo são modelo conceitual mínimo. A posse definitiva será definida quando cada responsabilidade receber seu `db-<nome>` e sua estrutura de dados principal.

### `tenants`

Representa organizações/marcas operando na plataforma. Campos mínimos: `id`, `slug`, `name`, `status`, `created_at`, `updated_at`, `deleted_at`.

### `tenant_branding`

Configuração white-label por tenant. Campos mínimos: `id`, `tenant_id`, `brand_name`, `logo_url`, `primary_color`, `secondary_color`, `texts`, `created_at`, `updated_at`, `deleted_at`.

### `app_identities`

Identidade de acesso própria da plataforma. Campos mínimos: `id`, `tenant_id`, `email`, `phone`, `display_name`, `status`, `created_at`, `updated_at`, `deleted_at`.

### `auth_credentials`

Credenciais vinculadas à identidade. Campos mínimos: `id`, `tenant_id`, `identity_id`, `credential_type`, `password_hash`, `password_updated_at`, `revoked_at`, `created_at`, `deleted_at`.

### `auth_sessions`

Sessões e tokens próprios. Campos mínimos: `id`, `tenant_id`, `identity_id`, `access_token_hash`, `refresh_token_hash`, `expires_at`, `refresh_expires_at`, `revoked_at`, `created_at`, `last_seen_at`, `deleted_at`.

### `app_users`

Usuário operacional dentro de um tenant. Campos mínimos: `id`, `tenant_id`, `identity_id`, `access_profile_id`, `full_name`, `email`, `phone`, `role`, `is_active`, `created_at`, `updated_at`, `deleted_at`.

### `access_profiles`

Perfis de acesso por tenant. Campos mínimos: `id`, `tenant_id`, `name`, `role`, `is_system`, `created_at`, `updated_at`, `deleted_at`.

### `permissions`

Catálogo de permissões. Campos mínimos: `id`, `key`, `description`, `scope`, `created_at`, `deleted_at`.

### `access_profile_permissions`

Associação entre perfil e permissões. Campos mínimos: `id`, `tenant_id`, `access_profile_id`, `permission_id`, `created_at`, `deleted_at`.

### `access_invitations`

Convites para consumidores, produtores, operadores, entregadores e administradores. Campos mínimos: `id`, `tenant_id`, `invited_identity_id`, `invited_email_hash`, `invited_phone_hash`, `access_profile_id`, `role`, `status`, `token_hash`, `expires_at`, `accepted_at`, `created_by_user_id`, `created_at`, `updated_at`, `deleted_at`.

### `onboarding_progress`

Progresso de primeiro acesso por identidade, papel e tenant. Campos mínimos: `id`, `tenant_id`, `identity_id`, `app_user_id`, `role`, `current_step`, `status`, `terms_accepted_at`, `contact_confirmed_at`, `completed_at`, `created_at`, `updated_at`, `deleted_at`.

### `contact_verification_requests`

Confirmações de e-mail ou telefone para acesso e onboarding. Campos mínimos: `id`, `tenant_id`, `identity_id`, `contact_type`, `contact_hash`, `verification_code_hash`, `status`, `expires_at`, `verified_at`, `attempt_count`, `created_at`, `updated_at`, `deleted_at`.

### `access_recovery_requests`

Solicitações de recuperação de acesso. Campos mínimos: `id`, `tenant_id`, `identity_id`, `recovery_type`, `token_hash`, `status`, `expires_at`, `used_at`, `created_at`, `updated_at`, `deleted_at`.

### `access_lifecycle_events`

Eventos de ativação, bloqueio, reativação e recuperação administrativa de acesso. Campos mínimos: `id`, `tenant_id`, `identity_id`, `app_user_id`, `event_type`, `reason`, `actor_user_id`, `occurred_at`, `created_at`, `deleted_at`.

### `federated_identity_settings`

Configuração opcional de provedor externo de identidade por tenant. Campos mínimos: `id`, `tenant_id`, `provider_adapter`, `status`, `credential_reference`, `allowed_domains`, `created_at`, `updated_at`, `deleted_at`.

### `external_identity_links`

Vínculo entre identidade Aneety e identidade externa autorizada. Campos mínimos: `id`, `tenant_id`, `identity_id`, `provider_adapter`, `external_subject_hash`, `external_email_hash`, `status`, `linked_at`, `revoked_at`, `created_at`, `updated_at`, `deleted_at`.

### `federated_login_attempts`

Tentativas de login federado para auditoria e degradação controlada. Campos mínimos: `id`, `tenant_id`, `identity_id`, `provider_adapter`, `external_subject_hash`, `result`, `failure_reason`, `occurred_at`, `created_at`, `deleted_at`.

### `orders`

Pedido customizado. Campos mínimos: `id`, `tenant_id`, `client_reference`, `consumer_name`, `consumer_phone`, `delivery_address`, `product_or_service`, `customization_spec`, `quality_status`, `status`, `payment_status`, `assigned_to`, `notes`, `version`, `created_at`, `updated_at`, `deleted_at`.

### `order_checkpoints`

Etapas e evidências do pedido. Campos mínimos: `id`, `tenant_id`, `order_id`, `key`, `label`, `completed`, `requires_quality_approval`, `actor_user_id`, `occurred_at`, `notes`, `created_at`, `updated_at`, `deleted_at`.

### `quality_reviews`

Revisões de qualidade do pedido ou item personalizado. Campos mínimos: `id`, `tenant_id`, `order_id`, `checkpoint_id`, `review_status`, `reviewer_user_id`, `notes`, `occurred_at`, `created_at`, `deleted_at`.

### `attachments`

Metadados de fotos, assinaturas e arquivos. Campos mínimos: `id`, `tenant_id`, `order_id`, `checkpoint_id`, `kind`, `filename`, `content_type`, `size_bytes`, `storage_adapter`, `storage_path`, `captured_at`, `created_at`, `deleted_at`.

### `payment_intents`

Intenções e conciliação de pagamento. Campos mínimos: `id`, `tenant_id`, `order_id`, `provider_adapter`, `amount`, `currency`, `status`, `checkout_url`, `provider_reference`, `created_at`, `updated_at`, `deleted_at`.

### `sync_events`

Fila e auditoria de sincronização offline. Campos mínimos: `id`, `tenant_id`, `app_user_id`, `device_id`, `entity`, `entity_id`, `operation`, `status`, `payload`, `error_message`, `created_at`, `updated_at`, `deleted_at`.

### `marketplace_actors`

Consumidores, produtores, operadores e entregadores listáveis. Campos mínimos: `id`, `tenant_id`, `actor_type`, `public_name`, `avatar_url`, `approx_location`, `price_label`, `score`, `contact_label`, `availability`, `status`, `created_at`, `updated_at`, `deleted_at`.

### `marketplace_favorites`

Favoritos por tenant/usuário. Campos mínimos: `id`, `tenant_id`, `app_user_id`, `actor_id`, `created_at`, `deleted_at`.

### `production_demands`

Demandas para produtores, operadores ou equipes responsáveis pelo produto/serviço customizado. Campos mínimos: `id`, `tenant_id`, `order_id`, `requested_by_actor_id`, `producer_actor_id`, `status`, `rejection_reason`, `created_at`, `updated_at`, `deleted_at`.

### `delivery_demands`

Demandas para entregadores. Campos mínimos: `id`, `tenant_id`, `order_id`, `requested_by_actor_id`, `delivery_actor_id`, `origin_label`, `destination_label`, `status`, `rejection_reason`, `created_at`, `updated_at`, `deleted_at`.

### `delivery_evidences`

Fotos e evidências de retirada/entrega. Campos mínimos: `id`, `tenant_id`, `delivery_demand_id`, `order_id`, `checkpoint_key`, `attachment_id`, `origin_label`, `destination_label`, `actor_user_id`, `occurred_at`, `created_at`, `deleted_at`.

### `tracking_events`

Eventos de rastreabilidade em tempo real para status, localização e evidências. Campos mínimos: `id`, `tenant_id`, `order_id`, `actor_user_id`, `event_type`, `status`, `latitude`, `longitude`, `accuracy_meters`, `occurred_at`, `metadata`, `created_at`, `deleted_at`.

### `map_snapshots`

Snapshots calculados para exibição de mapas e acompanhamento operacional. Campos mínimos: `id`, `tenant_id`, `order_id`, `delivery_demand_id`, `current_status`, `last_latitude`, `last_longitude`, `last_event_at`, `route_summary`, `visibility_scope`, `created_at`, `updated_at`, `deleted_at`.

### `audit_events`

Auditoria de ações sensíveis. Campos mínimos: `id`, `tenant_id`, `actor_identity_id`, `actor_user_id`, `action`, `entity`, `entity_id`, `metadata`, `created_at`, `deleted_at`.

### `catalogs`

Catálogos configuráveis por tenant. Campos mínimos: `id`, `tenant_id`, `name`, `status`, `created_at`, `updated_at`, `deleted_at`.

### `catalog_items`

Produtos ou serviços customizáveis. Campos mínimos: `id`, `tenant_id`, `catalog_id`, `name`, `description`, `base_price`, `base_sla_minutes`, `requires_budget_approval`, `status`, `created_at`, `updated_at`, `deleted_at`.

### `catalog_item_options`

Atributos e opções de personalização. Campos mínimos: `id`, `tenant_id`, `catalog_item_id`, `key`, `label`, `value_type`, `required`, `price_delta`, `sla_delta_minutes`, `created_at`, `updated_at`, `deleted_at`.

### `workflow_states`

Estados oficiais por fluxo operacional. Campos mínimos: `id`, `tenant_id`, `entity`, `state_key`, `label`, `is_initial`, `is_terminal`, `created_at`, `updated_at`, `deleted_at`.

### `workflow_state_transitions`

Transições permitidas por papel e permissão. Campos mínimos: `id`, `tenant_id`, `entity`, `from_state_key`, `to_state_key`, `required_permission`, `requires_reason`, `created_at`, `updated_at`, `deleted_at`.

### `sla_policies`

Regras de prazo, prioridade e alerta. Campos mínimos: `id`, `tenant_id`, `entity`, `state_key`, `priority`, `target_minutes`, `warning_minutes`, `created_at`, `updated_at`, `deleted_at`.

### `operational_schedules`

Agenda, bloqueio e disponibilidade de atores operacionais. Campos mínimos: `id`, `tenant_id`, `actor_id`, `starts_at`, `ends_at`, `capacity_units`, `status`, `reason`, `created_at`, `updated_at`, `deleted_at`.

### `budget_requests`

Orçamentos e cotações antes ou durante o pedido. Campos mínimos: `id`, `tenant_id`, `order_id`, `requested_by_actor_id`, `status`, `total_amount`, `currency`, `expires_at`, `approved_at`, `rejected_at`, `created_at`, `updated_at`, `deleted_at`.

### `budget_items`

Linhas de preço de orçamento. Campos mínimos: `id`, `tenant_id`, `budget_request_id`, `label`, `amount`, `reason`, `created_at`, `updated_at`, `deleted_at`.

### `operational_messages`

Mensagens internas, avisos ao cliente e comunicação por pedido ou demanda. Campos mínimos: `id`, `tenant_id`, `order_id`, `actor_user_id`, `visibility_scope`, `message_body`, `created_at`, `deleted_at`.

### `notifications`

Notificações in-app e pendências de leitura. Campos mínimos: `id`, `tenant_id`, `recipient_user_id`, `entity`, `entity_id`, `title`, `body`, `status`, `created_at`, `read_at`, `deleted_at`.

### `email_integration_settings`

Configuração opcional de e-mail por tenant e adapter. Campos mínimos: `id`, `tenant_id`, `provider_adapter`, `status`, `credential_reference`, `sender_label`, `created_at`, `updated_at`, `deleted_at`.

### `email_records`

Registro auxiliar de envio, recebimento ou vínculo de e-mail sem transformar o provedor em fonte de domínio. Campos mínimos: `id`, `tenant_id`, `entity`, `entity_id`, `actor_user_id`, `direction`, `visibility_scope`, `from_label`, `to_label_hash`, `subject`, `status`, `created_at`, `updated_at`, `deleted_at`.

### `email_delivery_attempts`

Tentativas de entrega ou registro de e-mail por adapter. Campos mínimos: `id`, `tenant_id`, `email_record_id`, `provider_adapter`, `provider_reference`, `status`, `error_message`, `attempted_at`, `created_at`, `deleted_at`.

### `support_cases`

Chamados operacionais vinculados a pedido, usuário, ator ou tenant. Campos mínimos: `id`, `tenant_id`, `order_id`, `opened_by_user_id`, `assigned_to_user_id`, `status`, `category`, `priority`, `summary`, `created_at`, `updated_at`, `closed_at`, `deleted_at`.

### `exception_cases`

Disputas, correções, retrabalho, devolução operacional, reentrega ou reembolso parcial. Campos mínimos: `id`, `tenant_id`, `order_id`, `case_type`, `status`, `reason`, `impact_summary`, `resolved_by_user_id`, `created_at`, `updated_at`, `resolved_at`, `deleted_at`.

### `actor_capacity_slots`

Capacidade operacional planejada por produtor, equipe ou entregador. Campos mínimos: `id`, `tenant_id`, `actor_id`, `date`, `capacity_units`, `reserved_units`, `status`, `created_at`, `updated_at`, `deleted_at`.

### `consent_records`

Consentimentos para localização, evidências, assinatura, contato e comunicação. Campos mínimos: `id`, `tenant_id`, `identity_id`, `consent_type`, `status`, `source`, `granted_at`, `revoked_at`, `created_at`, `deleted_at`.

### `offline_conflicts`

Conflitos de sincronização offline que exigem decisão humana. Campos mínimos: `id`, `tenant_id`, `sync_event_id`, `entity`, `entity_id`, `conflict_type`, `local_payload`, `server_payload`, `status`, `resolved_by_user_id`, `created_at`, `updated_at`, `deleted_at`.

### `audit_event_changes`

Valores antes/depois para ações sensíveis auditadas. Campos mínimos: `id`, `tenant_id`, `audit_event_id`, `field_name`, `old_value`, `new_value`, `created_at`, `deleted_at`.

### `demo_seed_cases`

Catálogo de seeds e massas de teste. Campos mínimos: `id`, `tenant_id`, `scenario_key`, `vertical_label`, `description`, `payload`, `created_at`, `updated_at`, `deleted_at`.

## Índices mínimos

- `tenant_id` em todas as tabelas operacionais.
- `(tenant_id, status, updated_at desc)` em pedidos, demandas, pagamentos, orçamentos, suporte, exceções e sync.
- `(tenant_id, order_id, occurred_at desc)` em eventos de rastreabilidade.
- `(tenant_id, order_id, updated_at desc)` em snapshots de mapa.
- FKs com índice líder.
- `auth_sessions` por hash de token e expiração.
- `app_identities` por `(tenant_id, email)` e `(tenant_id, phone)` quando aplicável.
- Convites, onboarding, verificação de contato, recuperação e lifecycle de acesso por `(tenant_id, identity_id, status)`, token hash e expiração quando aplicável.
- Identidade federada por `(tenant_id, provider_adapter, status)`, vínculo externo por hash de subject e tentativas por resultado/data.
- `marketplace_actors` por `(tenant_id, actor_type, status)`.
- Catálogo por `(tenant_id, status)`, item por `(tenant_id, catalog_id, status)` e opções por `(tenant_id, catalog_item_id)`.
- Estados por `(tenant_id, entity, state_key)` e transições por `(tenant_id, entity, from_state_key, to_state_key)`.
- Agenda e capacidade por `(tenant_id, actor_id, starts_at)` ou `(tenant_id, actor_id, date)`.
- Mensagens, notificações, suporte, exceções, consentimentos e conflitos offline por tenant, entidade e status.
- Configurações e registros de e-mail por `(tenant_id, provider_adapter, status)`, entidade, tentativa, expiração e referência externa quando aplicável.

## Isolamento e regras de acesso

- Nenhuma leitura cross-tenant.
- Usuário comum lê apenas dados do tenant vinculado.
- Escrita depende de permissão efetiva no perfil.
- Admin de tenant não atravessa tenant.
- Admin de plataforma opera com trilha de auditoria.
- Dados de mapa e localização respeitam escopo de visibilidade por tenant, pedido, perfil e etapa.
- Regras de acesso devem funcionar na estrutura de dados do BFF e continuar portáveis para futura evolução aprovada.
- Mensagens, suporte, exceções, consentimentos, evidências, localização e auditoria devem aplicar visibilidade por tenant, perfil, papel operacional e vínculo com o pedido ou demanda.
- Convites, onboarding, recuperação e confirmação de contato só podem ser lidos ou alterados pelo próprio usuário, por ator autorizado do tenant ou por admin de plataforma com auditoria.
- Integrações opcionais de e-mail e identidade federada devem funcionar com modo desligado por tenant e não podem substituir sessão própria, permissões internas, controles internos de isolamento, pedido, evidência, mapa, rastreabilidade ou auditoria.
- Tabelas de configuração opcional guardam somente status, adapter e referência segura; segredos de Gmail, Google SSO ou provedor equivalente não podem aparecer em banco operacional, frontend, Git, bundle, log, screenshot, fixture pública ou documentação de usuário final.
- Registros de e-mail e tentativas de login federado devem respeitar visibilidade por tenant, perfil, entidade vinculada e resultado operacional, preservando degradação controlada quando o fornecedor externo estiver indisponível.

# Plano de Reestruturação Multi-Tenant — SeOrganize+

## Visão Geral

Transformar o SaaS de single-tenant para multi-tenant com isolamento via `tenantId`, feature gating por plano, RBAC com escopo, e integração Stripe completa.

---

## Fase 1 — Foundation: Schema do Tenant

**Objetivo:** Criar as bases do modelo multi-tenant no banco de dados.

### T-001: Criar tabela `workspaces`
- Campos: `id`, `name`, `slug`, `logoUrl`, `companyName`, `defaultRoleId`, `stripeCustomerId`, `planId`, `status` (`active`, `grace_period`, `cancelled`), `gracePeriodEndsAt`, `cancelledAt`, `createdAt`, `updatedAt`
- `slug` deve ser único
- Status default: `active`
- **Depende de:** Nada
- **Prioridade:** Alta

### T-002: Criar tabela `plans`
- Campos: `id`, `name`, `stripePriceId`, `allowedModules` (JSON), `isDefault`, `isActive`, `createdAt`, `updatedAt`
- Seed com plano inicial (single plan)
- **Depende de:** Nada
- **Prioridade:** Alta

### T-003: Criar tabela `plan_limits`
- Campos: `id`, `planId` (FK → plans), `resource`, `limit`, `behavior` (`hard`, `warning`), `createdAt`, `updatedAt`
- Seed com limites do plano inicial
- **Depende de:** T-002 (plans precisa existir)
- **Prioridade:** Alta

### T-004: Adicionar `tenantId` à tabela `profiles`
- Campo `tenantId` FK → `workspaces.id`
- Index em `tenantId`
- **Depende de:** T-001 (workspaces precisa existir)
- **Prioridade:** Alta

### T-005: Adicionar `tenantId` à tabela `roles`
- Campo `tenantId` FK → `workspaces.id`
- Index em `tenantId`
- **Depende de:** T-001
- **Prioridade:** Alta

### T-006: Adicionar `tenantId` às tabelas operacionais
- Tabelas: `team_areas`, `team_member_areas`, `projects`, `project_columns`, `tasks`, `task_assignees`, `comments`, `comment_mentions`, `documents`, `calendar_auth`, `calendar_events`, `calendar_event_attendees`, `activities`, `notifications`, `push_subscriptions`, `saved_views`, `clients`, `contracts`, `contract_items`, `contract_projects`, `installments`, `contract_changes`, `contract_audits`, `proposal_templates`, `proposals`, `proposal_items`
- Cada tabela recebe `tenantId` FK → `workspaces.id` + index
- **Depende de:** T-001
- **Prioridade:** Alta

### T-007: Criar tabela `project_members`
- Campos: `projectId` (FK), `profileId` (FK), `autoAssignedByArea` (boolean), `joinedAt`
- PK composta: `(projectId, profileId)`
- **Depende de:** T-001, T-004
- **Prioridade:** Média

### T-008: Migrar `workspace_settings` → `workspaces`
- Ler dados existentes de `workspace_settings`
- Criar workspace "default" para o tenant do dono
- Migrar `companyName`, `logoUrl`, `defaultRoleId`
- Remover tabela `workspace_settings` (ou descomissionar)
- **Depende de:** T-001, T-004, T-005, T-006
- **Prioridade:** Alta

---

### Definition of Done — Fase 1

- [ ] `prisma validate` passa sem erros
- [ ] `prisma migrate dev` executa sem erros em ambiente local
- [ ] Migration executada com sucesso em ambiente staging
- [ ] Tabela `workspaces` criada com todos os campos, índices e constraints (slug único)
- [ ] Tabela `plans` criada com todos os campos e seed com plano "Starter"
- [ ] Tabela `plan_limits` criada com todos os campos e FK para `plans`
- [ ] `profiles.tenantId` existe, é FK para `workspaces.id`, e tem index
- [ ] `roles.tenantId` existe, é FK para `workspaces.id`, e tem index
- [ ] Todas as 27 tabelas operacionais possuem `tenantId` como FK para `workspaces.id` com index
- [ ] Tabela `project_members` criada com PK composta e FKs corretos
- [ ] Dados de `workspace_settings` migrados para o workspace "default" sem perda
- [ ] Profiles existentes associados ao workspace "default"
- [ ] `prisma generate` passa sem erros
- [ ] Nenhum teste existente quebra após as alterações de schema
- [ ] Backup do banco executado antes da migration em staging
- [ ] Rollback testado: migration pode ser revertida sem perda de dados

---

## Fase 2 — Autenticação e Fluxo de Workspace

**Objetivo:** Refatorar o auth para criar workspace no signup e vincular usuário ao tenant.

### T-009: Refatorar `/auth/callback` — Criar workspace no signup
- No primeiro login, criar `workspace` + `profile` + `profile.workspaceId`
- Gerar `slug` único para o workspace
- Associar ao plano default
- **Depende de:** T-001, T-004, T-005, T-008
- **Prioridade:** Alta

### T-010: Criar `GET /api/workspace` — Dados do workspace
- Retorna dados do workspace do usuário logado
- Inclui: `name`, `slug`, `status`, `plan`, `features`, `limits`, `usage`
- **Depende de:** T-009
- **Prioridade:** Alta

### T-011: Criar `PATCH /api/workspace` — Editar workspace
- Campos editáveis: `name`, `slug`, `logoUrl`, `companyName`, `defaultRoleId`
- Validação: slug único, usuário deve ser admin do workspace
- **Depende de:** T-009
- **Prioridade:** Média

### T-012: Refatorar `AuthGate` — Verificar workspace status
- Se workspace `cancelled` e passou dos 30 dias → redirecionar para página de expiração
- Se workspace `grace_period` → mostrar banner de aviso
- Se workspace `active` → acesso normal
- **Depende de:** T-009, T-010
- **Prioridade:** Alta

### T-013: Criar fluxo de convite de colaboradores
- `POST /api/workspace/invites` — Criar invite sem envio de email; exige código de vinculação configurado
- `GET /api/workspace/invites` — Lista de invites pendentes
- `DELETE /api/workspace/invites/[id]` — Cancelar invite como admin
- `GET /api/onboarding/status` — Verificar se o usuário precisa informar um código
- `POST /api/onboarding/bind` — Vincular usuário autenticado ao workspace pelo código
- **Depende de:** T-009, T-004
- **Prioridade:** Alta

---

### Definition of Done — Fase 2

- [ ] Novo usuário (primeiro login) tem workspace criado automaticamente com slug único
- [ ] Novo usuário é associado ao plano default no signup
- [ ] `GET /api/workspace` retorna dados corretos: name, slug, status, plan, features, limits, usage
- [ ] `PATCH /api/workspace` permite editar name, slug, logoUrl, companyName, defaultRoleId
- [ ] `PATCH /api/workspace` rejeita slug duplicado com erro 409
- [ ] `PATCH /api/workspace` rejeita se usuário não é admin do workspace (403)
- [ ] AuthGate bloqueia acesso quando workspace está `cancelled` e passou de 30 dias
- [ ] AuthGate mostra banner de aviso quando workspace está em `grace_period`
- [ ] AuthGate permite acesso normal quando workspace está `active`
- [ ] Fluxo de convite: admin configura código → registra email → colaborador cria conta, informa o código e tem o profile vinculado ao workspace
- [ ] `GET /api/workspace/invites` retorna lista pendente corretamente
- [ ] Invite expira após tempo configurado (se houver política de expiração)
- [ ] Testes unitários cobrem: workspace creation, invite flow, auth gate status checks
- [ ] Testes de integração cobrem: signup → workspace creation → login → workspace retrieval
- [ ] Nenhum teste existente de autenticação quebra após refatoração
- [ ] `npm run lint` e `npm run typecheck` passam sem erros

---

## Fase 3 — Filtragem de Dados (RLS + Middleware)

**Objetivo:** Garantir que nenhum dado vaze entre tenants.

### T-014: Implementar Prisma Middleware — Tenant filtering
- Middleware que injeta `tenantId` em todas as queries `findMany`, `findFirst`, `update`, `delete`, `create`
- `tenantId` vem do usuário logado (session → profile → workspaceId)
- Skip para: `profiles` (já filtrado pelo profileId), `workspaces`, `plans`, `plan_limits`, super-admin queries
- **Depende de:** T-004, T-006
- **Prioridade:** Crítica

### T-015: Implementar RLS no Supabase — Políticas por tabela
- Para cada tabela com `tenantId`: `CREATE POLICY "tenant_isolation" ON [table] FOR SELECT/INSERT/UPDATE/DELETE USING (tenantId = current_setting('app.current_tenant_id')::uuid)`
- Políticas de super-admin: bypass de tenant filtering
- **Depende de:** T-004, T-006
- **Prioridade:** Crítica

### T-016: Refatorar API routes — Garantir tenant context
- Todas as routes devem extrair `tenantId` do profile do usuário
- Validar que o recurso pertence ao tenant (mesmo com middleware/RLS, double-check nas rotas)
- Atualizar `denyFor()` para incluir verificações de workspace status
- **Depende de:** T-014, T-015
- **Prioridade:** Crítica

---

### Definition of Done — Fase 3

- [ ] Prisma middleware injeta `tenantId` em todas as operações: `findMany`, `findFirst`, `findUnique`, `create`, `update`, `delete`, `upsert`
- [ ] Prisma middleware SKIPA tabelas: `profiles`, `workspaces`, `plans`, `plan_limits`
- [ ] Prisma middleware SKIPA queries de super-admin (flag `superAdmin: true` no profile)
- [ ] RLS políticas criadas em todas as tabelas com `tenantId` (SELECT, INSERT, UPDATE, DELETE)
- [ ] RLS políticas de super-admin permitem bypass de tenant filtering
- [ ] Teste negativo: usuário do tenant A NÃO consegue ler dados do tenant B (middleware)
- [ ] Teste negativo: usuário do tenant A NÃO consegue escrever dados do tenant B (middleware)
- [ ] Teste negativo: query direta ao banco (sem middleware) é bloqueada pelo RLS
- [ ] Todas as API routes existentes passam no tenant context extraction
- [ ] `denyFor()` inclui verificação de workspace status (cancelled, grace_period)
- [ ] Nenhum `prisma.*` call escapa sem tenant filtering (auditado via grep no código)
- [ ] Testes unitários cobrem: middleware injection, RLS policies, super-admin bypass
- [ ] Testes de integração cobrem: cross-tenant isolation (2 tenants, dados separados)
- [ ] `npm run test` passa com 100% dos testes existentes + novos testes de tenant isolation
- [ ] `npm run lint` e `npm run typecheck` passam sem erros

---

## Fase 4 — Integração Stripe

**Objetivo:** Implementar checkout, webhooks e ciclo de assinatura.

### T-017: Configurar Stripe no projeto
- Instalar `stripe` SDK
- Configurar env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Criar cliente Stripe singleton em `lib/stripe.ts`
- **Depende de:** Nada
- **Prioridade:** Alta

### T-018: Criar `POST /api/stripe/checkout` — Iniciar checkout
- Criar Stripe Customer (se não existir)
- Criar Checkout Session com o `stripePriceId` do plano
- Redirect URL: de volta para `/app`
- **Depende de:** T-017, T-002
- **Prioridade:** Alta

### T-019: Criar `POST /api/stripe/portal` — Portal do cliente
- Criar Billing Portal Session do Stripe
- Permite ao usuário gerenciar cartão e assinatura
- **Depende de:** T-017
- **Prioridade:** Média

### T-020: Criar `POST /api/stripe/webhook` — Webhook handler
- Verificar signature do Stripe
- `invoice.payment_succeeded` → workspace status = `active`, limpar grace period
- `invoice.payment_failed` → workspace status = `grace_period`, setar `gracePeriodEndsAt` = agora + 3 dias
- `customer.subscription.deleted` → workspace status = `cancelled`, setar `cancelledAt`
- `customer.subscription.updated` → atualizar `planId`, `stripeCustomerId` no workspace
- **Depende de:** T-017, T-001
- **Prioridade:** Crítica

### T-021: Implementar grace period — Banner e lógica
- Componente `GracePeriodBanner` — Mostra data de fim do grace period
- Verificar em `GET /api/workspace` se workspace está em grace period
- Após 3 dias → marcar como `cancelled` (pode ser job ou verificação no auth gate)
- **Depende de:** T-020, T-012
- **Prioridade:** Alta

### T-022: Implementar proration — Upgrade/downgrade de plano
- `POST /api/stripe/upgrade` — Mudar subscription, Stripe calcula proration
- Atualizar `planId` no workspace
- **Depende de:** T-018, T-020
- **Prioridade:** Média

---

### Definition of Done — Fase 4

- [ ] `stripe` SDK instalado e configurado com env vars corretas
- [ ] Cliente Stripe singleton em `lib/stripe.ts` funciona em ambiente server-side
- [ ] `POST /api/stripe/checkout` cria Stripe Customer + Checkout Session e retorna URL
- [ ] Checkout redireciona corretamente para `/app` após pagamento
- [ ] `POST /api/stripe/portal` cria Billing Portal Session do Stripe
- [ ] `POST /api/stripe/webhook` verifica signature e rejeita webhooks inválidos (403)
- [ ] Webhook `invoice.payment_succeeded` → workspace status = `active`, grace period limpo
- [ ] Webhook `invoice.payment_failed` → workspace status = `grace_period`, `gracePeriodEndsAt` = +3 dias
- [ ] Webhook `customer.subscription.deleted` → workspace status = `cancelled`, `cancelledAt` setado
- [ ] Webhook `customer.subscription.updated` → `planId` e `stripeCustomerId` atualizados
- [ ] `GracePeriodBanner` exibe data de fim do grace period corretamente
- [ ] Após 3 dias de grace period, workspace é marcado como `cancelled`
- [ ] `POST /api/stripe/upgrade` muda subscription com proration do Stripe
- [ ] Testes unitários cobrem: webhook handlers (cada evento), signature verification, grace period logic
- [ ] Testes de integração cobrem: Stripe CLI simulates webhook → workspace status muda
- [ ] Nenhum segredo (stripe keys) exposto no client-side ou logs
- [ ] Webhooks configurados em ambiente de teste (Stripe CLI local)
- [ ] `npm run test` passa com todos os novos testes de Stripe
- [ ] `npm run lint` e `npm run typecheck` passam sem erros

---

## Fase 5 — Feature Gating System

**Objetivo:** Controlar acesso a módulos e recursos por plano.

### T-023: Criar service `features.ts` — Feature checking
- `getWorkspaceFeatures(workspaceId)` → Retorna `allowedModules` do plano
- `checkFeature(workspaceId, module)` → Boolean
- `getWorkspaceLimits(workspaceId)` → Retorna `plan_limits` do plano
- `checkLimit(workspaceId, resource)` → Retorna `{ remaining, limit, behavior }`
- **Depende de:** T-002, T-003, T-010
- **Prioridade:** Alta

### T-024: Implementar middleware de feature gating
- Intercepta requests para rotas de módulos bloqueados
- Se workspace não tem o módulo → 403 Forbidden
- Se workspace atingiu limite `hard` → 403 + mensagem de upgrade
- Se workspace atingiu limite `warning` → Permite + retorna header de aviso
- **Depende de:** T-023
- **Prioridade:** Alta

### T-025: Implementar contadores de usage
- `GET /api/workspace/usage` — Retorna contagem atual por recurso:
  - `users`: count de profiles com tenantId
  - `tasks`: count de tasks
  - `projects`: count de projects
  - `contracts`: count de contracts
  - etc.
- **Depende de:** T-006, T-023
- **Prioridade:** Média

### T-026: UI — Banner de limite atingido / upgrade
- Componente `UpgradeBanner` — Exibe quando limite `warning` é atingido
- Botão "Fazer Upgrade" → Redireciona para Stripe Checkout
- **Depende de:** T-024, T-025, T-018
- **Prioridade:** Média

### T-027: UI — Gatear módulos bloqueados
- Remover itens do menu/sidebar se módulo não está disponível no plano
- Rotas de módulos bloqueados → Página "Upgrade necessário"
- **Depende de:** T-024
- **Prioridade:** Média

---

### Definition of Done — Fase 5

- [ ] `getWorkspaceFeatures(workspaceId)` retorna `allowedModules` corretamente do plano
- [ ] `checkFeature(workspaceId, module)` retorna `true`/`false` baseado no plano
- [ ] `getWorkspaceLimits(workspaceId)` retorna `plan_limits` do plano
- [ ] `checkLimit(workspaceId, resource)` retorna `{ remaining, limit, behavior }` corretamente
- [ ] Middleware bloqueia acesso a módulo não permitido no plano (403 Forbidden)
- [ ] Middleware bloqueia criação quando limite `hard` é atingido (403 + mensagem)
- [ ] Middleware permite criação quando limite é `warning` + retorna header de aviso
- [ ] `GET /api/workspace/usage` retorna contagem correta de todos os recursos
- [ ] `UpgradeBanner` aparece quando limite `warning` é atingido
- [ ] Botão "Fazer Upgrade" redireciona para Stripe Checkout
- [ ] Sidebar remove itens de módulos bloqueados pelo plano
- [ ] Rota de módulo bloqueado redireciona para página "Upgrade necessário"
- [ ] Testes unitários cobrem: feature checking (enabled/disabled), limit checking (hard/warning), middleware gating
- [ ] Testes de integração cobrem: criar plano sem módulo → acessar módulo → 403
- [ ] Testes de integração cobrem: atingir limite hard → tentar criar → 403
- [ ] Testes de integração cobrem: atingir limite warning → criar → sucesso + aviso
- [ ] `npm run test` passa com todos os testes de feature gating
- [ ] `npm run lint` e `npm run typecheck` passam sem erros

---

## Fase 6 — RBAC com Escopo

**Objetivo:** Implementar permissões com escopo (`all`, `area`, `project`).

### T-028: Refatorar tabela `roles` — Suporte a permissões com escopo
- `permissions` muda de `string[]` para `{ resource: string, action: string, scope: 'all' | 'area' | 'project' }[]`
- Migration: converter permissões existentes para novo formato (default: `scope: 'all'`)
- **Depende de:** T-005, T-008
- **Prioridade:** Alta

### T-029: Refatorar service `authz.ts` — Verificar permissões com escopo
- `hasPermission(userId, { resource, action, scope })` → Boolean
- `getEffectivePermissions(userId)` → Retorna lista de permissões com escopo
- `canViewResource(userId, entityType, entityId)` → Verifica escopo (all/area/project)
- **Depende de:** T-028
- **Prioridade:** Alta

### T-030: Implementar escopo `area` — Filtrar por team_areas
- Quando scope é `area`, filtrar recursos pelo `areaId` dos team_areas do usuário
- `tasks`: filtrar por `project.areaId` ∈ userAreas
- `documents`: filtrar por `project.areaId` ∈ userAreas
- `projects`: filtrar por `areaId` ∈ userAreas
- **Depende de:** T-029
- **Prioridade:** Alta

### T-031: Implementar escopo `project` — Filtrar por project_members
- Quando scope é `project`, filtrar por `project_members`
- `tasks`: filtrar por `projectId` ∈ userProjects
- `documents`: filtrar por `projectId` ∈ userProjects
- **Depende de:** T-029, T-007
- **Prioridade:** Média

### T-032: Implementar `autoAssignedByArea` — Toggle
- `PATCH /api/projects/[id]/auto-assign` — Ativar/desativar
- Quando ativado: adicionar membros automaticamente baseados em `team_member_areas`
- Quando desativado: remover membros auto-atribuídos
- **Depende de:** T-031
- **Prioridade:** Baixa

### T-033: Refatorar API routes — Aplicar escopo nas queries
- Todas as listagens (`GET /api/tasks`, `GET /api/projects`, etc.) devem aplicar filtro de escopo
- Queries individuais (`GET /api/tasks/[id]`) devem verificar se o usuário tem acesso ao recurso
- **Depende de:** T-029, T-030, T-031
- **Prioridade:** Alta

---

### Definition of Done — Fase 6

- [ ] `roles.permissions` migra de `string[]` para `{ resource, action, scope }[]` sem perda de dados
- [ ] Permissões existentes convertem para `scope: 'all'` por default
- [ ] `hasPermission(userId, { resource, action, scope })` retorna boolean corretamente
- [ ] `getEffectivePermissions(userId)` retorna lista completa com escopos
- [ ] `canViewResource(userId, entityType, entityId)` verifica escopo corretamente
- [ ] Escopo `all`: usuário vê todos os recursos do tenant
- [ ] Escopo `area`: usuário vê só recursos das áreas em que é membro
- [ ] Escopo `project`: usuário vê só recursos dos projetos em que é membro
- [ ] `autoAssignedByArea` toggle adiciona/remove membros automaticamente
- [ ] Todas as listagens (`GET /api/tasks`, `GET /api/projects`, etc.) aplicam filtro de escopo
- [ ] Queries individuais (`GET /api/tasks/[id]`) verificam acesso antes de retornar
- [ ] Testes unitários cobrem: hasPermission (cada escopo), canViewResource (cada escopo), area filtering, project filtering
- [ ] Testes de integração cobrem: usuário com scope `area` → tenta acessar recurso de outra área → 403/404
- [ ] Testes de integração cobrem: usuário com scope `project` → tenta acessar projeto não membro → 403/404
- [ ] Nenhum teste existente de autorização quebra após refatoração
- [ ] `npm run test` passa com todos os testes de RBAC
- [ ] `npm run lint` e `npm run typecheck` passam sem erros

---

## Fase 7 — Admin Panel

**Objetivo:** Painel de administração global para gerenciar tenants, planos e suporte.

### T-034: Criar estrutura do admin panel
- Rotas sob `/admin/*` — Separadas das rotas do tenant
- `AuthGate` especial: só permite acesso se usuário for super-admin
- Sidebar com: Tenants, Plans, Billing, Support
- **Depende de:** T-009 (super-admin flag no profile)
- **Prioridade:** Média

### T-035: Admin — Listar e gerenciar tenants
- `GET /admin/tenants` — Lista todos os workspaces
- `GET /admin/tenants/[id]` — Detalhes do tenant: status, plano, usage, usuários
- `PATCH /admin/tenants/[id]` — Alterar status, plano, extender grace period
- `DELETE /admin/tenants/[id]` — Soft delete tenant
- **Depende de:** T-034
- **Prioridade:** Média

### T-036: Admin — Gerenciar planos
- `GET /admin/plans` — Lista todos os planos
- `POST /admin/plans` — Criar plano
- `PATCH /admin/plans/[id]` — Editar plano: name, stripePriceId, allowedModules
- `DELETE /admin/plans/[id]` — Desativar plano
- **Depende de:** T-034, T-002
- **Prioridade:** Média

### T-037: Admin — Gerenciar limites de planos
- `GET /admin/plans/[id]/limits` — Lista limites do plano
- `POST /admin/plans/[id]/limits` — Criar limite
- `PATCH /admin/plans/[id]/limits/[id]` — Editar: resource, limit, behavior
- `DELETE /admin/plans/[id]/limits/[id]` — Remover limite
- **Depende de:** T-036, T-003
- **Prioridade:** Média

### T-038: Admin — Acesso read-only a tenant cancelado
- `POST /admin/tenants/[id]/grant-read-only` — Concede acesso temporário
- Cria uma conta especial com permissão read-only no tenant
- Expira em X dias
- **Depende de:** T-035
- **Prioridade:** Baixa

---

### Definition of Done — Fase 7

- [ ] Rotas `/admin/*` são separadas das rotas do tenant (layout diferente)
- [ ] AuthGate de admin bloqueia acesso se usuário não é super-admin (403)
- [ ] Sidebar do admin exibe: Tenants, Plans, Billing, Support
- [ ] `GET /admin/tenants` lista todos os workspaces com status, plano, usage
- [ ] `GET /admin/tenants/[id]` retorna detalhes completos (status, plano, usage, usuários)
- [ ] `PATCH /admin/tenants/[id]` altera status, plano, extende grace period
- [ ] `DELETE /admin/tenants/[id]` faz soft delete (não exclui dados permanentemente)
- [ ] `GET /admin/plans` lista todos os planos
- [ ] `POST /admin/plans` cria novo plano com modules e stripePriceId
- [ ] `PATCH /admin/plans/[id]` edita plano sem afetar tenants existentes
- [ ] `DELETE /admin/plans/[id]` desativa plano (soft delete)
- [ ] `GET /admin/plans/[id]/limits` lista limites do plano
- [ ] `POST /admin/plans/[id]/limits` cria limite com resource, limit, behavior
- [ ] `PATCH /admin/plans/[id]/limits/[id]` edita limite
- [ ] `DELETE /admin/plans/[id]/limits/[id]` remove limite
- [ ] `POST /admin/tenants/[id]/grant-read-only` cria acesso temporário com expiração
- [ ] Admin pode acessar dados de qualquer tenant (bypass de tenant filtering)
- [ ] Testes unitários cobrem: admin auth gate, tenant CRUD, plan CRUD, limits CRUD
- [ ] Testes de integração cobrem: usuário não-admin tenta acessar `/admin` → 403
- [ ] Testes de integração cobrem: super-admin altera status de tenant → reflete em tempo real
- [ ] `npm run test` passa com todos os testes do admin panel
- [ ] `npm run lint` e `npm run typecheck` passam sem erros

---

## Fase 8 — Gestão de Roles por Tenant

**Objetivo:** UI para criar, editar e atribuir roles dentro do tenant.

### T-039: Refatorar `GET/POST /api/roles` — Multi-tenant
- Listagem retorna só roles do tenant do usuário
- Criação salva com `tenantId` do usuário
- Roles padrão criadas no workspace creation: Admin (all perms), Member (scoped perms)
- **Depende de:** T-028
- **Prioridade:** Alta

### T-040: UI — Criar/editar roles com escopo
- Form para criar/editar role
- Seletor de permissões com dropdown de escopo (`all`, `area`, `project`)
- Preview de recursos visíveis com essa role
- **Depende de:** T-039
- **Prioridade:** Média

### T-041: Refatorar atribuição de roles — Atribuir role ao usuário
- `PATCH /api/profiles/[id]/role` — Atribuir role ao membro do tenant
- Validar que o usuário que está alterando é admin do tenant
- **Depende de:** T-039
- **Prioridade:** Alta

---

### Definition of Done — Fase 8

- [ ] `GET /api/roles` retorna apenas roles do tenant do usuário logado
- [ ] `POST /api/roles` cria role com `tenantId` correto
- [ ] Roles padrão criadas no workspace creation: Admin (all perms), Member (scoped perms)
- [ ] UI de criação/edição de roles funciona com seletor de escopo (all/area/project)
- [ ] Preview mostra recursos visíveis com a role configurada
- [ ] `PATCH /api/profiles/[id]/role` atribui role ao membro do tenant
- [ ] `PATCH /api/profiles/[id]/role` rejeita se usuário não é admin do tenant (403)
- [ ] Testes unitários cobrem: role creation, role editing, role assignment, admin-only validation
- [ ] Testes de integração cobrem: criar role → atribuir a usuário → verificar permissões efetivas
- [ ] Testes de integração cobrem: usuário não-admin tenta criar role → 403
- [ ] `npm run test` passa com todos os testes de gestão de roles
- [ ] `npm run lint` e `npm run typecheck` passam sem erros

---

## Fase 9 — Migration e Deploy

**Objetivo:** Executar migrações e deploy em produção.

### T-042: Prisma migration — Executar schema changes
- `prisma migrate dev` — Gerar migration
- Testar migration em ambiente staging
- Validar que dados existentes foram migrados corretamente
- **Depende de:** T-001 a T-008 (todas as alterações de schema)
- **Prioridade:** Crítica

### T-043: Seed — Criar plano default e dados iniciais
- `prisma db seed` — Criar plano "Starter" com módulos e limites
- Criar workspace para dados existentes
- Associar profiles existentes ao workspace
- **Depende de:** T-042
- **Prioridade:** Alta

### T-044: Configurar Stripe webhooks em produção
- Criar webhook endpoint no Stripe Dashboard
- Apontar para `https://seorganize.com/api/stripe/webhook`
- Selecionar eventos: `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
- **Depende de:** T-020
- **Prioridade:** Alta

### T-045: Deploy — Rollout gradual
- Deploy em staging → Testar todos os fluxos
- Deploy em produção → Monitorar logs e erros
- Rollback plan: reverter migration + deploy anterior
- **Depende de:** T-042, T-043, T-044
- **Prioridade:** Crítica

---

### Definition of Done — Fase 9

- [ ] `prisma migrate dev` gera migration sem erros
- [ ] Migration executada com sucesso em ambiente staging
- [ ] Dados existentes migrados sem perda (verificação manual + testes)
- [ ] `prisma db seed` cria plano "Starter" com módulos e limites
- [ ] Workspace "default" criado para dados existentes
- [ ] Profiles existentes associados ao workspace "default"
- [ ] Stripe webhooks configurados em produção com os 4 eventos
- [ ] Webhook signature verification funciona em produção
- [ ] Deploy em staging passa todos os smoke tests
- [ ] Deploy em produção executado sem erros
- [ ] Monitoramento ativo: logs, erros, métricas de performance
- [ ] Rollback plan testado: migration pode ser revertida + deploy anterior restaurado
- [ ] Backup completo do banco executado antes da migration em produção
- [ ] Verificação pós-deploy: auth, tenant isolation, Stripe checkout, webhooks funcionais
- [ ] Health check `/api/db-check` passa em produção
- [ ] `npm run lint` e `npm run typecheck` passam sem erros no código final

---

## Fase 10 — Testes

**Objetivo:** Garantir que o sistema multi-tenant funciona corretamente.

### T-046: Testes unitários — Tenant isolation
- Testar que Prisma middleware injeta `tenantId` corretamente
- Testar que queries não vazam dados entre tenants
- **Depende de:** T-014
- **Prioridade:** Alta

### T-047: Testes unitários — Feature gating
- Testar `checkFeature()` com diferentes planos
- Testar `checkLimit()` com hard e warning behaviors
- Testar middleware de feature gating
- **Depende de:** T-023, T-024
- **Prioridade:** Alta

### T-048: Testes unitários — RBAC com escopo
- Testar `hasPermission()` com diferentes escopos
- Testar filtragem por area e project
- **Depende de:** T-029, T-030, T-031
- **Prioridade:** Alta

### T-049: Testes de integração — Stripe webhooks
- Simular webhook events (usar Stripe CLI)
- Verificar que workspace status muda corretamente
- Testar grace period → cancelled flow
- **Depende de:** T-020, T-021
- **Prioridade:** Alta

### T-050: Testes E2E — Fluxo completo
- Criar tenant → Checkout Stripe → Acessar plataforma
- Convidar colaborador → Aceitar invite → Acessar com permissões limitadas
- Atingir limite → Verificar aviso/bloqueio
- Cancelar assinatura → Verificar grace period → cancelamento
- **Depende de:** T-045 (deploy em staging)
- **Prioridade:** Alta

---

## Ordem de Execução (Prioridade)

```
Fase 1 (T-001 a T-008)    → Foundation do banco
       ↓
Fase 2 (T-009 a T-013)    → Auth + Workspace
       ↓
Fase 3 (T-014 a T-016)    → Filtragem (CRÍTICO)
       ↓
Fase 4 (T-017 a T-022)    → Stripe
       ↓
Fase 5 (T-023 a T-027)    → Feature Gating
       ↓
Fase 6 (T-028 a T-033)    → RBAC com Escopo
       ↓
Fase 7 (T-034 a T-038)    → Admin Panel
       ↓
Fase 8 (T-039 a T-041)    → Gestão de Roles
       ↓
Fase 9 (T-042 a T-045)    → Migration + Deploy
       ↓
Fase 10 (T-046 a T-050)   → Testes
```

## Observações

### Definition of Done — Fase 10

- [ ] Testes unitários de tenant isolation passam (middleware injection, cross-tenant isolation)
- [ ] Testes unitários de feature gating passam (enabled/disabled, hard/warning limits)
- [ ] Testes unitários de RBAC com escopo passam (all/area/project, canViewResource)
- [ ] Testes de integração Stripe passam (4 webhook events, grace period flow)
- [ ] Testes E2E passam: signup → checkout → login → workspace access
- [ ] Testes E2E passam: convite → accept → login com permissões limitadas
- [ ] Testes E2E passam: atingir limite → aviso/bloqueio correto
- [ ] Testes E2E passam: cancelamento → grace period → expiração
- [ ] Cobertura de testes ≥ 80% nas novas funcionalidades multi-tenant
- [ ] Nenhum teste existente quebra após toda a reestruturação
- [ ] `npm run test` passa 100% em ambiente CI
- [ ] `npm run lint` e `npm run typecheck` passam sem erros
- [ ] Documentação atualizada: README, env vars, fluxo de deploy

---

## Ordem de Execução (Prioridade)

```
Fase 1 (T-001 a T-008)    → Foundation do banco
       ↓
Fase 2 (T-009 a T-013)    → Auth + Workspace
       ↓
Fase 3 (T-014 a T-016)    → Filtragem (CRÍTICO)
       ↓
Fase 4 (T-017 a T-022)    → Stripe
       ↓
Fase 5 (T-023 a T-027)    → Feature Gating
       ↓
Fase 6 (T-028 a T-033)    → RBAC com Escopo
       ↓
Fase 7 (T-034 a T-038)    → Admin Panel
       ↓
Fase 8 (T-039 a T-041)    → Gestão de Roles
       ↓
Fase 9 (T-042 a T-045)    → Migration + Deploy
       ↓
Fase 10 (T-046 a T-050)   → Testes
```

## Observações

- **T-014 e T-015 são críticos**: Sem filtragem de tenant, o sistema é inseguro. Priorizar antes de qualquer deploy.
- **Fase 4 pode correr em paralelo com Fase 5**: Stripe e feature gating não dependem um do outro diretamente.
- **Fase 6 pode correr em paralelo com Fase 7**: RBAC e Admin Panel são independentes.
- **T-032 e T-038 são low priority**: Podem ser implementados após o MVP multi-tenant estar funcional.
- **Backup antes de T-045**: Fazer backup completo do banco antes de executar migrations em produção.
- **Cada fase só avança quando o DoD é 100% checkado**: Não pular verificações para ganhar velocidade.

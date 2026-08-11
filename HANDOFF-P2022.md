# Handoff — Bug: P2022 `roles.isAdmin does not exist` / app "não funciona" (SeOrganize+)

> **Repositório:** `GuilhermeFaglioni/SeOrganizeB2B` (branch `main`)
> **Stack:** Next.js 14 App Router, Prisma 5.22 + Supabase Postgres, Vercel (deploy via GitHub Actions), next-intl (i18n), React Query.
> **Objetivo para quem assume:** resolver por que o app em produção continua dando P2022 `roles.isAdmin does not exist` nas queries TIPADAS do Prisma, mesmo com a coluna presente e o `$queryRaw` vendo a coluna. O usuário vai abrir este documento com você.

---

## 1. Erros exatos (mensagens reais)

### 1.1 P2022 — nas queries tipadas do Prisma (é o bloqueio atual)
```
PrismaClientKnownRequestError:
Invalid `prisma.profile.findUnique()` invocation:  (também ocorre com findFirst)

The column `roles.isAdmin` does not exist in the current database.
  code: 'P2022'
  meta: { modelName: 'Profile', column: 'roles.isAdmin' }
```
- Ocorre em `/api/me/permissions` e em **todas** as rotas que chamam `denyFor()` (via `getEffectivePermissions`).
- A chamada é `prisma.profile.findFirst({ where: { id }, select: { role: { select: { id, name, isAdmin, permissions } } } })` em `src/lib/authz/authz.ts`.

### 1.2 EMAXCONNSESSION (apareceu antes, session pooler)
```
FATAL: (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15
```
- Causado por `DATABASE_URL` apontando para o **session pooler (porta 5432)** do Supabase com muitas lambdas do Vercel concorrentes. (Mitigação: `prisma/client.ts` já anexa `connection_limit=1&pgbouncer=true`.)

### 1.3 ENVIRONMENT_FALLBACK (next-intl — JÁ RESOLVIDO)
```
[Error]: ENVIRONMENT_FALLBACK   at t.useTranslations (...)   code: 'ENVIRONMENT_FALLBACK'
```
- Páginas pré-renderizadas estaticamente rodavam `useTranslations` em server context sem config do next-intl.
- **FIX (merged, PR #40):** `export const dynamic = "force-dynamic"` no root layout (`src/app/layout.tsx`). Build agora passa 62/62.

### 1.4 Vercel "Prebuilt deployments cannot be redeployed"
- Esperado: deploy via CI (`vercel deploy --prebuilt`). Para aplicar novas envs é preciso **novo deployment** (push na main ou `gh workflow run deploy-production.yml`).

---

## 2. Evidências que o usuário já confirmou (NÃO é o que você acha)

- **NÃO é env do Vercel** — ele configurou `DATABASE_URL`/`DIRECT_URL` de várias formas (5432/6543, invertidas, etc.). O erro persistia.
- **NÃO é ref/projeto diferente** — o `postgres.<ref>` é o MESMO nas duas strings: **`pxlcpeccmjnksutsqcgp`**, host `aws-0-us-east-2.pooler.supabase.com`. (O host do pooler é compartilhado entre projetos da região, mas o ref é o mesmo.)
- **NÃO é coluna faltando no banco** — no Supabase SQL editor (mesmo projeto), a query retornou:
  ```
  roles_table_exists: true, has_is_admin: true, profiles_has_role_id: true,
  ws_has_default_role: true, admin_role_exists: true, total_profiles: 2, profiles_with_role: 2
  ```
- **Perfil do usuário está Admin:** `profiles.role_id = '00000000-0000-0000-0000-000000000001'` (e-mail `guilhermefaglioni.contato@gmail.com`).
- **NÃO aceita verificação hard-coded de admin por id** — quer leitura dinâmica de `roles.is_admin` (ou equivalente) no código. (Revertemos a tentativa de usar o id fixo.)

---

## 3. O paradoxo principal (o que precisa ser explicado)

No **mesmo deployment** (`seorganize-plus.vercel.app`), com a **mesma conexão** do app:

| Caminho | Query | Resultado |
|---|---|---|
| `$queryRaw` (via `DIRECT_URL`, porta 6543) | `SELECT EXISTS(... information_schema ... 'is_admin')` | `has_is_admin: true` ✅ |
| query tipada `findFirst` com join em `roles.is_admin` (via `DATABASE_URL`, porta 5432) | Prisma gera JOIN em `"roles"."is_admin"` | **P2022** ❌ |
| query tipada `findUnique` idem | idem | **P2022** ❌ |

Resultado do `/api/db-check` (endpoint de diagnóstico):
```json
{
  "DATABASE_URL_host": "aws-0-us-east-2.pooler.supabase.com:5432",
  "DIRECT_URL_host": "aws-0-us-east-2.pooler.supabase.com:6543",
  "rawPath": { "has_is_admin": true },
  "typedPath": { "ok": true | false, "error": "P2022 ..." }   // INCONSISTENTE entre execuções
}
```
- O `typedPath` já retornou `ok: true` e depois `ok: false` (P2022) em execuções diferentes — sugere instâncias/conexões diferentes no mesmo deployment, ou estado inconsistente.

**Hipóteses a investigar (na ordem):**
1. **Roteamento de conexão do Prisma:** em Prisma 5, queries tipadas (`findUnique`/`findFirst`) usam `url` (`DATABASE_URL`); `$queryRaw`/`$executeRawUnsafe` e transações interativas usam `directUrl` (`DIRECT_URL`). Confirmar isso na versão 5.22. Se for isso, o `DATABASE_URL` conecta num banco SEM a coluna e o `DIRECT_URL` num banco COM — e o teste decisivo é apontar `DATABASE_URL` = `DIRECT_URL` exatamente.
2. **Read Replica do Supabase:** verificar se o projeto tem Read Replicas ativadas (uma porta/pooler pode rotear para réplica atrasada, sem o DDL).
3. **Prepared statement cacheado sob `pgbouncer=true`:** trocar `findUnique`→`findFirst` foi testado (PR #41) e NÃO resolveu. Testar `pgbouncer=true` on/off, `connection_limit`, e `prisma.$queryRaw` com `SELECT is_admin FROM "roles" LIMIT 1`.
4. **Shadowing de schema/search_path:** rodar `SHOW search_path;` e `SELECT schemaname, tablename FROM pg_tables WHERE tablename IN ('roles','profiles');` — se existir mais de uma tabela `roles` em schemas diferentes, o Prisma pode resolver para uma sem a coluna.

---

## 4. Queries/setup decisivos que o Codex deve rodar

**Via Supabase SQL editor (projeto `pxlcpeccmjnksutsqcgp`):**
```sql
SHOW search_path;
SELECT schemaname, tablename FROM pg_tables WHERE tablename IN ('roles','profiles','workspace_settings');
SELECT table_schema, column_name FROM information_schema.columns WHERE table_name = 'roles';
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
```

**Para provar/descartar o roteamento url vs directUrl:** adicionar um endpoint de teste que faça a MESMA query (`SELECT EXISTS(... is_admin ...)`) via `prisma.$queryRaw` E via uma query tipada que leia `is_admin` (ex.: `prisma.role.findFirst({ select: { isAdmin: true } })`) e retorne os dois + os hosts. Comparar no mesmo request.

---

## 5. O que já foi alterado no código (referências)

- **RBAC (merged):** catálogo de permissões, `denyFor()` em todas as rotas de API, UI de roles/permissões, i18n, migration `prisma/migrations/20260803130000_add_roles/migration.sql`, `Profile.roleId`, `WorkspaceSettings.defaultRoleId`.
- **`force-dynamic` root layout** (`src/app/layout.tsx`) — PR #40 (merged), resolve ENVIRONMENT_FALLBACK.
- **`findUnique` → `findFirst`** em `getEffectivePermissions` (`src/lib/authz/authz.ts`) — PR #41 (merged), NÃO resolveu o P2022.
- **`/api/me/permissions` com try/catch** expondo a mensagem real — merged (PR #38).
- **`/api/db-check`** diagnóstico (hosts + rawPath + typedPath) — merged (PR #39). **REMOVER depois de resolver.**
- **CI/CD:** `deploy-production.yml` roda `scripts/reconcile-prod.ts` (idempotente) + `prisma migrate deploy` ANTES do build, com `SUPABASE_SESSION_URL` em DATABASE_URL e DIRECT_URL (session pooler — evitou travamento do Supabase direto). `ci.yml` roda migrations contra Postgres 16 service.
- **Arquivo `prod-check.sql`** (untracked) e branches `fix/force-dynamic-root`, `fix/db-check-hosts` (merged), `fix/perms-visible-error` (merged).

Arquivos-chave:
- `src/lib/authz/authz.ts` — `getEffectivePermissions` (query que falha)
- `src/lib/authz/permissions.ts`, `src/lib/authz/roles-service.ts`
- `src/app/api/me/permissions/route.ts`
- `src/app/api/db-check/route.ts`
- `prisma/schema.prisma` (model `Role.isAdmin` → coluna `is_admin`)
- `scripts/reconcile-prod.ts`
- `.github/workflows/deploy-production.yml` / `ci.yml`
- `src/app/layout.tsx`

---

## 6. Estado do deploy / pipeline (importante)

- Deploy de produção = GitHub Actions `deploy-production.yml` (push na main ou `workflow_dispatch`). Vercel auto-deploy da main está **desabilitado** (`vercel.json` `deploymentEnabled.main: false`).
- Deployment "prebuilt" **não pode** ser "Redeployed" pelo dashboard do Vercel — precisa de **novo deployment**.
- Para disparar: merge de PR na main, ou `gh workflow run deploy-production.yml --ref main`.
- Envs Vercel: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (mais Supabase server envs).
- Secrets GitHub: `SUPABASE_SESSION_URL`, `SUPABASE_DIRECT_URL`, `VERCEL_TOKEN/ORG/PROJECT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PAT_TOKEN`, `TELEGRAM_*`.

---

## 7. Próximos passos sugeridos (para o Codex)

1. Reproduzir o paradoxo num único request: mesma conexão, comparar `$queryRaw` vs `findFirst({ select: { isAdmin } })` vs `findUnique` — identificar se Prisma roteia typed ≠ raw (url vs directUrl) e em qual delas a coluna falta.
2. Verificar Read Replicas do Supabase e/ou duas tabelas `roles` (search_path).
3. Alinhar `DATABASE_URL` = `DIRECT_URL` (mesma string exata) e testar — se resolver, decidir config final (transaction pooler 6543 com a coluna garantida nos dois).
4. Depois de resolver o P2022: confirmar `/api/me/permissions` → `isAdmin: true`, menu lateral completo, ações autorizadas; garantir que EMAXCONNSESSION não volte (se `DATABASE_URL` ficar no session pooler 5432, avaliar migrar para 6543).
5. **Remover** o `/api/db-check` e o `prod-check.sql` após diagnóstico.
6. Considerar corrigir a raiz do ENVIRONMENT_FALLBACK de forma definitiva (config do next-intl) em vez de depender só do `force-dynamic`.

---

## Suggested skills

- `diagnosing-bugs` — para o paradoxo de conexão/instâncias.
- `tdd` — para adicionar testes que reproduzam o P2022 se precisar de base reproduzível.
- `request-refactor-plan` — se a conclusão levar a um refactor (ex.: roteamento de conexão/leitura de permissões).

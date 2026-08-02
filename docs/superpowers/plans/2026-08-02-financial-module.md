# Financial Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Financial workspace — Overview, Contracts,
Receivables and Clients — with decimal-safe money, civil dates, server-side
lists and CSV exports, on the existing Next.js/Prisma stack.

**Architecture:** A dedicated `src/lib/financial` domain layer owns money and
civil-date arithmetic, installment schedules, metrics, lifecycle transitions
and upsell/downsell rules as pure functions; transactional service modules wrap
every multi-record operation (activation, cancellation, renewal, adjustment,
recurring extension) in `prisma.$transaction`. API routes are thin
authenticated adapters over the services. React Query hooks own client reads
and mutations; UI components render forms, tables, an SVG chart and KPI cards
without duplicating domain math.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Prisma 5 +
PostgreSQL, Supabase Auth, TanStack Query 5, Radix/shadcn, Lucide, Tailwind,
Vitest. No new runtime dependencies are required (Prisma ships decimal.js).

**Execution constraints:** Work on `feat/financial-module`. One implementation
agent writes at a time; never edit files in parallel. Never modify paid
installments. Continuous authorization is granted to commit after each task.
Pushing the branch (`feat/financial-module`) and opening the single pull request
is authorized only after Task 18 gates are green and the final integrated
review is `APPROVED`. Apply the new migration only when the local database is
reachable; otherwise validate without applying and note it.

---

## File Responsibility Map

### Domain

- `src/lib/financial/types.ts`: status, duration, frequency, payment and
  installment constants plus shared interfaces.
- `src/lib/financial/money.ts`: `Prisma.Decimal` helpers and BRL formatting.
- `src/lib/financial/civil-date.ts`: `YYYY-MM-DD` validation and arithmetic.
- `src/lib/financial/contract-code.ts`: `CTR-YYYY-NNNN` generation.
- `src/lib/financial/installments.ts`: equal split, finite plans, recurring
  horizon plans, plan-sum validation.
- `src/lib/financial/metrics.ts`: MRR/ARR, forecast, received, overdue, monthly
  grouping, expiring-soon and active contracted value.
- `src/lib/financial/lifecycle.ts`: transition map, activation rules,
  cancellation plan, renewal predicate.
- `src/lib/financial/changes.ts`: upsell/downsell redistribution and
  adjustment proposals plus validation.
- `src/lib/financial/audit.ts`: transactional `ContractAudit` recorder.
- `src/lib/financial/contracts-service.ts`: transactional contract operations.
- `src/lib/financial/installments-service.ts`: payment, cancellation, refund
  and rolling 12-month horizon extension.
- `src/lib/financial/overview-service.ts`: server-side KPI/chart aggregation.
- `src/lib/financial/http.ts`: `qs` and `fetchJson` helpers for hooks.

### Persistence

- `prisma/schema.prisma`: Client, Contract, ContractItem, ContractProject,
  Installment, ContractChange and ContractAudit models.
- `prisma/migrations/20260802120000_financial_module/migration.sql`: additive
  financial tables.

### APIs

- `src/app/api/clients/route.ts`: list (search/pagination) and create.
- `src/app/api/clients/[id]/route.ts`: detail, patch, deactivate.
- `src/app/api/contracts/route.ts`: list (search/filters/sort/pagination) and
  draft creation.
- `src/app/api/contracts/[id]/route.ts`: detail, patch, draft deletion.
- `src/app/api/contracts/[id]/lifecycle/route.ts`: activate, suspend, resume,
  close, cancel, renew.
- `src/app/api/contracts/[id]/changes/route.ts`: upsell/downsell proposal and
  confirmation.
- `src/app/api/installments/[id]/route.ts`: mark paid, cancel.
- `src/app/api/installments/[id]/refund/route.ts`: linked refund.
- `src/app/api/financial/overview/route.ts`: KPIs, chart, action lists.
- `src/app/api/financial/exports/contracts/route.ts`: filtered CSV export.
- `src/app/api/financial/exports/receivables/route.ts`: filtered CSV export.

### Hooks

- `src/hooks/use-clients.ts`: list, detail, create, update, deactivate.
- `src/hooks/use-contracts.ts`: list, detail, create, update, delete,
  lifecycle, change.
- `src/hooks/use-installments.ts`: pay, cancel, refund.
- `src/hooks/use-overview.ts`: overview query with global filters.
- `src/hooks/use-financial-exports.ts`: contract/receivable CSV downloads.

### UI and state

- `src/app/(authenticated)/financial/layout.tsx`: section tab bar.
- `src/app/(authenticated)/financial/page.tsx`: Overview.
- `src/app/(authenticated)/financial/contracts/page.tsx`: contract list.
- `src/app/(authenticated)/financial/contracts/new/page.tsx`: contract form.
- `src/app/(authenticated)/financial/contracts/[contractId]/page.tsx`: detail.
- `src/app/(authenticated)/financial/receivables/page.tsx`: installment list.
- `src/app/(authenticated)/financial/clients/page.tsx`: client list.
- `src/app/(authenticated)/financial/clients/new/page.tsx`: client form.
- `src/app/(authenticated)/financial/clients/[clientId]/page.tsx`: detail.
- `src/components/layout/sidebar.tsx`: add Financial nav item.
- `src/components/financial/*`: tabs, filters, KPI cards, SVG chart, tables,
  forms, dialogs, badges, money/date text, CSV button, empty/error states.

### Tests

- `src/__tests__/financial-schema.test.ts`
- `src/__tests__/financial-money.test.ts`
- `src/__tests__/financial-installments.test.ts`
- `src/__tests__/financial-metrics.test.ts`
- `src/__tests__/financial-lifecycle.test.ts`
- `src/__tests__/financial-services.test.ts`
- `src/__tests__/financial-clients-api.test.ts`
- `src/__tests__/financial-contracts-api.test.ts`
- `src/__tests__/financial-operations-api.test.ts`
- `src/__tests__/financial-overview-api.test.ts`
- `src/__tests__/financial-exports.test.ts`
- `src/__tests__/financial-hooks.test.ts`
- `src/__tests__/financial-overview-ui.test.ts`
- `src/__tests__/financial-contracts-ui.test.ts`
- `src/__tests__/financial-receivables-ui.test.ts`
- `src/__tests__/financial-clients-ui.test.ts`
- `src/__tests__/financial-responsiveness.test.ts`

---


## Task Briefs

Execute one brief at a time. Do not load every brief into one agent context.

1. [Persistence models and migration](financial-module/task-01-add-financial-persistence-models-and-migration.md)
2. [Money and civil-date helpers](financial-module/task-02-add-money-and-civil-date-domain-helpers.md)
3. [Contract code and installment schedules](financial-module/task-03-add-contract-code-and-installment-schedule-domain.md)
4. [Revenue metrics](financial-module/task-04-add-revenue-metrics-domain.md)
5. [Lifecycle and upsell/downsell rules](financial-module/task-05-add-lifecycle-and-upsell-downsell-rules.md)
6. [Transactional financial services](financial-module/task-06-add-transactional-financial-services.md)
7. [Clients API](financial-module/task-07-add-clients-api.md)
8. [Contracts API](financial-module/task-08-add-contracts-api.md)
9. [Lifecycle, change and installment APIs](financial-module/task-09-add-lifecycle-change-and-installment-apis.md)
10. [Overview API](financial-module/task-10-add-overview-api.md)
11. [CSV export APIs](financial-module/task-11-add-csv-export-apis.md)
12. [React Query hooks](financial-module/task-12-add-react-query-hooks.md)
13. [Navigation and Overview UI](financial-module/task-13-add-financial-navigation-and-overview-ui.md)
14. [Contracts UI](financial-module/task-14-add-contracts-ui.md)
15. [Receivables UI](financial-module/task-15-add-receivables-ui.md)
16. [Clients UI](financial-module/task-16-add-clients-ui.md)
17. [Responsive and accessible states](financial-module/task-17-add-responsive-and-accessible-states.md)
18. [Final verification gates](financial-module/task-18-run-final-verification-gates.md)

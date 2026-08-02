# Financial Module Design

**Date:** 2026-08-02

**Status:** Approved for implementation planning

**Product:** SeOrganize+

## 1. Objective

Add a lightweight financial workspace focused on revenue visibility. Users must be able to register closed contracts, connect them to clients and projects, forecast future cash, record received installments, and understand contract expansion or contraction without turning SeOrganize+ into an accounting system or DRE.

The module exposes two intentionally separate views of revenue:

- **Contracted revenue:** commercial value already closed.
- **Cash forecast and actuals:** expected installments and payments actually received.

All interface copy must be in English.

## 2. Product Scope

The `Financial` workspace contains four sections:

1. `Overview`: executive KPIs, monthly forecast versus received, overdue installments, and contracts expiring soon.
2. `Contracts`: contract creation, search, filters, listing, details, lifecycle actions, and CSV export.
3. `Receivables`: expected, paid, overdue, and cancelled installments with operational actions and CSV export.
4. `Clients`: client records and consolidated contract, project, and revenue history.

All authenticated users can view and edit the module, matching the application's current authorization model.

## 3. Domain Model

### 3.1 Client

A client has:

- Name, required.
- Legal name, optional.
- CPF/CNPJ, optional and unique when present.
- Email, optional.
- Phone, optional.
- Notes, optional.
- Active/inactive status.

A client can have multiple contracts and projects. A client with financial history cannot be hard-deleted; it can only be made inactive.

### 3.2 Contract

A contract has:

- Immutable, automatically generated code in the form `CTR-YYYY-NNNN`.
- Editable title.
- Client.
- Optional internal owner selected from existing profiles.
- Lifecycle status.
- Duration type.
- Official manually entered value.
- Start date and, when applicable, end date.
- Billing frequency and default payment method.
- External document URL, optional.
- Notes, optional.
- Linked items, projects, installments, changes, and audit history.
- Optional predecessor/successor relation for renewals.

The official contract value is always entered manually. Item prices never replace it.

### 3.3 Duration types

- **Fixed term:** required start and end dates; official value represents the finite contract total.
- **Open-ended recurring:** required start date, no end date; official value represents one billing cycle.
- **One-time:** single delivery; official value represents the finite total.

Recurring billing frequencies are monthly, quarterly, semiannual, and annual.

### 3.4 Contract lifecycle

The lifecycle is:

`Draft -> Active -> Closed`

Additional terminal or temporary states are `Cancelled` and `Suspended`.

- Drafts may be incomplete and may be hard-deleted.
- Active contracts may be edited.
- Activated contracts are never hard-deleted.
- Financially relevant edits create audit entries with before/after values, actor, timestamp, and an optional reason.
- Descriptive edits may omit a reason and still remain visible through normal update metadata.

### 3.5 Contract items

Items belong only to one contract; there is no global product or service catalog.

Each item supports:

- Name.
- Optional description.
- Optional quantity and unit.
- Optional price within that contract.
- Manual display order.

The item-price sum is informational. A mismatch with the official contract value shows a warning but never blocks saving or activation.

### 3.6 Contract-project relationship

A contract can link multiple projects. A project can occur in multiple historical contracts but can belong to at most one active contract at a time. Activation must reject a conflicting active link.

Project-filtered financial metrics include the full linked contract value. Revenue is not allocated across projects in this release.

### 3.7 Installments

An installment has:

- Expected amount.
- Due date.
- Payment method, defaulted from the contract but individually editable.
- State: pending, paid, or cancelled.
- Actual payment date when paid.

`Overdue` is derived when a pending installment has a due date before the current civil date. It is not manually editable.

The system suggests equal installments and puts any cent rounding remainder in the final installment. Users may override every installment amount. For fixed-term and one-time contracts, installment values must sum exactly to the official contract value before activation.

Payment methods are Pix, boleto, bank transfer, credit card, debit card, cash, and other. The only supported currency is BRL.

Partial payments are not supported. An installment is either fully paid or remains pending.

A refund creates a separate negative paid installment linked to the original paid installment. Its payment date is the actual refund date, so received metrics subtract it in the correct period. The original installment remains immutable.

### 3.8 Recurring installment horizon

Open-ended recurring contracts maintain a rolling 12-month installment window. When the Financial workspace is accessed, the server idempotently generates any missing future installments through the horizon without duplicating existing rows.

### 3.9 Upsell and downsell

Each contract change records:

- Type: upsell or downsell.
- Delta.
- Effective date.
- Description.
- Previous and new official values.
- Actor and timestamp.
- Optional reason.

Paid installments are immutable during an adjustment. The user chooses one of two strategies for the delta:

- Redistribute it across pending installments.
- Create additional installments or negative adjustments.

The system proposes the result and applies it only after confirmation. A downsell cannot produce an invalid negative contract value or invalid installment schedule.

### 3.10 Renewal

`Renew` creates a draft copying client, items, projects, owner, and commercial conditions. Activating the renewal closes its predecessor and transfers project links to the new active contract in one transaction. The predecessor/successor chain remains navigable.

### 3.11 Cancellation

Cancellation requires an effective date and confirmation.

- Paid installments remain unchanged.
- Already overdue installments remain collectible.
- Future installments after the effective date are cancelled by default.
- The user may explicitly retain exceptional future installments before confirming.

## 4. Revenue Metrics

Financial concepts must remain separate:

- **Active Contracted Value:** current official value of active fixed-term and one-time contracts.
- **MRR:** monthly recurring value. Monthly is 100%; quarterly is divided by 3; semiannual by 6; annual by 12.
- **ARR:** MRR multiplied by 12.
- **Cash Forecast:** non-cancelled installment values grouped by due date in the selected period.
- **Received:** paid installment values grouped by actual payment date in the selected period.
- **Overdue:** pending installment values with a due date before the current civil date.
- **Upsell / Downsell:** separate sums of contract-change deltas by effective date.
- **Active Contracts:** count of active contracts.
- **Expiring Soon:** active fixed-term contracts ending within the next 30 days.

The monthly chart compares expected value by installment due date with received value by actual payment date.

Default overview periods are:

- Current month for received and overdue indicators.
- Next 90 days for cash forecast.
- User-selectable custom period for all compatible metrics.

## 5. User Experience

### 5.1 Navigation and overview

Add `Financial` to the existing sidebar. The overview follows an executive-first hierarchy:

1. Primary KPI cards.
2. Main `Forecast vs. Received` monthly chart.
3. Action lists for overdue installments and expiring contracts.
4. Secondary upsell/downsell and contract counts.

Global filters are period, client, contract status, project, and installment status. Compatible filters affect KPIs, charts, and lists together.

### 5.2 Contract form

Contract creation uses one scrollable form, not a wizard. Visual sections are collapsible:

- Contract data.
- Scope and items.
- Linked projects.
- Billing and installments.

Users can save an incomplete draft. Activation requires client, type, official value, applicable dates, a valid project relationship, and a consistent installment schedule. The form shows a financial consistency summary before activation.

### 5.3 Contract detail

The detail view contains:

- Commercial summary.
- Items.
- Linked projects.
- Installments.
- Upsell/downsell history.
- General audit history.
- Lifecycle actions including suspend, resume, close, cancel, and renew when valid.

### 5.4 Lists and exports

Contract and receivable lists use server-side search, filters, sorting, and pagination with 25 rows by default. The expected first-year volume is 100-1,000 contracts.

CSV exports exist for contracts and receivables. Exports respect active filters, use stable English headers, represent money consistently in BRL, and do not silently truncate to the visible page.

### 5.5 Responsive and accessible states

All screens follow the current desktop, tablet, and mobile layout patterns. Required states are loading, empty, error, validation feedback, and success feedback. Interactive controls need labels, keyboard reachability, visible focus, and semantic error association.

## 6. Technical Architecture

Use the existing Next.js 14, Prisma, PostgreSQL, React Query, and component patterns.

### 6.1 Boundaries

- API routes expose clients, contracts, installments, exports, and overview reads.
- A dedicated financial domain layer owns lifecycle transitions, schedule generation, calculations, and invariants.
- React Query hooks own client-side reads, mutations, cache invalidation, and user feedback.
- UI components render forms, tables, charts, KPI cards, and detail sections without duplicating domain calculations.

### 6.2 Transactions and consistency

Use Prisma transactions for operations that update multiple records, including:

- Contract activation.
- Active financial edits and audit creation.
- Upsell/downsell and installment adjustment.
- Cancellation.
- Renewal activation and project transfer.
- Recurring installment extension.

Money uses a decimal database type and decimal-safe application handling, never JavaScript floating-point arithmetic for financial calculations.

Financial dates are date-only civil values. Comparisons must not depend on browser or server timezone conversion.

### 6.3 API behavior

All endpoints require authentication. Errors use stable categories:

- `AUTH_ERROR`
- `VALIDATION_ERROR`
- `CONFLICT`
- `NOT_FOUND`
- `INTERNAL_ERROR`

Server-side validation is authoritative. Client validation exists only for immediate feedback.

Overview aggregation happens on the server. Pagination, search, filters, and sorting also execute on the server.

## 7. Error and Edge-Case Rules

- Reject activation when a linked project already belongs to another active contract.
- Reject finite-contract activation when installment totals do not match official value.
- Never modify paid installments through contract edits or adjustments.
- Reject refunds that are not linked to a paid installment or that exceed its refundable value.
- Never duplicate recurring installments for the same contract and cycle date.
- Reject renewal activation when its predecessor is not in a renewable state.
- Reject invalid date ranges and frequencies incompatible with duration type.
- Prevent CPF/CNPJ duplicates when a value is supplied.
- Preserve auditable financial history for all activated contracts.
- Show, but do not block on, item-price sum mismatches.
- Do not calculate taxes, fees, commissions, or expenses.

## 8. Testing Strategy and Definition of Done

Automated coverage must include:

- Equal installment generation, manual overrides, exact sums, and rounding remainder.
- MRR and ARR normalization for every frequency.
- Forecast, received, overdue, and monthly grouping rules.
- Idempotent rolling 12-month recurring generation.
- Upsell/downsell with protection of paid installments.
- Cancellation, suspension, closure, and renewal transitions.
- One-active-contract-per-project enforcement.
- Before/after financial audit creation.
- Authentication, validation, conflicts, search, filters, sorting, and pagination.
- Filter-respecting contract and receivable CSV exports.
- UI loading, empty, error, validation, and success states.
- Critical contract, installment, renewal, and cancellation interactions.
- Responsive behavior and basic accessibility.

The delivery is complete only when all gates are boolean green:

- Every approved functional criterion is implemented.
- Automated tests pass.
- Lint passes.
- Typecheck passes.
- Production build passes.
- No known regression remains.
- Task review is `APPROVED` with no blocking finding.
- Final integrated review is `APPROVED` with no blocking finding.

## 9. Explicitly Out of Scope

- DRE, expenses, taxes, fees, and commissions.
- Bank reconciliation and payment-gateway integrations.
- Partial payments and a financial ledger.
- Sales pipeline, proposals, win probability, and weighted forecasts.
- File upload or managed contract storage.
- Automated notifications and push alerts.
- CSV import.
- Multiple currencies or exchange rates.
- Global product/service catalog.
- Revenue allocation across projects.
- Financial role-based permissions.
- Financial PDF reports.

Refunds use the linked negative-installment rule defined above. They do not introduce a general ledger.

## 10. Delivery Constraints

- One feature branch and one pull request.
- Only one implementation agent writes at a time.
- A separate reviewer reports only `APPROVED` or `REJECTED` and never edits code.
- Each implementation/review loop is limited to three rounds.
- If still rejected, one recovery cycle may swap roles and revise the technical approach, with at most three additional rounds.
- A task is approved only after 100% review approval.
- The pull request is created only after every task and the final integrated review are approved.
- The Maestro orchestrates and does not implement product code.

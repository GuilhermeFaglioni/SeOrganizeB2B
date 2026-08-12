# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners and operators of small-to-mid B2B teams (founders, PMs, operations leads) who run delivery and finance across a single workspace. They arrive via a public marketing site, create an account, and expect to pay to unlock product modules.

## Product Purpose

SeOrganize+ is a collaborative workspace that combines task/project execution, calendar, documents, and a financial module (contracts, proposals, clients, receivables) in one place. Success means a new visitor understands the offer, creates an account, pays for a plan through Stripe Elements, and their workspace unlocks the purchased modules.

## Positioning

A single multi-module workspace (execution + financial) where the paywall is the product: a fresh account lands in a locked shell with only "Plans" reachable, and a successful Stripe checkout activates the workspace plan and its `allowedModules`.

## Operating Context

- Web app; multi-tenant via `workspace.tenantId`.
- Auth via Supabase (email/password, Google, magic link).
- Billing via Stripe (Payment Element + Subscription with `payment_behavior: default_incomplete`); webhook `invoice.payment_succeeded` / `customer.subscription.updated` activates the workspace.
- Feature gating reads the workspace's plan `allowedModules`; RBAC (roles/permissions) is separate from billing and must not bypass it.

## Capabilities and Constraints

- Modules: tasks, projects, calendar, documents, financial (overview/contracts/proposals/clients/receivables), areas.
- A workspace's reachable modules come from its plan's `allowedModules`. An empty list means **no** product modules (locked), not "all modules".
- New workspaces are created **without** a plan (locked) until the owner pays.
- A super-admin (by email allowlist) only gains access to the `/admin` panel; workspace-level Admin does not bypass billing.
- Stripe price ids are validated as `price_*` (a `prod_*` id is rejected).

## Brand Commitments

- Name: SeOrganize+ (S+ mark).
- Visual world: Executive Quartz — navy sidebar `#10233F`, brand blue `#2F6FED`, light surfaces `#F4F7FB`, Geist type. Calm, executive, information-dense in-app; more air on marketing. (No redesign.)

## Evidence on Hand

- Real product modules and their routes (src/app), the existing checkout/webhook implementation, and the incumbent design tokens (globals.css, tailwind.config.ts). No real customer logos, testimonials, or case studies exist; landing must not fabricate them.

## Product Principles

1. Paywall-first: value is visible but gated behind a plan.
2. Billing and RBAC are orthogonal; neither grants the other.
3. One workspace = one subscription = one plan.
4. The in-app identity and the marketing site are one product.

## Accessibility & Inclusion

Follow the incumbent theme (light/dark via class), keyboard focus and contrast per the design floor; i18n in pt-BR and en.

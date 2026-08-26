# Spec: Modelo de Créditos do AI Studio

## Problem Statement

O AI Studio atualmente registra eventos operacionais de geração e aplica um rate limit por Empresa, mas não possui um modelo comercial de créditos. Isso impede controlar o custo de acesso ao AI Studio, oferecer créditos por plano, vender créditos avulsos, limitar o uso por membro e medir margem por provider/modelo.

O produto precisa cobrar de forma previsível e compreensível. Cobrar cada alteração ou expor tokens diretamente criaria sensação de consumo excessivo e uma experiência difícil de entender. Ao mesmo tempo, a plataforma precisa medir tokens e custo real para controlar margem e operar providers gerenciados.

## Solution

Adicionar um modelo de créditos compartilhado por Empresa (`Workspace`), com ciclos de uso do AI Studio. Um crédito de um provider gerenciado inicia um ciclo que inclui a geração inicial e até cinco alterações utilizáveis, encerrando ao salvar o template, atingir cinco alterações ou expirar após 30 minutos. O custo comercial do ciclo é fixo e configurável por modelo; o custo real de tokens é medido separadamente.

Conexões BYOK, em que a Empresa usa seu próprio provider/API, não consomem créditos e não ficam sujeitas aos limites comerciais de cinco alterações ou 30 minutos. Elas continuam sujeitas aos limites técnicos e de segurança da plataforma.

O saldo será um ledger imutável, com categorias separadas para créditos de assinatura, compra avulsa, promoção, consumo, expiração, estorno e ajuste administrativo. A ordem de consumo será: promocionais, assinatura e avulsos.

## User Stories

1. As a Empresa, I want a shared AI Studio credit balance, so that my members can use the feature without maintaining separate personal balances.
2. As a gestor, I want to define a monthly individual credit limit for a member, so that I can control one member's usage without creating a separate balance.
3. As a member, I want to see subscription and purchased credit balances separately, so that I understand what will expire and what remains available.
4. As a member, I want to see the model's cycle cost before starting, so that I am not surprised by consumption.
5. As a member, I want one managed-provider credit to include the initial generation and up to five usable alterations, so that iterative design does not feel like repeated charges.
6. As a member, I want saving the edited template to close the cycle, so that the commercial unit maps to a complete creation task.
7. As a member, I want an abandoned managed-provider cycle to remain resumable for 30 minutes, so that a reload or temporary interruption does not waste my credit.
8. As a member, I want the last candidate and compact session summary recovered when I resume, so that I can continue without persisting the full transcript.
9. As a member, I want reopening a saved template for AI refinement to start a new cycle, so that completed work and new work are clearly separated.
10. As a member using BYOK, I want AI Studio calls not to consume platform credits, so that my own provider usage is billed by my provider.
11. As a member using BYOK, I want to use AI Studio without the commercial five-edit/30-minute cycle cap, so that the platform credit model does not restrict usage I fund directly.
12. As a member, I want failed requests without a usable response to receive an automatic credit refund, so that provider failures do not penalize me.
13. As a member, I want failed refunds to be protected by an attempt limit, so that the retry policy remains fair and predictable.
14. As a gestor, I want to grant a delegated permission for avulso credit purchases, so that financial purchasing can be assigned without granting all administrative permissions.
15. As a permitted purchaser, I want to buy credit packages through Stripe, so that purchased credits are added after confirmed payment.
16. As a purchaser, I want purchased credits to accumulate and not expire, so that paid credits remain available until used.
17. As a Empresa, I want subscription credits granted only after a paid invoice, so that entitlement reflects confirmed billing.
18. As a Empresa, I want subscription credits to renew without accumulating, so that each billing cycle has a predictable entitlement.
19. As a Empresa, I want unused subscription credits to expire only when the next paid grant is issued, so that payment failure does not remove already granted value prematurely.
20. As a Empresa, I want paid-period cancellation and grace-period behavior to be predictable, so that I know when existing subscription credits remain usable.
21. As a platform administrator, I want to configure monthly credits per plan, so that entitlements can change without code changes.
22. As a platform administrator, I want to configure provider ownership mode, model availability, token prices, cycle credit cost and technical capabilities, so that managed and BYOK models can be operated safely.
23. As a platform administrator, I want model cost changes to affect only new cycles, so that active user promises remain stable.
24. As a platform administrator, I want to configure credit packages, purchase limits and promotional grants, so that commercial campaigns do not require deployments.
25. As a platform administrator, I want to grant, revoke or adjust credits with a mandatory reason, so that support corrections remain auditable.
26. As a platform administrator, I want to see credits, cycles, tokens, provider costs, failures and estimated margin, so that I can manage the economics of AI Studio.
27. As a platform administrator, I want managed-provider credentials to remain in infrastructure secrets, so that the admin UI never exposes them.
28. As a platform administrator, I want no silent fallback between providers, so that the selected model and cost remain explicit.
29. As a platform administrator, I want historical ledger and cost configuration records retained, so that financial and operational audits remain possible.
30. As a developer, I want provider adapters to report actual token usage when possible and estimated usage otherwise, so that margin reporting remains useful across providers.

## Implementation Decisions

- Introduce a credit ledger as an append-only financial boundary. Entries must identify Empresa, category, quantity, source entitlement or purchase, actor when applicable, reason, billing period, expiration, and idempotency key.
- Keep subscription, purchased, promotional and adjustment balances distinguishable. Consume in this order: promotional, subscription, purchased.
- Model monthly subscription entitlement as configurable plan data, using the existing plan administration surface. Numeric quantities and package prices are intentionally deferred.
- Grant subscription credits from a confirmed Stripe `invoice.paid` event. Use the invoice identifier for webhook idempotency. A paid renewal grants the new entitlement and expires remaining credits from the prior subscription grant in one transaction.
- Treat Stripe for SeOrganize+ subscription and credit-package billing as an explicit exception to ADR 0002. ADR 0002 remains applicable to customer billing inside the financial module.
- Use Stripe Checkout for avulso packages. Grant credits only from confirmed payment webhooks. Reimburse unused purchased credits proportionally on package refund; create a compensating ledger entry and never allow a negative balance.
- Keep purchased credits non-expiring. Promotional credits have an explicit campaign and expiration. Manual grants and revocations are platform-admin-only and audited.
- Add an independent Empresa permission for avulso purchases, such as `billing.ai_credits.purchase`. Gestors can delegate it; platform credit grants remain platform-admin-only.
- Represent the managed/BYOK distinction explicitly on the provider connection or catalog. Do not infer it from `api_key` versus OAuth. Managed providers use platform infrastructure secrets; BYOK uses the Empresa connection secret.
- Managed-provider cycle state is server-persisted and transactionally tied to the ledger debit. It contains Empresa, member, selected model, frozen model pricing, origin of the debit, status, alteration count, expiration, last candidate HTML, detected variables and compact session summary.
- A managed cycle starts on the first generation, includes that generation plus up to five usable alterations, and ends on save, the fifth usable alteration, or 30 minutes. Failed attempts that are automatically refunded do not count as alterations. A maximum of three refunded failures per cycle prevents infinite retries.
- A managed cycle is debited at start using the model's fixed `creditCostPerCycle`. No dynamic token charge is exposed to the member. A model cost change affects only new cycles.
- BYOK calls do not debit credits and do not use the commercial cycle cap. Existing request-level safety controls remain mandatory.
- Reopening a saved template for AI refinement starts a new managed cycle. Switching managed to managed preserves the active cycle but records the provider/model change; switching managed to BYOK stops credit consumption for later calls; switching BYOK to managed starts a new managed cycle.
- Pre-provider validation failures do not debit. Provider failures, timeouts, network failures, blocked requests and invalid provider contracts without a usable response trigger one automatic refund according to the error policy. A usable response keeps the debit.
- Provider adapters expose actual input/output tokens when available. Streaming adapters must gain a usage reporting path; when unavailable, the service records a bounded estimate and marks the usage as estimated.
- The global admin model catalog owns canonical provider/model identifiers, ownership mode, active status, capabilities, token cost inputs/outputs, image cost, cycle credit cost, technical token limit, and effective version. Active cycles freeze the applicable version.
- The admin dashboard exposes grants, consumption, expiration, adjustments, cycles, actual/estimated tokens, provider cost, estimated margin, failures, refunds, high-usage Empresas and members, and filters/export by period, plan, provider, model and Empresa.
- User-facing AI Studio UI displays subscription, promotional and purchased balances, individual monthly limit usage, model cycle cost, remaining alterations, cycle expiration and pre-blocking warnings.
- Subscription cancellation leaves subscription credits usable through the paid period. During grace period, existing credits remain usable; after grace, new managed cycles are blocked while credits remain preserved for reactivation according to billing state.
- Existing Empresas receive plan credits on the next paid cycle, with no retroactive grant. No credits are granted to plans without AI Studio enabled. BYOK does not bypass plan feature gating.
- Preserve tenant isolation and RLS for all tenant-scoped credit, cycle and usage data. Platform-admin operations require the existing super-admin boundary.
- Retain the financial ledger for the applicable legal/audit lifetime. Keep operational AI usage events at the existing 90-day retention policy, without storing prompts, full transcript, image bytes or provider secrets.
- Preferred implementation seams are: one credit/cycle domain service for atomic reservation, debit, refund and limits; one provider catalog/pricing service; and one billing webhook boundary for Stripe grants and package purchases.

## Testing Decisions

- Test externally observable behavior at the domain-service, API, webhook and UI boundaries rather than implementation details.
- Add schema tests for ledger, cycle, catalog, model version, package, grant and member-limit invariants, including tenant relations, indexes, idempotency keys and RLS policies.
- Add transaction/concurrency tests proving that two members cannot overspend the same Empresa balance or exceed a member limit, and that Stripe events cannot grant twice.
- Add cycle state tests for start, resume, save, fifth usable alteration, expiry, managed/BYOK switching, model-price freezing and three refunded failures.
- Add billing tests for `invoice.paid`, Checkout completion, refund reconciliation, payment failure, cancellation, grace period, plan changes and idempotent retries.
- Add provider tests for actual usage, estimated usage, streaming usage, managed/BYOK classification, unavailable models, no silent fallback and error-to-refund mapping.
- Add authorization tests for platform-admin catalog/ledger operations, Empresa purchase permission delegation, member limits and cross-tenant access denial.
- Add UI behavior tests for balances, warnings, pre-cycle disclosure, cycle progress, admin configuration and audit history, following existing admin and AI Studio API behavior-test patterns.
- Add retention tests proving that operational pruning never deletes financial ledger entries.

## Out of Scope

- Defining the numeric monthly credit quantity for each plan.
- Defining prices and quantities for avulso packages.
- Selecting the final managed provider/model; OpenCode Zen is the current candidate.
- Dynamic per-token charging to the member.
- Charging BYOK usage with platform credits.
- Automatic provider fallback.
- Persisting full prompts, transcript, image bytes or provider secrets.
- Customer-facing billing of the prestador digital's own clients; ADR 0002 remains in force for that area.
- Native mobile implementation.
- Multi-currency pricing or international tax handling.

## Further Notes

- The current AI Studio usage event already records provider, auth method, model, status, latency and optional token counts; the credit model should extend this operational telemetry rather than replace it. Catalog token prices are stored as USD micros per one million tokens and converted proportionally when calculating provider cost.
- The current `Plan`/`PlanLimit` and Stripe customer fields are extension points, but a ledger is required because a plan limit alone cannot represent grants, expiration, purchases, refunds or audit history.
- The first release should treat the absence of configured plan/package values as a configuration state, not invent business defaults.

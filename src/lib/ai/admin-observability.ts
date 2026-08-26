import { prisma, withTenantBypass } from "../../../prisma/client";

const DAY = 24 * 60 * 60 * 1_000;

export interface AIObservabilityFilters {
  from?: Date;
  to?: Date;
  planId?: string;
  provider?: string;
  model?: string;
  tenantId?: string;
}

export interface AIObservabilityReport {
  filters: { from: string; to: string; planId: string | null; provider: string | null; model: string | null; tenantId: string | null };
  summary: {
    grants: number;
    consumed: number;
    expired: number;
    adjustments: number;
    refunds: number;
    cycles: number;
    failedEvents: number;
    actualInputTokens: number;
    actualOutputTokens: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    providerCostMicros: number;
    estimatedRevenueCents: number;
    estimatedMarginCents: number | null;
  };
  ledger: Array<{ id: string; tenantId: string; tenantName: string; plan: string | null; pool: string; kind: string; quantity: number; createdAt: string; expiresAt: string | null; reason: string | null }>;
  cycles: Array<{ id: string; tenantId: string; tenantName: string; plan: string | null; actorId: string; provider: string; model: string; status: string; creditCost: number; alterations: number; refundedFailures: number; createdAt: string }>;
  highUsageTenants: Array<{ tenantId: string; tenantName: string; credits: number; requests: number }>;
  highUsageMembers: Array<{ tenantId: string; tenantName: string; actorId: string; credits: number; requests: number }>;
}

function bounds(filters: AIObservabilityFilters) {
  const to = filters.to ?? new Date();
  const from = filters.from ?? new Date(to.getTime() - 30 * DAY);
  return { from: from <= to ? from : new Date(to.getTime() - 30 * DAY), to };
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function aiObservabilityCsv(report: AIObservabilityReport): string {
  const rows = [
    ["record", "tenant_id", "tenant", "plan", "pool", "kind", "quantity", "created_at", "expires_at", "reason"],
    ...report.ledger.map((row) => ["ledger", row.tenantId, row.tenantName, row.plan, row.pool, row.kind, row.quantity, row.createdAt, row.expiresAt, row.reason]),
    ["cycle", "tenant_id", "tenant", "plan", "", "status", "credit_cost", "created_at", "", "provider/model"],
    ...report.cycles.map((row) => ["cycle", row.tenantId, row.tenantName, row.plan, "", row.status, row.creditCost, row.createdAt, "", `${row.provider}/${row.model}`]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export async function getAIObservabilityReport(input: AIObservabilityFilters = {}): Promise<AIObservabilityReport> {
  const { from, to } = bounds(input);
  return withTenantBypass(async () => {
    const workspaces = await prisma.workspace.findMany({
      where: { deletedAt: null, ...(input.tenantId ? { id: input.tenantId } : {}), ...(input.planId ? { planId: input.planId } : {}) },
      select: { id: true, name: true, plan: { select: { name: true } } },
    });
    const tenantIds = workspaces.map((workspace) => workspace.id);
    const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    const common = { gte: from, lte: to } as const;
    const [ledgerRows, usageRows, cycleRows, purchases] = await Promise.all([
      prisma.aiCreditLedgerEntry.findMany({ where: { tenantId: { in: tenantIds }, createdAt: common }, orderBy: { createdAt: "desc" }, take: 5_000, select: { id: true, tenantId: true, pool: true, kind: true, quantity: true, createdAt: true, expiresAt: true, reason: true } }),
      prisma.aiStudioUsageEvent.findMany({ where: { tenantId: { in: tenantIds }, createdAt: common, ...(input.provider ? { provider: input.provider } : {}), ...(input.model ? { model: input.model } : {}) }, select: { tenantId: true, actorId: true, provider: true, model: true, inputTokens: true, outputTokens: true, tokenUsageEstimated: true, status: true } }),
      prisma.aiStudioManagedCycle.findMany({ where: { tenantId: { in: tenantIds }, createdAt: common, ...(input.provider ? { provider: input.provider } : {}), ...(input.model ? { model: input.model } : {}) }, orderBy: { createdAt: "desc" }, take: 5_000, select: { id: true, tenantId: true, actorId: true, provider: true, model: true, status: true, creditCostPerCycle: true, alterationCount: true, refundedFailureCount: true, createdAt: true } }),
      prisma.aiCreditPurchase.findMany({ where: { tenantId: { in: tenantIds }, createdAt: common, status: "paid" }, select: { amountCents: true, creditQuantity: true } }),
    ]);
    const usage = usageRows.filter((row) => !input.provider || row.provider === input.provider).filter((row) => !input.model || row.model === input.model);
    const ledger = ledgerRows.map((row) => { const tenant = workspaceById.get(row.tenantId)!; return { ...row, tenantName: tenant?.name ?? "", plan: tenant?.plan?.name ?? null, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt?.toISOString() ?? null }; });
    const cycles = cycleRows.map((row) => { const tenant = workspaceById.get(row.tenantId)!; return { id: row.id, tenantId: row.tenantId, tenantName: tenant?.name ?? "", plan: tenant?.plan?.name ?? null, actorId: row.actorId, provider: row.provider, model: row.model, status: row.status, creditCost: row.creditCostPerCycle, alterations: row.alterationCount, refundedFailures: row.refundedFailureCount, createdAt: row.createdAt.toISOString() }; });
    const catalog = await prisma.aiModelCatalogEntry.findMany({ where: { provider: { in: [...new Set(usage.map((row) => row.provider))] }, model: { in: [...new Set(usage.map((row) => row.model))] } }, select: { provider: true, model: true, inputCostMicros: true, outputCostMicros: true } });
    const prices = new Map(catalog.map((entry) => [`${entry.provider}/${entry.model}`, entry]));
    let actualInputTokens = 0; let actualOutputTokens = 0; let estimatedInputTokens = 0; let estimatedOutputTokens = 0; let providerCostMicros = 0;
    const tenantUsage = new Map<string, { credits: number; requests: number }>(); const memberUsage = new Map<string, { credits: number; requests: number }>();
    for (const row of usage) {
      const inputTokens = row.inputTokens ?? 0; const outputTokens = row.outputTokens ?? 0;
      if (row.tokenUsageEstimated) { estimatedInputTokens += inputTokens; estimatedOutputTokens += outputTokens; } else { actualInputTokens += inputTokens; actualOutputTokens += outputTokens; }
       const price = prices.get(`${row.provider}/${row.model}`); if (price) providerCostMicros += Math.ceil((inputTokens * price.inputCostMicros + outputTokens * price.outputCostMicros) / 1_000_000);
      if (row.status !== "success") continue;
      const tenant = tenantUsage.get(row.tenantId) ?? { credits: 0, requests: 0 }; tenant.requests += 1; tenantUsage.set(row.tenantId, tenant);
      const memberKey = `${row.tenantId}:${row.actorId}`; const member = memberUsage.get(memberKey) ?? { credits: 0, requests: 0 }; member.requests += 1; memberUsage.set(memberKey, member);
    }
    for (const cycle of cycles) {
      const tenant = tenantUsage.get(cycle.tenantId) ?? { credits: 0, requests: 0 }; tenant.credits += cycle.creditCost; tenantUsage.set(cycle.tenantId, tenant);
      const memberKey = `${cycle.tenantId}:${cycle.actorId}`; const member = memberUsage.get(memberKey) ?? { credits: 0, requests: 0 }; member.credits += cycle.creditCost; memberUsage.set(memberKey, member);
    }
    const paidCredits = purchases.reduce((sum, purchase) => sum + purchase.creditQuantity, 0); const paidRevenue = purchases.reduce((sum, purchase) => sum + purchase.amountCents, 0); const centsPerCredit = paidCredits ? paidRevenue / paidCredits : null;
    const estimatedRevenueCents = centsPerCredit == null ? 0 : Math.round([...tenantUsage.values()].reduce((sum, value) => sum + value.credits, 0) * centsPerCredit);
    const providerCostCents = Math.ceil(providerCostMicros / 10_000);
    const tenantList = [...tenantUsage.entries()].sort((a, b) => b[1].credits - a[1].credits).slice(0, 20).map(([tenantId, value]) => ({ tenantId, tenantName: workspaceById.get(tenantId)?.name ?? "", ...value }));
    const memberList = [...memberUsage.entries()].sort((a, b) => b[1].credits - a[1].credits).slice(0, 20).map(([key, value]) => { const [tenantId, actorId] = key.split(":"); return { tenantId, tenantName: workspaceById.get(tenantId)?.name ?? "", actorId, ...value }; });
    return { filters: { from: from.toISOString(), to: to.toISOString(), planId: input.planId ?? null, provider: input.provider ?? null, model: input.model ?? null, tenantId: input.tenantId ?? null }, summary: { grants: ledger.filter((row) => row.quantity > 0 && row.kind.includes("grant")).reduce((sum, row) => sum + row.quantity, 0), consumed: Math.abs(ledger.filter((row) => row.kind === "cycle_debit").reduce((sum, row) => sum + row.quantity, 0)), expired: Math.abs(ledger.filter((row) => row.kind === "expiration").reduce((sum, row) => sum + row.quantity, 0)), adjustments: ledger.filter((row) => row.kind === "adjustment").reduce((sum, row) => sum + Math.abs(row.quantity), 0), refunds: ledger.filter((row) => row.kind === "refund").reduce((sum, row) => sum + Math.abs(row.quantity), 0), cycles: cycles.length, failedEvents: usage.filter((row) => row.status !== "success").length, actualInputTokens, actualOutputTokens, estimatedInputTokens, estimatedOutputTokens, providerCostMicros, estimatedRevenueCents, estimatedMarginCents: centsPerCredit == null ? null : estimatedRevenueCents - providerCostCents }, ledger, cycles, highUsageTenants: tenantList, highUsageMembers: memberList };
  });
}

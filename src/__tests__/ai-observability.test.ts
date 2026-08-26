import { describe, expect, it } from "vitest";
import { aiObservabilityCsv, type AIObservabilityReport } from "../lib/ai/admin-observability";

describe("AI observability export", () => {
  it("exports audit-safe ledger and cycle fields only", () => {
    const report = {
      filters: { from: "2026-01-01", to: "2026-01-31", planId: null, provider: null, model: null, tenantId: null },
      summary: { grants: 1, consumed: 1, expired: 0, adjustments: 0, refunds: 0, cycles: 1, failedEvents: 0, actualInputTokens: 2, actualOutputTokens: 3, estimatedInputTokens: 0, estimatedOutputTokens: 0, providerCostMicros: 4, estimatedRevenueCents: 5, estimatedMarginCents: 6 },
      ledger: [{ id: "ledger-1", tenantId: "tenant-1", tenantName: "Company", plan: "Pro", pool: "subscription", kind: "cycle_debit", quantity: -1, createdAt: "2026-01-01", expiresAt: null, reason: "cycle" }],
      cycles: [{ id: "cycle-1", tenantId: "tenant-1", tenantName: "Company", plan: "Pro", actorId: "member-1", provider: "managed", model: "model", status: "active", creditCost: 1, alterations: 0, refundedFailures: 0, createdAt: "2026-01-01" }],
      highUsageTenants: [],
      highUsageMembers: [],
    } satisfies AIObservabilityReport;

    const csv = aiObservabilityCsv(report);
    expect(csv).toContain("tenant-1");
    expect(csv).toContain("managed/model");
    expect(csv).not.toContain("lastCandidateHtml");
    expect(csv).not.toContain("sessionSummary");
    expect(csv).not.toContain("prompt");
    expect(csv).not.toContain("secret");
  });
});

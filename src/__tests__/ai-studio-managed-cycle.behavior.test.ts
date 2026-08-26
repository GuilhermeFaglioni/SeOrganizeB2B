import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cycleFindFirst: vi.fn(),
  cycleCreate: vi.fn(),
  cycleUpdate: vi.fn(),
  cycleUpdateMany: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  withTenant: vi.fn((_tenant: string, fn: () => unknown) => fn()),
  consume: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: { aiStudioManagedCycle: { findFirst: mocks.cycleFindFirst, create: mocks.cycleCreate, update: mocks.cycleUpdate, updateMany: mocks.cycleUpdateMany }, $transaction: mocks.transaction },
  withTenant: mocks.withTenant,
}));
vi.mock("../lib/ai/credit-ledger", () => ({ consumeAICreditsInTransaction: mocks.consume }));

import { closeManagedAICycle, recordManagedAICycleCandidate, startOrResumeManagedAICycle } from "../lib/ai/managed-cycle";

const catalog = {
  id: "catalog-1", provider: "openai", model: "gpt-4o", ownershipMode: "managed" as const,
  isActive: true, vision: false, streaming: true, inputCostMicros: 1, outputCostMicros: 2,
  imageCostMicros: 0, creditCostPerCycle: 3, maxOutputTokens: 100, version: 7,
  effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null,
};

describe("managed AI Studio cycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.withTenant.mockImplementation((_tenant: string, fn: () => unknown) => fn());
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: mocks.queryRaw,
      aiStudioManagedCycle: { findFirst: mocks.cycleFindFirst, create: mocks.cycleCreate, update: mocks.cycleUpdate },
      aiCreditLedgerEntry: { findMany: vi.fn(), create: vi.fn() },
    }));
    mocks.queryRaw.mockResolvedValue([{ id: "tenant-1" }]);
    mocks.consume.mockResolvedValue({ allocations: [{ pool: "subscription", quantity: 3 }], replayed: false });
  });

  it("debits once when starting and resumes the same active member cycle", async () => {
    const cycle = { id: "cycle-1", tenantId: "tenant-1", actorId: "user-1", provider: "openai", model: "gpt-4o", catalogEntryId: "catalog-1", modelVersion: 7, creditCostPerCycle: 3, debitOperationKey: "debit-1", alterationCount: 0, refundedFailureCount: 0, status: "active", expiresAt: new Date(Date.now() + 10_000), lastCandidateHtml: null, detectedVariables: [], sessionSummary: null };
    mocks.cycleFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(cycle);
    mocks.cycleCreate.mockResolvedValue(cycle);

    const first = await startOrResumeManagedAICycle({ tenantId: "tenant-1", actorId: "user-1", catalog, operationKey: "debit-1" });
    const resumed = await startOrResumeManagedAICycle({ tenantId: "tenant-1", actorId: "user-1", catalog, operationKey: "debit-2" });

    expect(first.resumed).toBe(false);
    expect(resumed.resumed).toBe(true);
    expect(mocks.consume).toHaveBeenCalledTimes(1);
  });

  it("closes the cycle after the fifth usable alteration", async () => {
    const cycle = { id: "cycle-1", tenantId: "tenant-1", actorId: "user-1", provider: "openai", model: "gpt-4o", catalogEntryId: "catalog-1", modelVersion: 7, creditCostPerCycle: 3, debitOperationKey: "debit-1", alterationCount: 4, refundedFailureCount: 0, status: "active", expiresAt: new Date(Date.now() + 10_000), lastCandidateHtml: "<p>old</p>", detectedVariables: [], sessionSummary: null };
    mocks.cycleFindFirst.mockResolvedValue(cycle);
    mocks.cycleUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...cycle, ...data, alterationCount: 5 }));

    const result = await recordManagedAICycleCandidate({ tenantId: "tenant-1", actorId: "user-1", cycleId: "cycle-1", html: "<p>new</p>", detectedVariables: [], sessionSummary: {} });

    expect(result.alterationCount).toBe(5);
    expect(result.status).toBe("exhausted");
  });

  it("records a managed-to-managed provider switch without another debit", async () => {
    const cycle = { id: "cycle-1", tenantId: "tenant-1", actorId: "user-1", provider: "openai", model: "gpt-4o", catalogEntryId: "catalog-1", modelVersion: 7, creditCostPerCycle: 3, debitOperationKey: "debit-1", alterationCount: 1, refundedFailureCount: 0, status: "active", expiresAt: new Date(Date.now() + 10_000), lastCandidateHtml: "<p>old</p>", detectedVariables: [], sessionSummary: null, switchHistory: [] };
    mocks.cycleFindFirst.mockResolvedValue(cycle);
    mocks.cycleUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...cycle, ...data }));

    const result = await startOrResumeManagedAICycle({
      tenantId: "tenant-1", actorId: "user-1", catalog: { ...catalog, provider: "opencode", model: "deepseek-v4-flash" }, operationKey: "debit-2",
    });

    expect(result.resumed).toBe(true);
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.cycleUpdate).toHaveBeenCalledWith(expect.objectContaining({
     data: expect.objectContaining({
       provider: "opencode",
       model: "deepseek-v4-flash",
       catalogEntryId: "catalog-1",
       modelVersion: 7,
       creditCostPerCycle: 3,
       switchHistory: [expect.objectContaining({ fromProvider: "openai", toProvider: "opencode" })],
     }),
    }));
  });

  it("marks an active cycle switched when moving to BYOK", async () => {
    await closeManagedAICycle({ tenantId: "tenant-1", actorId: "user-1", reason: "switched" });

    expect(mocks.cycleUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "active", tenantId: "tenant-1", actorId: "user-1" }),
      data: { status: "switched" },
    }));
  });
});

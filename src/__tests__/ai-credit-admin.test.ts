import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: { $transaction: mocks.transaction },
  withTenant: (_tenantId: string, callback: () => unknown) => callback(),
}));

import {
  applyManualAICreditOperation,
  AICreditAdminError,
} from "../lib/ai/credit-ledger";

describe("platform-admin AI credit operations", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: mocks.queryRaw,
        workspace: { findUnique: mocks.findUnique },
        aiCreditLedgerEntry: {
          findMany: mocks.findMany,
          create: mocks.create,
        },
      }),
    );
    mocks.findUnique.mockResolvedValue({ id: "tenant-1" });
    mocks.findMany.mockResolvedValue([{ quantity: 40 }]);
    mocks.create.mockResolvedValue({ id: "entry-1", pool: "promotional", quantity: 25 });
  });

  it("records a promotional grant with campaign, expiry, actor and reason", async () => {
    const expiresAt = new Date("2026-12-01T00:00:00Z");
    await applyManualAICreditOperation({
      tenantId: "tenant-1",
      actorId: "admin-1",
      operation: "grant",
      quantity: 25,
      campaign: "launch-2026",
      expiresAt,
      reason: "Launch incentive",
    });

    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        actorId: "admin-1",
        kind: "promotional_grant",
        quantity: 25,
        reason: "Launch incentive",
        expiresAt,
        metadata: { campaign: "launch-2026", source: "platform_admin" },
      }),
    }));
  });

  it("requires a reason and refuses to overdraw a pool", async () => {
    await expect(applyManualAICreditOperation({
      tenantId: "tenant-1", actorId: "admin-1", operation: "grant", quantity: 1, reason: " ", campaign: "x",
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(applyManualAICreditOperation({
      tenantId: "tenant-1", actorId: "admin-1", operation: "revoke", pool: "promotional", quantity: 41, reason: "Correction",
    })).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("writes revocations as negative immutable adjustments", async () => {
    mocks.create.mockResolvedValue({ id: "entry-2", pool: "subscription", quantity: -10 });
    const result = await applyManualAICreditOperation({
      tenantId: "tenant-1", actorId: "admin-1", operation: "revoke", pool: "subscription", quantity: 10, reason: "Support correction",
    });

    expect(result).toEqual({ id: "entry-2", pool: "subscription", quantity: -10 });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ kind: "adjustment", quantity: -10, pool: "subscription" }),
    }));
  });

  it("does not permit a manual grant in another pool", async () => {
    await expect(applyManualAICreditOperation({
      tenantId: "tenant-1", actorId: "admin-1", operation: "grant", pool: "purchased", quantity: 1, reason: "Test", campaign: "test",
    })).rejects.toBeInstanceOf(AICreditAdminError);
  });
});

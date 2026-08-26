import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: { $transaction: mocks.transaction },
  withTenant: (_tenantId: string, callback: () => unknown) => callback(),
}));

import { grantSubscriptionCredits } from "../lib/ai/credit-ledger";

describe("subscription credit grants", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: mocks.queryRaw,
        aiCreditLedgerEntry: {
          findFirst: mocks.findFirst,
          findMany: mocks.findMany,
          create: mocks.create,
        },
        workspace: { findUnique: mocks.findUnique },
      }),
    );
    mocks.queryRaw.mockResolvedValue([]);
    mocks.findFirst.mockResolvedValue(null);
    mocks.findUnique.mockResolvedValue({
      plan: { monthlyAiStudioCredits: 100, allowedModules: ["ai_studio"] },
    });
    mocks.findMany.mockResolvedValue([{ quantity: 30 }]);
    mocks.create.mockResolvedValue({});
  });

  it("expires the remaining prior subscription balance and grants once", async () => {
    const result = await grantSubscriptionCredits({ tenantId: "ws_1", invoiceId: "in_1" });

    expect(result).toEqual({ granted: true, quantity: 100 });
    expect(mocks.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        kind: "expiration",
        quantity: -30,
        operationKey: "subscription-expiration:in_1",
      }),
    }));
    expect(mocks.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({
        kind: "subscription_grant",
        quantity: 100,
        operationKey: "subscription-grant:in_1",
      }),
    }));
  });

  it("does not write a second grant when Stripe retries the invoice", async () => {
    mocks.findFirst.mockResolvedValue({ quantity: 100 });

    const result = await grantSubscriptionCredits({ tenantId: "ws_1", invoiceId: "in_1" });

    expect(result).toEqual({ granted: false, quantity: 100 });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("does not grant a plan without the AI Studio module or entitlement", async () => {
    mocks.findUnique.mockResolvedValue({
      plan: { monthlyAiStudioCredits: 100, allowedModules: ["tasks"] },
    });

    const result = await grantSubscriptionCredits({ tenantId: "ws_1", invoiceId: "in_1" });

    expect(result).toEqual({ granted: false, quantity: 0 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

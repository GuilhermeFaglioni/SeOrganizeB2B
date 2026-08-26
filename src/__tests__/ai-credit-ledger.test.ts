import { describe, expect, it } from "vitest";
import {
  allocateCreditPools,
  type CreditPoolBalance,
} from "../lib/ai/credit-ledger";
import { assertMemberCreditLimit } from "../lib/ai/member-credit-limits";

describe("AI credit ledger allocation", () => {
  it("consumes expiring pools before purchased credits", () => {
    const balances: CreditPoolBalance[] = [
      { pool: "purchased", available: 20 },
      { pool: "subscription", available: 3 },
      { pool: "promotional", available: 2 },
    ];

    expect(allocateCreditPools(balances, 4)).toEqual([
      { pool: "promotional", quantity: 2 },
      { pool: "subscription", quantity: 2 },
    ]);
  });

  it("rejects a request larger than the available balance", () => {
    expect(() => allocateCreditPools([
      { pool: "subscription", available: 1 },
      { pool: "purchased", available: 2 },
    ], 4)).toThrow("Insufficient AI Studio credits");
  });

  it("rejects non-positive consumption", () => {
    expect(() => allocateCreditPools([], 0)).toThrow("Credit quantity must be positive");
  });

  it("enforces the member limit against current-month debit usage", async () => {
    const transaction = {
      aiMemberCreditLimit: { findFirst: async () => ({ monthlyLimit: 5 }) },
      aiCreditLedgerEntry: { findMany: async () => [{ quantity: -3 }] },
    } as never;
    await expect(assertMemberCreditLimit(transaction, {
      tenantId: "tenant-1", profileId: "member-1", quantity: 3, now: new Date("2026-08-26T12:00:00Z"),
    })).rejects.toThrow("Monthly AI credit limit reached");
  });

  it("does not limit members without a configured limit", async () => {
    const transaction = {
      aiMemberCreditLimit: { findFirst: async () => null },
      aiCreditLedgerEntry: { findMany: async () => [] },
    } as never;
    await expect(assertMemberCreditLimit(transaction, {
      tenantId: "tenant-1", profileId: "member-1", quantity: 100, now: new Date(),
    })).resolves.toBeUndefined();
  });
});

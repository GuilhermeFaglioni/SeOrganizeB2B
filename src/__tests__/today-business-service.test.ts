import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { toDecimal } from "../lib/financial/money";

const { mockTx, mockExtendRecurringHorizons } = vi.hoisted(() => {
  const mockTx = {
    contract: { findMany: vi.fn() },
    installment: { findMany: vi.fn() },
    proposal: { count: vi.fn() },
    task: { count: vi.fn() },
  };
  return {
    mockTx,
    mockExtendRecurringHorizons: vi.fn(),
  };
});

vi.mock("../../prisma/client", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
  },
}));

vi.mock("../../src/lib/financial/installments-service", () => ({
  extendRecurringHorizons: mockExtendRecurringHorizons,
}));

import { computeTodayBusiness } from "../lib/financial/today-business-service";

describe("computeTodayBusiness", () => {
  beforeEach(() => {
    mockExtendRecurringHorizons.mockReset();
    mockTx.contract.findMany.mockReset();
    mockTx.installment.findMany.mockReset();
    mockTx.proposal.count.mockReset();
    mockTx.task.count.mockReset();
    mockExtendRecurringHorizons.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeroed values when there is no data", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.proposal.count.mockResolvedValue(0);
    mockTx.task.count.mockResolvedValue(0);

    const result = await computeTodayBusiness();

    expect(result.receivablesThisWeek).toBe("0.00");
    expect(result.openProposals).toBe(0);
    expect(result.expiringContracts).toBe(0);
    expect(result.overdueTasks).toBe(0);
  });

  it("calls extendRecurringHorizons before querying", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.proposal.count.mockResolvedValue(0);
    mockTx.task.count.mockResolvedValue(0);

    await computeTodayBusiness();

    expect(mockExtendRecurringHorizons).toHaveBeenCalledOnce();
  });

  it("sums pending installments due this week for receivablesThisWeek", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    // Prisma query already filters status: 'pending' — mock returns only matching rows
    mockTx.installment.findMany.mockResolvedValue([
      { expectedAmount: toDecimal("500.00"), dueDate: "2026-08-14" },
      { expectedAmount: toDecimal("300.00"), dueDate: "2026-08-15" },
    ]);
    mockTx.proposal.count.mockResolvedValue(0);
    mockTx.task.count.mockResolvedValue(0);

    const result = await computeTodayBusiness();

    expect(result.receivablesThisWeek).toBe("800.00");
  });

  it("counts open proposals (draft + sent + viewed)", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.proposal.count.mockResolvedValue(5);
    mockTx.task.count.mockResolvedValue(0);

    const result = await computeTodayBusiness();

    expect(result.openProposals).toBe(5);
  });

  it("counts active fixed contracts expiring within 30 days", async () => {
    // Prisma query filters status: 'active' — mock returns only matching rows
    mockTx.contract.findMany.mockResolvedValue([
      {
        id: "ctr-1",
        status: "active",
        durationType: "fixed",
        endDate: "2026-09-10",
        client: { name: "Acme" },
      },
      {
        id: "ctr-2",
        status: "active",
        durationType: "fixed",
        endDate: "2027-12-31",
        client: { name: "Beta" },
      },
    ]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.proposal.count.mockResolvedValue(0);
    mockTx.task.count.mockResolvedValue(0);

    const result = await computeTodayBusiness();

    // Only ctr-1 is active+fixed+expiring within 30 days
    expect(result.expiringContracts).toBe(1);
  });

  it("counts overdue tasks", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.proposal.count.mockResolvedValue(0);
    mockTx.task.count.mockResolvedValue(3);

    const result = await computeTodayBusiness();

    expect(result.overdueTasks).toBe(3);
  });
});

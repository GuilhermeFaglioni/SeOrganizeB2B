import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { toDecimal, moneyToJson } from "../lib/financial/money";
import { addDaysCivil, todayCivilDate } from "../lib/financial/civil-date";

const { mockTx, mockExtendRecurringHorizons } = vi.hoisted(() => {
  const mockTx = {
    contract: {
      findMany: vi.fn(),
    },
    installment: {
      findMany: vi.fn(),
    },
    contractChange: {
      findMany: vi.fn(),
    },
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

import { computeOverview } from "../lib/financial/overview-service";

const activeContract = {
  id: "ctr-1",
  code: "CTR-2026-0001",
  title: "Active Contract",
  status: "active",
  durationType: "fixed",
  officialValue: toDecimal("12000.00"),
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  billingFrequency: "monthly",
  paymentMethod: "pix",
  clientId: "client-1",
  client: { id: "client-1", name: "Acme Corp" },
};

const draftContract = {
  id: "ctr-2",
  code: "CTR-2026-0002",
  title: "Draft Contract",
  status: "draft",
  durationType: "openEnded",
  officialValue: toDecimal("500.00"),
  startDate: "2026-08-01",
  endDate: null,
  billingFrequency: "monthly",
  paymentMethod: "pix",
  clientId: "client-2",
  client: { id: "client-2", name: "Beta Inc" },
};

const pendingInstallment = {
  id: "inst-1",
  contractId: "ctr-1",
  expectedAmount: toDecimal("1000.00"),
  dueDate: "2026-08-15",
  status: "pending",
  paidAt: null,
  cycleKey: "2026-08",
};

const paidInstallment = {
  id: "inst-2",
  contractId: "ctr-1",
  expectedAmount: toDecimal("1000.00"),
  dueDate: "2026-07-01",
  status: "paid",
  paidAt: "2026-07-05",
  cycleKey: "2026-07",
};

const overdueInstallment = {
  id: "inst-3",
  contractId: "ctr-1",
  expectedAmount: toDecimal("1000.00"),
  dueDate: "2026-06-01",
  status: "pending",
  paidAt: null,
  cycleKey: "2026-06",
};

const upsellChange = {
  id: "ch-1",
  contractId: "ctr-1",
  type: "upsell",
  delta: toDecimal("500.00"),
  effectiveDate: "2026-08-10",
};

const downsellChange = {
  id: "ch-2",
  contractId: "ctr-1",
  type: "downsell",
  delta: toDecimal("200.00"),
  effectiveDate: "2026-08-20",
};

describe("computeOverview service", () => {
  beforeEach(() => {
    mockExtendRecurringHorizons.mockReset();
    mockTx.contract.findMany.mockReset();
    mockTx.installment.findMany.mockReset();
    mockTx.contractChange.findMany.mockReset();
    mockExtendRecurringHorizons.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls extendRecurringHorizons before querying data", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    await computeOverview({ period: "currentMonth" });

    expect(mockExtendRecurringHorizons).toHaveBeenCalledOnce();
  });

  it("returns zeroed KPIs when there are no contracts or installments", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    expect(result.kpis.activeContractedValue).toBe("0.00");
    expect(result.kpis.mrr).toBe("0.00");
    expect(result.kpis.arr).toBe("0.00");
    expect(result.kpis.cashForecast).toBe("0.00");
    expect(result.kpis.received).toBe("0.00");
    expect(result.kpis.overdue).toBe("0.00");
    expect(result.kpis.upsell).toBe("0.00");
    expect(result.kpis.downsell).toBe("0.00");
    expect(result.kpis.activeContracts).toBe(0);
    expect(result.kpis.expiringSoon).toBe(0);
    expect(result.monthly).toHaveLength(1);
    expect(result.monthly[0].forecast).toBe("0.00");
    expect(result.monthly[0].received).toBe("0.00");
    expect(result.overdueInstallments).toEqual([]);
    expect(result.expiringContracts).toEqual([]);
  });

  it("computes activeContractedValue only for active fixed/oneTime contracts", async () => {
    mockTx.contract.findMany.mockResolvedValue([activeContract, draftContract]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    expect(result.kpis.activeContractedValue).toBe("12000.00");
    expect(result.kpis.activeContracts).toBe(1);
  });

  it("computes MRR and ARR for active contracts", async () => {
    mockTx.contract.findMany.mockResolvedValue([activeContract]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    // fixed 12000 over 12 months = 1000/mo MRR, 12000/yr ARR
    expect(result.kpis.mrr).toBe("1000.00");
    expect(result.kpis.arr).toBe("12000.00");
  });

  it("computes cash forecast for non-cancelled installments in the period", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([pendingInstallment]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    // pendingInstallment dueDate 2026-08-15 is in currentMonth (2026-08-01 to 2026-08-31)
    expect(result.kpis.cashForecast).toBe("1000.00");
  });

  it("computes received for paid installments paidAt within the period", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([paidInstallment]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    // paidInstallment paidAt 2026-07-05 is NOT in currentMonth (2026-08-01 to 2026-08-31)
    expect(result.kpis.received).toBe("0.00");
  });

  it("computes overdue for pending installments due before today", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([overdueInstallment]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    expect(result.kpis.overdue).toBe("1000.00");
    expect(result.overdueInstallments).toHaveLength(1);
    expect(result.overdueInstallments[0].id).toBe("inst-3");
  });

  it("computes upsell and downsell from contract changes in the period", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([upsellChange, downsellChange]);

    const result = await computeOverview({ period: "currentMonth" });

    expect(result.kpis.upsell).toBe("500.00");
    expect(result.kpis.downsell).toBe("200.00");
  });

  it("builds monthly series with forecast and received per month", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([
      pendingInstallment,
      paidInstallment,
    ]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    // currentMonth = 2026-08-01 to 2026-08-31
    expect(result.monthly).toHaveLength(1);
    expect(result.monthly[0].month).toBe("2026-08");
    expect(result.monthly[0].forecast).toBe("1000.00");
    expect(result.monthly[0].received).toBe("0.00");
  });

  it("includes overdueInstallments with correct shape", async () => {
    mockTx.contract.findMany.mockResolvedValue([activeContract]);
    mockTx.installment.findMany.mockResolvedValue([overdueInstallment]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    expect(result.overdueInstallments).toHaveLength(1);
    const item = result.overdueInstallments[0];
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("contractCode");
    expect(item).toHaveProperty("contractTitle");
    expect(item).toHaveProperty("clientName");
    expect(item).toHaveProperty("expectedAmount");
    expect(item).toHaveProperty("dueDate");
    expect(item.contractCode).toBe("CTR-2026-0001");
    expect(item.contractTitle).toBe("Active Contract");
    expect(item.clientName).toBe("Acme Corp");
    expect(item.expectedAmount).toBe("1000.00");
  });

  it("limits overdueInstallments to 10 entries", async () => {
    const manyOverdue = Array.from({ length: 15 }, (_, i) => ({
      id: `inst-${i}`,
      contractId: "ctr-1",
      expectedAmount: toDecimal("100.00"),
      dueDate: `2026-06-${String(i + 1).padStart(2, "0")}`,
      status: "pending",
      paidAt: null,
      cycleKey: `2026-06`,
    }));

    mockTx.contract.findMany.mockResolvedValue([activeContract]);
    mockTx.installment.findMany.mockResolvedValue(manyOverdue);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    expect(result.overdueInstallments).toHaveLength(10);
  });

  it("detects expiring contracts within 30 days", async () => {
    const expiringContract = {
      ...activeContract,
      endDate: addDaysCivil(todayCivilDate(), 3),
    };

    mockTx.contract.findMany.mockResolvedValue([expiringContract]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    expect(result.kpis.expiringSoon).toBe(1);
    expect(result.expiringContracts).toHaveLength(1);
    expect(result.expiringContracts[0].code).toBe("CTR-2026-0001");
  });

  it("limits expiringContracts to 10 entries", async () => {
    const manyExpiring = Array.from({ length: 15 }, (_, i) => ({
      ...activeContract,
      id: `ctr-${i}`,
      code: `CTR-${i}`,
      endDate: addDaysCivil(todayCivilDate(), i),
    }));

    mockTx.contract.findMany.mockResolvedValue(manyExpiring);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    expect(result.expiringContracts).toHaveLength(10);
  });

  it("passes clientId filter to prisma queries", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    await computeOverview({ period: "currentMonth", clientId: "c-1" });

    const contractWhere = mockTx.contract.findMany.mock.calls[0][0].where;
    expect(contractWhere.clientId).toBe("c-1");
  });

  it("passes contractStatus filter to prisma queries", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    await computeOverview({ period: "currentMonth", contractStatus: "active" });

    const contractWhere = mockTx.contract.findMany.mock.calls[0][0].where;
    expect(contractWhere.status).toBe("active");
  });

  it("passes projectId filter via nested some", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    await computeOverview({ period: "currentMonth", projectId: "p-1" });

    const contractWhere = mockTx.contract.findMany.mock.calls[0][0].where;
    expect(contractWhere.projects).toEqual({ some: { projectId: "p-1" } });
  });

  it("passes installmentStatus filter to installment query", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    await computeOverview({
      period: "currentMonth",
      installmentStatus: "pending",
    });

    const installmentWhere = mockTx.installment.findMany.mock.calls[0][0].where;
    expect(installmentWhere.status).toBe("pending");
  });

  it("uses custom from/to dates when period is custom", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({
      period: "custom",
      from: "2026-06-01",
      to: "2026-09-30",
    });

    expect(result.kpis).toBeDefined();
    expect(mockTx.contract.findMany).toHaveBeenCalled();
  });

  it("returns distinct contractedRevenue vs cashForecast", async () => {
    mockTx.contract.findMany.mockResolvedValue([activeContract]);
    mockTx.installment.findMany.mockResolvedValue([pendingInstallment]);
    mockTx.contractChange.findMany.mockResolvedValue([]);

    const result = await computeOverview({ period: "currentMonth" });

    // activeContractedValue = 12000 (active fixed contract officialValue)
    // cashForecast = 1000 (pending installment in currentMonth)
    expect(result.kpis.activeContractedValue).toBe("12000.00");
    expect(result.kpis.cashForecast).toBe("1000.00");
    expect(result.kpis.activeContractedValue).not.toBe(result.kpis.cashForecast);
  });

  it("returns net expansion as upsell minus downsell", async () => {
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.installment.findMany.mockResolvedValue([]);
    mockTx.contractChange.findMany.mockResolvedValue([upsellChange, downsellChange]);

    const result = await computeOverview({ period: "currentMonth" });

    // upsell=500, downsell=200, net=300
    const upsell = toDecimal(result.kpis.upsell);
    const downsell = toDecimal(result.kpis.downsell);
    const net = upsell.minus(downsell);
    expect(moneyToJson(net)).toBe("300.00");
  });
});

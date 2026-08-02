import { describe, expect, it } from "vitest";
import {
  monthlyValue,
  mrrForContract,
  arrForContract,
  forecastTotal,
  receivedTotal,
  overdueTotal,
  groupMonthly,
  isExpiringSoon,
  activeContractedValue,
  sumChangeDeltas,
} from "../lib/financial/metrics";
import { toDecimal, moneyToJson } from "../lib/financial/money";

const contract = (
  durationType: string,
  officialValue: string,
  startDate: string,
  endDate: string | null,
  billingFrequency: string | null
) => ({
  officialValue: toDecimal(officialValue),
  durationType,
  startDate,
  endDate,
  billingFrequency,
});

describe("MRR and ARR", () => {
  it("normalizes every recurring frequency", () => {
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "monthly"))).toBe("1200.00");
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "quarterly"))).toBe("400.00");
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "semiannual"))).toBe("200.00");
    expect(moneyToJson(monthlyValue(toDecimal("1200.00"), "annual"))).toBe("100.00");
  });

  it("computes MRR and ARR for open-ended recurring contracts", () => {
    const openEnded = contract("openEnded", "1200.00", "2026-08-02", null, "monthly");
    expect(moneyToJson(mrrForContract(openEnded)!)).toBe("1200.00");
    expect(moneyToJson(arrForContract(openEnded)!)).toBe("14400.00");
  });

  it("computes fixed-term MRR from the term and returns null for one-time", () => {
    const fixed = contract("fixed", "12000.00", "2026-01-01", "2026-12-01", "monthly");
    expect(moneyToJson(mrrForContract(fixed)!)).toBe("1000.00");
    const oneTime = contract("oneTime", "5000.00", "2026-08-02", null, null);
    expect(mrrForContract(oneTime)).toBeNull();
  });
});

describe("forecast, received and overdue", () => {
  const installments = [
    { status: "pending", expectedAmount: toDecimal("1000"), dueDate: "2026-08-15", paidAt: null },
    { status: "paid", expectedAmount: toDecimal("500"), dueDate: "2026-08-01", paidAt: "2026-08-02" },
    { status: "cancelled", expectedAmount: toDecimal("700"), dueDate: "2026-09-01", paidAt: null },
    { status: "pending", expectedAmount: toDecimal("300"), dueDate: "2026-07-31", paidAt: null },
  ];

  it("groups non-cancelled forecast and received by month boundaries", () => {
    expect(moneyToJson(forecastTotal(installments, "2026-08-01", "2026-08-31"))).toBe("1500.00");
    expect(moneyToJson(receivedTotal(installments, "2026-08-01", "2026-08-31"))).toBe("500.00");
  });

  it("derives overdue from pending installments due before today", () => {
    expect(moneyToJson(overdueTotal(installments, "2026-08-02"))).toBe("300.00");
  });

  it("builds monthly chart points for the selected range", () => {
    const points = groupMonthly(installments, "2026-08-01", "2026-09-30");
    expect(points.map((p) => p.month)).toEqual(["2026-08", "2026-09"]);
    expect(moneyToJson(points[0].forecast)).toBe("1500.00");
    expect(moneyToJson(points[0].received)).toBe("500.00");
    expect(moneyToJson(points[1].forecast)).toBe("0.00");
  });
});

describe("contract metrics", () => {
  it("detects expiring contracts within the next 30 days", () => {
    expect(isExpiringSoon("2026-08-20", "2026-08-02")).toBe(true);
    expect(isExpiringSoon("2026-10-01", "2026-08-02")).toBe(false);
    expect(isExpiringSoon("2026-08-01", "2026-08-02")).toBe(false);
  });

  it("sums only active fixed and one-time official values", () => {
    const contracts = [
      { status: "active", durationType: "fixed", officialValue: toDecimal("1000") },
      { status: "active", durationType: "openEnded", officialValue: toDecimal("2000") },
      { status: "closed", durationType: "fixed", officialValue: toDecimal("3000") },
    ];
    expect(moneyToJson(activeContractedValue(contracts))).toBe("1000.00");
  });

  it("separates upsell and downsell sums by effective date", () => {
    const changes = [
      { type: "upsell", delta: toDecimal("500"), effectiveDate: "2026-08-10" },
      { type: "downsell", delta: toDecimal("200"), effectiveDate: "2026-08-15" },
      { type: "upsell", delta: toDecimal("100"), effectiveDate: "2026-09-01" },
    ];
    expect(moneyToJson(sumChangeDeltas(changes, "upsell", "2026-08-01", "2026-08-31"))).toBe("500.00");
    expect(moneyToJson(sumChangeDeltas(changes, "downsell", "2026-08-01", "2026-08-31"))).toBe("200.00");
  });
});

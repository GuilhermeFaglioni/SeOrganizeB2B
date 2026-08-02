import { describe, expect, it } from "vitest";
import { contractCode } from "../lib/financial/contract-code";
import {
  installmentCount,
  splitEqualInstallments,
  suggestFinitePlan,
  sumPlan,
  validateFinitePlan,
  recurringPlanForHorizon,
  suggestPlan,
} from "../lib/financial/installments";
import { toDecimal, eq, moneyToJson } from "../lib/financial/money";

describe("contract code", () => {
  it("formats CTR-YYYY-NNNN", () => {
    expect(contractCode(2026, 1)).toBe("CTR-2026-0001");
    expect(contractCode(2026, 9999)).toBe("CTR-2026-9999");
  });
});

describe("equal installment split", () => {
  it("splits evenly and puts the cent remainder in the final installment", () => {
    const parts = splitEqualInstallments(toDecimal("100.00"), 3);
    expect(parts.map(moneyToJson)).toEqual(["33.33", "33.33", "33.34"]);
  });

  it("handles exact division", () => {
    const parts = splitEqualInstallments(toDecimal("99.00"), 3);
    expect(parts.map(moneyToJson)).toEqual(["33.00", "33.00", "33.00"]);
  });

  it("guards against a zero count", () => {
    expect(splitEqualInstallments(toDecimal("100"), 0)).toEqual([]);
  });
});

describe("finite plans", () => {
  it("counts monthly, quarterly, semiannual and annual periods", () => {
    expect(installmentCount("2026-01-01", "2026-12-01", "monthly")).toBe(12);
    expect(installmentCount("2026-01-01", "2026-12-01", "quarterly")).toBe(4);
    expect(installmentCount("2026-01-01", "2026-12-01", "semiannual")).toBe(2);
    expect(installmentCount("2026-01-01", "2026-12-01", "annual")).toBe(1);
  });

  it("suggests a plan whose total equals the official value", () => {
    const plan = suggestFinitePlan(
      toDecimal("1200.00"),
      "2026-01-01",
      "2026-12-01",
      "monthly",
      "pix"
    );
    expect(plan).toHaveLength(12);
    expect(eq(sumPlan(plan), toDecimal("1200.00"))).toBe(true);
    expect(plan[0].dueDate).toBe("2026-01-01");
    expect(plan[0].paymentMethod).toBe("pix");
  });

  it("validates exact sums for finite contracts", () => {
    const plan = suggestFinitePlan(
      toDecimal("1200.00"),
      "2026-01-01",
      "2026-12-01",
      "monthly",
      "pix"
    );
    plan[0] = { ...plan[0], expectedAmount: "99.00" };
    expect(validateFinitePlan(plan, toDecimal("1200.00"))).not.toHaveLength(0);
    expect(
      validateFinitePlan([], toDecimal("1200.00"))
    ).toContain("At least one installment is required");
  });
});

describe("recurring horizon", () => {
  it("builds a rolling window without duplicate cycle keys", () => {
    const plan = recurringPlanForHorizon(
      "2026-08-02",
      toDecimal("500.00"),
      0,
      3,
      "boleto"
    );
    expect(plan).toHaveLength(4);
    expect(plan[0].cycleKey).toBe("2026-08");
    expect(plan[1].cycleKey).toBe("2026-09");
    expect(plan[3].expectedAmount).toBe("500.00");
    expect(new Set(plan.map((p) => p.cycleKey)).size).toBe(4);
  });

  it("suggests a single installment for one-time contracts", () => {
    const plan = suggestPlan(
      toDecimal("3000.00"),
      "oneTime",
      "2026-08-02",
      null,
      null,
      "pix"
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].dueDate).toBe("2026-08-02");
  });
});

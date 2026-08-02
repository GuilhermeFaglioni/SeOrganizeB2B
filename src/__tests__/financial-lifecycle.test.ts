import { describe, expect, it } from "vitest";
import {
  FinancialConflictError,
  activationErrors,
  transition,
  cancellationPlan,
  renewablePredecessor,
} from "../lib/financial/lifecycle";
import {
  redistributeDelta,
  validateDownsell,
  validateRedistributedPlan,
  adjustmentPlanItem,
} from "../lib/financial/changes";
import { toDecimal, moneyToJson, isNegative } from "../lib/financial/money";

const draftContract = {
  clientId: "client-1",
  title: "Engagement",
  durationType: "fixed",
  officialValue: toDecimal("1200.00"),
  startDate: "2026-01-01",
  endDate: "2026-12-01",
  billingFrequency: "monthly",
  status: "draft",
} as const;

describe("transitions", () => {
  it("applies the documented lifecycle", () => {
    expect(transition("draft", "activate")).toBe("active");
    expect(transition("active", "suspend")).toBe("suspended");
    expect(transition("suspended", "resume")).toBe("active");
    expect(transition("active", "close")).toBe("closed");
    expect(transition("active", "cancel")).toBe("cancelled");
  });

  it("rejects invalid transitions with a conflict error", () => {
    expect(() => transition("closed", "activate")).toThrow(FinancialConflictError);
    expect(() => transition("cancelled", "resume")).toThrow(FinancialConflictError);
  });
});

describe("activation rules", () => {
  it("accepts a complete fixed contract with a matching plan", () => {
    const plan = [
      { expectedAmount: "100.00", dueDate: "2026-01-01", paymentMethod: "pix" as const },
      { expectedAmount: "100.00", dueDate: "2026-02-01", paymentMethod: "pix" as const },
    ];
    const errors = activationErrors({ ...draftContract, officialValue: toDecimal("200.00") }, plan);
    expect(errors).toEqual([]);
  });

  it("rejects missing fields and inconsistent dates", () => {
    const errors = activationErrors(
      { ...draftContract, clientId: "", endDate: "2025-01-01" },
      [{ expectedAmount: "1200.00", dueDate: "2026-01-01", paymentMethod: "pix" }]
    );
    expect(errors).toContain("A client is required");
    expect(errors).toContain("End date must not precede the start date");
  });
});

describe("cancellation plan", () => {
  it("cancels only future pending installments while keeping retained ones", () => {
    const installments = [
      { id: "a", status: "pending" as const, dueDate: "2026-08-15" },
      { id: "b", status: "pending" as const, dueDate: "2026-08-05" },
      { id: "c", status: "pending" as const, dueDate: "2026-09-01" },
      { id: "d", status: "paid" as const, dueDate: "2026-10-01" },
    ];
    expect(
      cancellationPlan(installments, "2026-08-10", ["c"])
    ).toEqual(["a"]);
  });
});

describe("renewal", () => {
  it("accepts active and suspended predecessors", () => {
    expect(renewablePredecessor("active")).toBe(true);
    expect(renewablePredecessor("suspended")).toBe(true);
    expect(renewablePredecessor("closed")).toBe(false);
    expect(renewablePredecessor("cancelled")).toBe(false);
  });
});

describe("upsell and downsell", () => {
  const pending = [
    { id: "1", expectedAmount: toDecimal("100.00") },
    { id: "2", expectedAmount: toDecimal("100.00") },
    { id: "3", expectedAmount: toDecimal("100.00") },
  ];

  it("redistributes an upsell delta across pending installments", () => {
    const adjusted = redistributeDelta(pending, toDecimal("30.00"), "upsell");
    expect(adjusted.map((a) => moneyToJson(a.expectedAmount))).toEqual([
      "110.00",
      "110.00",
      "110.00",
    ]);
  });

  it("redistributes a downsell delta proportionally", () => {
    const adjusted = redistributeDelta(pending, toDecimal("3.00"), "downsell");
    expect(adjusted.map((a) => moneyToJson(a.expectedAmount))).toEqual([
      "99.00",
      "99.00",
      "99.00",
    ]);
  });

  it("rejects invalid downsells and negative redistributions", () => {
    expect(validateDownsell(toDecimal("100.00"), toDecimal("150.00"))).toContain(
      "Downsell cannot make the contract value negative"
    );
    const plan = [
      { id: "x", expectedAmount: toDecimal("0.50") },
      { id: "y", expectedAmount: toDecimal("0.50") },
    ];
    const bad = redistributeDelta(plan, toDecimal("3.00"), "downsell");
    expect(validateRedistributedPlan(bad)).not.toHaveLength(0);
    expect(bad.some((b) => isNegative(b.expectedAmount))).toBe(true);
  });

  it("builds a negative adjustment item for downsell", () => {
    const item = adjustmentPlanItem(
      "downsell",
      toDecimal("200.00"),
      "2026-08-15",
      "pix"
    );
    expect(moneyToJson(toDecimal(item.expectedAmount))).toBe("-200.00");
    expect(item.dueDate).toBe("2026-08-15");
  });
});

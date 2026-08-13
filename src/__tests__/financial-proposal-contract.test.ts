import { describe, expect, it } from "vitest";
import { activationErrors } from "../lib/financial/lifecycle";
import { toDecimal } from "../lib/financial/money";
import { suggestFinitePlan, sumPlan } from "../lib/financial/installments";

describe("accepted proposal contract confirmation", () => {
  it("keeps the official proposal value as the activation invariant", () => {
    const errors = activationErrors(
      {
        clientId: "client-1",
        title: "Implantação",
        durationType: "fixed",
        officialValue: toDecimal("1200.00"),
        startDate: "2026-08-13",
        endDate: "2026-10-13",
        billingFrequency: "monthly",
      },
      [
        { expectedAmount: "600.00", dueDate: "2026-08-13", paymentMethod: "pix" },
        { expectedAmount: "600.00", dueDate: "2026-09-13", paymentMethod: "pix" },
      ]
    );
    expect(errors).toEqual([]);
  });

  it("rejects confirmation when installments do not sum to the proposal value", () => {
    const errors = activationErrors(
      {
        clientId: "client-1",
        title: "Implantação",
        durationType: "fixed",
        officialValue: toDecimal("1200.00"),
        startDate: "2026-08-13",
        endDate: "2026-10-13",
        billingFrequency: "monthly",
      },
      [{ expectedAmount: "1199.99", dueDate: "2026-08-13", paymentMethod: "pix" }]
    );
    expect(errors.some((error) => error.toLowerCase().includes("equal"))).toBe(true);
  });

  it("generates equal installments and puts the cent remainder in the last one", () => {
    const plan = suggestFinitePlan(
      toDecimal("100.00"),
      "2026-08-13",
      "2026-10-13",
      "monthly",
      "pix"
    );

    expect(plan.map((item) => item.expectedAmount)).toEqual(["33.33", "33.33", "33.34"]);
    expect(sumPlan(plan).toFixed(2)).toBe("100.00");
  });
});

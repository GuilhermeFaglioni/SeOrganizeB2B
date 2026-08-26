import { describe, expect, it } from "vitest";
import { refundableCreditQuantity } from "../lib/ai/credit-packages";

describe("AI credit package refunds", () => {
  it("revokes only unused credits proportionally", () => {
    expect(refundableCreditQuantity({ packageCredits: 100, packageAmountCents: 1000, refundAmountCents: 500, unusedCredits: 30 })).toBe(30);
    expect(refundableCreditQuantity({ packageCredits: 100, packageAmountCents: 1000, refundAmountCents: 500, unusedCredits: 80 })).toBe(50);
  });

  it("never produces a negative balance", () => {
    expect(refundableCreditQuantity({ packageCredits: 10, packageAmountCents: 100, refundAmountCents: 100, unusedCredits: 0 })).toBe(0);
  });
});

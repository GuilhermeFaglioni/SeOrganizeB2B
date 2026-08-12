import { describe, expect, it } from "vitest";
import { paymentIntentStatusToCheckoutStatus } from "../lib/stripe-return-status";

describe("paymentIntentStatusToCheckoutStatus", () => {
  it("treats a succeeded payment intent as complete", () => {
    expect(paymentIntentStatusToCheckoutStatus("succeeded")).toBe("complete");
  });

  it("treats a processing payment intent as complete", () => {
    expect(paymentIntentStatusToCheckoutStatus("processing")).toBe("complete");
  });

  it("preserves a non-success status", () => {
    expect(paymentIntentStatusToCheckoutStatus("requires_payment_method")).toBe(
      "requires_payment_method"
    );
  });

  it("returns null for a missing status", () => {
    expect(paymentIntentStatusToCheckoutStatus(null)).toBeNull();
  });
});

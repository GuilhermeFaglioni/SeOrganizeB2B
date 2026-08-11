import { afterEach, describe, expect, it, vi } from "vitest";

const STRIPE_API_VERSION = "2024-12-18.acacia";

describe("stripe client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a Stripe singleton pinned to the configured API version", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.resetModules();

    const { default: Stripe } = await import("stripe");
    const { stripe } = await import("../lib/stripe");

    expect(stripe).toBeInstanceOf(Stripe);
    expect(stripe.getApiField("version")).toBe(STRIPE_API_VERSION);
    expect(stripe.getApiField("version")).toBe("2024-12-18.acacia");
  });

  it("throws a clear error when STRIPE_SECRET_KEY is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.resetModules();

    await expect(import("../lib/stripe")).rejects.toThrow(
      "STRIPE_SECRET_KEY is not set",
    );
  });
});

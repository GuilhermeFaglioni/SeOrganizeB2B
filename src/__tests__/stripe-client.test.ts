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
    const { getStripe } = await import("../lib/stripe");

    const client = getStripe();
    expect(client).toBeInstanceOf(Stripe);
    expect(client.getApiField("version")).toBe(STRIPE_API_VERSION);
    expect(client.getApiField("version")).toBe("2024-12-18.acacia");
  });

  it("reuses the same singleton across calls", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.resetModules();

    const { getStripe } = await import("../lib/stripe");

    expect(getStripe()).toBe(getStripe());
  });

  it("throws a clear error when STRIPE_SECRET_KEY is missing at first use", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.resetModules();

    const { getStripe } = await import("../lib/stripe");

    expect(() => getStripe()).toThrow("STRIPE_SECRET_KEY is not set");
  });

  it("exports a lazy stripe proxy that initializes on property access", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.resetModules();

    const { stripe } = await import("../lib/stripe");

    expect(stripe).toBeDefined();
    // Accessing a property triggers lazy initialization against the client.
    expect(typeof stripe.checkout).toBe("object");
  });
});
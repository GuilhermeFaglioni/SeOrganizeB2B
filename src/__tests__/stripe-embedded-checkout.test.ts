import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockRetrievePrice: vi.fn(),
  mockCreateCustomer: vi.fn(),
  mockCreateSubscription: vi.fn(),
  mockPlanFindFirst: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    prices: { retrieve: mocks.mockRetrievePrice },
    customers: { create: mocks.mockCreateCustomer },
    subscriptions: { create: mocks.mockCreateSubscription },
  },
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    plan: { findFirst: mocks.mockPlanFindFirst },
  },
}));

import { POST } from "../app/api/stripe/embedded-checkout/route";

const makeRequest = (body?: unknown) =>
  new NextRequest("http://x/api/stripe/embedded-checkout", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const makePlan = () => ({
  id: "plan_pro",
  name: "Pro",
  stripePriceId: "price_pro",
  isActive: true,
});

describe("stripe test checkout", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockPlanFindFirst.mockResolvedValue(makePlan());
    mocks.mockRetrievePrice.mockResolvedValue({
      active: true,
      type: "recurring",
    });
    mocks.mockCreateCustomer.mockResolvedValue({ id: "cus_123" });
    mocks.mockCreateSubscription.mockResolvedValue({
      id: "sub_123",
      latest_invoice: {
        payment_intent: {
          id: "pi_123",
          client_secret: "pi_123_secret_key",
        },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for a missing priceId", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.mockCreateSubscription).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid priceId", async () => {
    mocks.mockPlanFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ priceId: "price_unknown" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.mockPlanFindFirst).toHaveBeenCalledWith({
      where: { stripePriceId: "price_unknown", isActive: true },
    });
    expect(mocks.mockCreateSubscription).not.toHaveBeenCalled();
  });

  it("creates a subscription and returns the client secret", async () => {
    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.clientSecret).toBe("pi_123_secret_key");
    expect(json.data.subscriptionId).toBe("sub_123");
    expect(mocks.mockRetrievePrice).toHaveBeenCalledWith("price_pro");
    expect(mocks.mockCreateCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { source: "test-landing", planId: "plan_pro" },
      })
    );
    expect(mocks.mockCreateSubscription).toHaveBeenCalledWith({
      customer: "cus_123",
      items: [{ price: "price_pro" }],
      expand: ["latest_invoice.payment_intent"],
    });
  });

  it("returns 400 for a non-recurring price", async () => {
    mocks.mockRetrievePrice.mockResolvedValue({
      active: true,
      type: "one_time",
    });

    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.mockCreateSubscription).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
  mockPlanFindFirst: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: { sessions: { create: mocks.mockCreateSession } },
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

describe("stripe embedded checkout", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockPlanFindFirst.mockResolvedValue(makePlan());
    mocks.mockCreateSession.mockResolvedValue({
      id: "cs_1",
      client_secret: "cs_test_secret",
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
    expect(mocks.mockCreateSession).not.toHaveBeenCalled();
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
    expect(mocks.mockCreateSession).not.toHaveBeenCalled();
  });

  it("creates an embedded checkout session and returns the client secret", async () => {
    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.clientSecret).toBe("cs_test_secret");
    expect(mocks.mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        ui_mode: "embedded_page",
        mode: "subscription",
        line_items: [{ price: "price_pro", quantity: 1 }],
        customer_creation: "always",
        return_url:
          "http://x/test-checkout/return?session_id={CHECKOUT_SESSION_ID}",
        metadata: { source: "test-landing", planId: "plan_pro" },
      })
    );
  });
});

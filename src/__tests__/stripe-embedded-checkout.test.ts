import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateCustomer: vi.fn(),
  mockCreateSubscription: vi.fn(),
  mockPlanFindFirst: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockWorkspaceUpdate: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: mocks.mockCreateCustomer },
    subscriptions: { create: mocks.mockCreateSubscription },
  },
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    plan: { findFirst: mocks.mockPlanFindFirst },
    profile: { findUnique: mocks.mockProfileFindUnique },
    workspace: { update: mocks.mockWorkspaceUpdate },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

import { POST } from "../app/api/stripe/embedded-checkout/route";

const makeRequest = (body?: unknown) =>
  new NextRequest("http://x/api/stripe/embedded-checkout", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const makeUser = () => ({ id: "user_1", email: "owner@acme.com" });

const makePlan = () => ({
  id: "plan_pro",
  name: "Pro",
  stripePriceId: "price_pro",
  isActive: true,
});

const makeProfile = (stripeCustomerId: string | null = null) => ({
  id: "user_1",
  tenant: {
    id: "ws_1",
    name: "Acme",
    slug: "acme",
    stripeCustomerId,
    planId: null,
    status: "active",
  },
});

const makeSubscription = (clientSecret?: string) => ({
  id: "sub_123",
  latest_invoice: clientSecret
    ? { payment_intent: { id: "pi_123", client_secret: clientSecret } }
    : { payment_intent: null },
});

describe("stripe embedded checkout", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockGetUser.mockResolvedValue(makeUser());
    mocks.mockProfileFindUnique.mockResolvedValue(makeProfile());
    mocks.mockPlanFindFirst.mockResolvedValue(makePlan());
    mocks.mockCreateCustomer.mockResolvedValue({ id: "cus_123" });
    mocks.mockCreateSubscription.mockResolvedValue(
      makeSubscription("pi_123_secret_key")
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.mockGetUser.mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("AUTH_ERROR");
    expect(mocks.mockCreateSubscription).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing priceId", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.mockCreateSubscription).not.toHaveBeenCalled();
  });

  it("rejects a product id (prod_) without calling Stripe", async () => {
    const res = await POST(makeRequest({ priceId: "prod_V3irzGGHYnnfI5" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(json.error.message).toMatch(/price_/i);
    expect(mocks.mockPlanFindFirst).not.toHaveBeenCalled();
    expect(mocks.mockCreateSubscription).not.toHaveBeenCalled();
  });

  it("returns 400 for a price with no matching active plan", async () => {
    mocks.mockPlanFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ priceId: "price_unknown" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.mockCreateSubscription).not.toHaveBeenCalled();
  });

  it("returns 400 when the user has no workspace", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.mockCreateSubscription).not.toHaveBeenCalled();
  });

  it("creates a customer, saves it on the workspace, and returns the client secret", async () => {
    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data.clientSecret).toBe("pi_123_secret_key");
    expect(json.data.subscriptionId).toBe("sub_123");

    expect(mocks.mockCreateCustomer).toHaveBeenCalledWith({
      email: "owner@acme.com",
      metadata: { workspaceId: "ws_1" },
    });
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { stripeCustomerId: "cus_123" },
    });
    expect(mocks.mockCreateSubscription).toHaveBeenCalledWith({
      customer: "cus_123",
      items: [{ price: "price_pro" }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      metadata: { workspaceId: "ws_1", planId: "plan_pro" },
      expand: ["latest_invoice.payment_intent"],
    });
  });

  it("reuses an existing Stripe customer without creating a new one", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(makeProfile("cus_existing"));

    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(200);
    expect(mocks.mockCreateCustomer).not.toHaveBeenCalled();
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
    expect(mocks.mockCreateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" })
    );
  });

  it("surfaces Stripe API errors with a useful message instead of a generic 500", async () => {
    mocks.mockCreateSubscription.mockRejectedValue(
      new Stripe.errors.StripeInvalidRequestError({
        type: "invalid_request_error",
        code: "resource_missing",
        message: "No such price: price_pro",
        requestId: "req_123",
        statusCode: 400,
      })
    );

    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("STRIPE_ERROR");
    expect(json.error.message).toContain("No such price");
  });

  it("returns 502 when the subscription has no payment intent", async () => {
    mocks.mockCreateSubscription.mockResolvedValue(makeSubscription());

    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error.code).toBe("STRIPE_CONFIGURATION_ERROR");
  });
});

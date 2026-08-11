import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateCustomer: vi.fn(),
  mockCreateSession: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockPlanFindFirst: vi.fn(),
  mockWorkspaceUpdate: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: mocks.mockCreateCustomer },
    checkout: { sessions: { create: mocks.mockCreateSession } },
  },
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: { findUnique: mocks.mockProfileFindUnique },
    plan: { findFirst: mocks.mockPlanFindFirst },
    workspace: { update: mocks.mockWorkspaceUpdate },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

import { POST } from "../app/api/stripe/checkout/route";

const makeRequest = (body?: unknown) =>
  new NextRequest("http://x/api/stripe/checkout", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const makeUser = () => ({ id: "user_1", email: "owner@acme.com" });

const makeProfile = () => ({
  id: "user_1",
  tenant: {
    id: "ws_1",
    name: "Acme",
    slug: "acme",
    stripeCustomerId: null,
    planId: null,
    status: "active",
  },
});

const makePlan = () => ({
  id: "plan_pro",
  name: "Pro",
  stripePriceId: "price_pro",
  isActive: true,
});

describe("stripe checkout", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockGetUser.mockResolvedValue(makeUser());
    mocks.mockProfileFindUnique.mockResolvedValue(makeProfile());
    mocks.mockPlanFindFirst.mockResolvedValue(makePlan());
    mocks.mockCreateCustomer.mockResolvedValue({ id: "cus_123" });
    mocks.mockCreateSession.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/c/pay/cs_1",
    });
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
    expect(mocks.mockCreateCustomer).not.toHaveBeenCalled();
    expect(mocks.mockCreateSession).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing priceId", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    expect(mocks.mockCreateSession).not.toHaveBeenCalled();
  });

  it("creates a Stripe customer, saves it on the workspace, and returns the checkout URL", async () => {
    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.url).toBe("https://checkout.stripe.com/c/pay/cs_1");
    expect(mocks.mockCreateCustomer).toHaveBeenCalledWith({
      email: "owner@acme.com",
      metadata: { workspaceId: "ws_1" },
    });
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { stripeCustomerId: "cus_123" },
    });
    expect(mocks.mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_123",
        line_items: [{ price: "price_pro", quantity: 1 }],
        success_url: "http://x/app",
        cancel_url: "http://x/app",
        metadata: { workspaceId: "ws_1" },
      })
    );
  });

  it("reuses an existing Stripe customer without creating a new one", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue({
      ...makeProfile(),
      tenant: { ...makeProfile().tenant, stripeCustomerId: "cus_existing" },
    });

    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(200);
    expect(mocks.mockCreateCustomer).not.toHaveBeenCalled();
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
    expect(mocks.mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" })
    );
  });

  it("returns 400 when the user's profile has no workspace", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.mockCreateSession).not.toHaveBeenCalled();
  });
});

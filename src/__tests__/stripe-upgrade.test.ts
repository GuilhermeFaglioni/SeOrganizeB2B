import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockPlanFindFirst: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockListSubscriptions: vi.fn(),
  mockUpdateSubscription: vi.fn(),
  mockWorkspaceUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: { findUnique: mocks.mockProfileFindUnique },
    plan: { findFirst: mocks.mockPlanFindFirst },
    workspace: { update: mocks.mockWorkspaceUpdate },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      list: mocks.mockListSubscriptions,
      update: mocks.mockUpdateSubscription,
    },
  },
}));

import { POST } from "../app/api/stripe/upgrade/route";

const makeRequest = (body?: unknown) =>
  new NextRequest("http://x/api/stripe/upgrade", {
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
    stripeCustomerId: "cus_123",
    planId: "plan_basic",
    status: "active",
  },
});

const makePlan = () => ({
  id: "plan_pro",
  name: "Pro",
  stripePriceId: "price_pro",
  isActive: true,
});

const makeSubscription = () => ({
  id: "sub_1",
  items: {
    data: [{ id: "si_1", price: { id: "price_basic" } }],
  },
});

describe("stripe upgrade", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockGetUser.mockResolvedValue(makeUser());
    mocks.mockProfileFindUnique.mockResolvedValue(makeProfile());
    mocks.mockPlanFindFirst.mockResolvedValue(makePlan());
    mocks.mockListSubscriptions.mockResolvedValue({ data: [makeSubscription()] });
    mocks.mockUpdateSubscription.mockResolvedValue(makeSubscription());
    mocks.mockWorkspaceUpdate.mockResolvedValue({});
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
    expect(mocks.mockUpdateSubscription).not.toHaveBeenCalled();
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
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
    expect(mocks.mockUpdateSubscription).not.toHaveBeenCalled();
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing priceId", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.mockUpdateSubscription).not.toHaveBeenCalled();
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when the workspace has no Stripe customer", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue({
      ...makeProfile(),
      tenant: { ...makeProfile().tenant, stripeCustomerId: null },
    });

    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("STRIPE_CUSTOMER_MISSING");
    expect(mocks.mockListSubscriptions).not.toHaveBeenCalled();
    expect(mocks.mockUpdateSubscription).not.toHaveBeenCalled();
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when the workspace has no subscription", async () => {
    mocks.mockListSubscriptions.mockResolvedValue({ data: [] });

    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("STRIPE_SUBSCRIPTION_MISSING");
    expect(mocks.mockUpdateSubscription).not.toHaveBeenCalled();
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("updates the subscription with the new price, updates the workspace plan, and returns the URL", async () => {
    const res = await POST(makeRequest({ priceId: "price_pro" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.url).toBe("http://x/app");
    expect(json.error).toBeNull();
    expect(mocks.mockListSubscriptions).toHaveBeenCalledWith({
      customer: "cus_123",
      limit: 1,
    });
    expect(mocks.mockUpdateSubscription).toHaveBeenCalledWith("sub_1", {
      items: [{ id: "si_1", price: "price_pro" }],
    });
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { planId: "plan_pro" },
    });
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import Stripe from "stripe";

const mocks = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
  mockWorkspaceFindFirst: vi.fn(),
  mockWorkspaceUpdate: vi.fn(),
  mockPlanFindFirst: vi.fn(),
  mockSubscriptionsList: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: mocks.mockConstructEvent,
    },
    subscriptions: {
      list: mocks.mockSubscriptionsList,
    },
  },
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    workspace: {
      findFirst: mocks.mockWorkspaceFindFirst,
      update: mocks.mockWorkspaceUpdate,
    },
    plan: {
      findFirst: mocks.mockPlanFindFirst,
    },
  },
}));

import { POST } from "../app/api/stripe/webhook/route";

const makeRequest = (body: string, signature = "t=123,v1=abc") =>
  new Request("http://x/api/stripe/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature },
  });

const makeEvent = (type: string, object: unknown): Stripe.Event =>
  ({
    id: `evt_${type.replaceAll(".", "_")}`,
    object: "event",
    api_version: "2024-12-18.acacia",
    created: Math.floor(Date.now() / 1000),
    data: { object },
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
  }) as Stripe.Event;

const makeInvoice = (customer: string) => ({
  id: "in_1",
  object: "invoice",
  customer,
});

const makeSubscription = (customer: string, priceId?: string) => ({
  id: "sub_1",
  object: "subscription",
  customer,
  items: {
    data: [{ price: { id: priceId ?? "price_123" } }],
  },
});

const makeCheckoutSession = (customer: string) => ({
  id: "cs_1",
  object: "checkout.session",
  customer,
});

describe("stripe webhook", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockWorkspaceFindFirst.mockResolvedValue({ id: "ws_1" });
    mocks.mockWorkspaceUpdate.mockResolvedValue({ id: "ws_1" });
    mocks.mockSubscriptionsList.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and activates the workspace on invoice.payment_succeeded", async () => {
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("invoice.payment_succeeded", makeInvoice("cus_123"))
    );
    mocks.mockSubscriptionsList.mockResolvedValue({
      data: [
        { id: "sub_1", items: { data: [{ price: { id: "price_pro" } }] } },
      ],
    });
    mocks.mockPlanFindFirst.mockResolvedValue({ id: "plan_pro" });

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mocks.mockWorkspaceFindFirst).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_123" },
    });
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { status: "active", gracePeriodEndsAt: null, planId: "plan_pro" },
    });
  });

  it("puts the workspace in grace period on invoice.payment_failed", async () => {
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("invoice.payment_failed", makeInvoice("cus_123"))
    );

    const before = Date.now();
    const res = await POST(makeRequest("payload"));
    const after = Date.now();

    expect(res.status).toBe(200);
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledTimes(1);
    const { data } = mocks.mockWorkspaceUpdate.mock.calls[0][0];
    expect(data.status).toBe("grace_period");
    expect(data.gracePeriodEndsAt).toBeInstanceOf(Date);
    const endsAt = (data.gracePeriodEndsAt as Date).getTime();
    expect(endsAt).toBeGreaterThan(before + 3 * 24 * 60 * 60 * 1000 - 1000);
    expect(endsAt).toBeLessThanOrEqual(after + 3 * 24 * 60 * 60 * 1000);
  });

  it("cancels the workspace on customer.subscription.deleted", async () => {
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("customer.subscription.deleted", makeSubscription("cus_123"))
    );

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { status: "cancelled", cancelledAt: expect.any(Date) },
    });
  });

  it("updates planId and stripeCustomerId on customer.subscription.updated", async () => {
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent(
        "customer.subscription.updated",
        makeSubscription("cus_123", "price_pro")
      )
    );
    mocks.mockPlanFindFirst.mockResolvedValue({ id: "plan_pro" });

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    expect(mocks.mockPlanFindFirst).toHaveBeenCalledWith({
      where: { stripePriceId: "price_pro" },
    });
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { stripeCustomerId: "cus_123", planId: "plan_pro" },
    });
  });

  it("keeps the existing planId when the price has no matching Plan", async () => {
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent(
        "customer.subscription.updated",
        makeSubscription("cus_123", "price_unknown")
      )
    );
    mocks.mockPlanFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { stripeCustomerId: "cus_123" },
    });
  });

  it("activates the workspace and resolves the plan on checkout.session.completed", async () => {
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.completed", makeCheckoutSession("cus_123"))
    );
    mocks.mockSubscriptionsList.mockResolvedValue({
      data: [
        { id: "sub_1", items: { data: [{ price: { id: "price_pro" } }] } },
      ],
    });
    mocks.mockPlanFindFirst.mockResolvedValue({ id: "plan_pro" });

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    expect(mocks.mockSubscriptionsList).toHaveBeenCalledWith({
      customer: "cus_123",
      limit: 1,
    });
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: {
        status: "active",
        gracePeriodEndsAt: null,
        planId: "plan_pro",
      },
    });
  });

  it("ignores checkout.session.completed without a customer", async () => {
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("checkout.session.completed", {
        id: "cs_1",
        object: "checkout.session",
        customer: null,
      })
    );

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    expect(mocks.mockSubscriptionsList).not.toHaveBeenCalled();
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 when the signature is invalid", async () => {
    mocks.mockConstructEvent.mockImplementation(() => {
      throw new Error("Signature verification failed");
    });

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(403);
    expect(mocks.mockWorkspaceFindFirst).not.toHaveBeenCalled();
  });

  it("returns 200 when no workspace matches the customer", async () => {
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("invoice.payment_succeeded", makeInvoice("cus_missing"))
    );
    mocks.mockWorkspaceFindFirst.mockResolvedValue(null);

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("returns 200 for unhandled event types", async () => {
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("charge.succeeded", { id: "ch_1", object: "charge" })
    );

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });
});
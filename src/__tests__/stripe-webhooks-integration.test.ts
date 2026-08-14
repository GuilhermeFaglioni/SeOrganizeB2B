import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import Stripe from "stripe";
import { isGracePeriodExpired } from "../lib/workspace/grace-period";
import { getWorkspaceAccessMode } from "../lib/workspace/access";
import type { WorkspaceData } from "../hooks/use-workspace";

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

const DAY_MS = 24 * 60 * 60 * 1000;

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

interface WorkspaceState {
  id: string;
  status: string;
  gracePeriodEndsAt: Date | null;
  cancelledAt: Date | null;
  planId: string | null;
  stripeCustomerId: string | null;
}

function activeWorkspace(stripeCustomerId = "cus_123"): WorkspaceState {
  return {
    id: "ws_1",
    status: "active",
    gracePeriodEndsAt: null,
    cancelledAt: null,
    planId: null,
    stripeCustomerId,
  };
}

function installWorkspaceState(initial: WorkspaceState) {
  let state = { ...initial };
  mocks.mockWorkspaceFindFirst.mockImplementation(async () => ({ ...state }));
  mocks.mockWorkspaceUpdate.mockImplementation(async ({ data }) => {
    state = { ...state, ...data };
    return { ...state };
  });
  mocks.mockSubscriptionsList.mockResolvedValue({ data: [] });
  return {
    get: (): WorkspaceState => ({ ...state }),
  };
}

function makeWorkspaceData(
  status: WorkspaceData["status"],
  gracePeriodEndsAt: string | null
): WorkspaceData {
  return {
    id: "ws_1",
    name: "Acme",
    slug: "acme",
    logoUrl: null,
    companyName: "Acme Inc",
    onboardingCompleted: false,
    status,
    gracePeriodEndsAt,
    plan: null,
    features: {
      allowedModules: [],
      limits: {},
      usage: { users: 0, tasks: 0, projects: 0, contracts: 0 },
    },
  };
}

describe("stripe webhook integration — simulated events (T-049)", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("activates the workspace and clears the grace period on invoice.payment_succeeded", async () => {
    const ws = installWorkspaceState({
      ...activeWorkspace(),
      status: "grace_period",
      gracePeriodEndsAt: new Date(Date.now() + 2 * DAY_MS),
    });
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("invoice.payment_succeeded", makeInvoice("cus_123"))
    );

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { status: "active", gracePeriodEndsAt: null },
    });
    expect(ws.get().status).toBe("active");
    expect(ws.get().gracePeriodEndsAt).toBeNull();
  });

  it("enters a 3-day grace period on invoice.payment_failed", async () => {
    const ws = installWorkspaceState(activeWorkspace());
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("invoice.payment_failed", makeInvoice("cus_123"))
    );

    const before = Date.now();
    const res = await POST(makeRequest("payload"));
    const after = Date.now();

    expect(res.status).toBe(200);
    const state = ws.get();
    expect(state.status).toBe("grace_period");
    expect(state.gracePeriodEndsAt).toBeInstanceOf(Date);
    const endsAt = (state.gracePeriodEndsAt as Date).getTime();
    expect(endsAt).toBeGreaterThan(before + 3 * DAY_MS - 1000);
    expect(endsAt).toBeLessThanOrEqual(after + 3 * DAY_MS);
  });

  it("cancels the workspace on customer.subscription.deleted", async () => {
    const ws = installWorkspaceState(activeWorkspace());
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("customer.subscription.deleted", makeSubscription("cus_123"))
    );

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    const state = ws.get();
    expect(state.status).toBe("cancelled");
    expect(state.cancelledAt).toBeInstanceOf(Date);
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { status: "cancelled", cancelledAt: expect.any(Date) },
    });
  });

  it("updates planId and stripeCustomerId on customer.subscription.updated", async () => {
    const ws = installWorkspaceState(activeWorkspace());
    mocks.mockPlanFindFirst.mockResolvedValue({ id: "plan_pro" });
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent(
        "customer.subscription.updated",
        makeSubscription("cus_123", "price_pro")
      )
    );

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { stripeCustomerId: "cus_123", planId: "plan_pro" },
    });
    expect(ws.get().planId).toBe("plan_pro");
    expect(ws.get().stripeCustomerId).toBe("cus_123");
  });

  it("resolves an unknown price without touching planId", async () => {
    const ws = installWorkspaceState({ ...activeWorkspace(), planId: "plan_free" });
    mocks.mockPlanFindFirst.mockResolvedValue(null);
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent(
        "customer.subscription.updated",
        makeSubscription("cus_123", "price_unknown")
      )
    );

    const res = await POST(makeRequest("payload"));

    expect(res.status).toBe(200);
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { stripeCustomerId: "cus_123" },
    });
    expect(ws.get().planId).toBe("plan_free");
  });
});

describe("stripe webhook integration — grace period lifecycle (T-049)", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("recovers from grace period back to active when payment succeeds", async () => {
    const ws = installWorkspaceState(activeWorkspace());

    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("invoice.payment_failed", makeInvoice("cus_123"))
    );
    await POST(makeRequest("failed"));
    expect(ws.get().status).toBe("grace_period");
    expect(ws.get().gracePeriodEndsAt).not.toBeNull();

    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("invoice.payment_succeeded", makeInvoice("cus_123"))
    );
    await POST(makeRequest("succeeded"));

    expect(ws.get().status).toBe("active");
    expect(ws.get().gracePeriodEndsAt).toBeNull();

    const [failed, succeeded] = mocks.mockWorkspaceUpdate.mock.calls;
    expect(failed[0].data).toEqual(
      expect.objectContaining({ status: "grace_period" })
    );
    expect(succeeded[0].data).toEqual({
      status: "active",
      gracePeriodEndsAt: null,
    });
  });

  it("expires the grace period into cancelled when the end date passes", () => {
    const within = makeWorkspaceData(
      "grace_period",
      new Date(Date.now() + 3 * DAY_MS).toISOString()
    );
    expect(isGracePeriodExpired(within)).toBe(false);
    expect(getWorkspaceAccessMode(within)).toBe("grace");

    const expired = makeWorkspaceData(
      "grace_period",
      new Date(Date.now() - DAY_MS).toISOString()
    );
    expect(isGracePeriodExpired(expired)).toBe(true);
    expect(getWorkspaceAccessMode(expired)).toBe("expired");
  });

  it("never treats an active or cancelled workspace as an expired grace period", () => {
    const active = makeWorkspaceData("active", null);
    expect(isGracePeriodExpired(active)).toBe(false);
    expect(getWorkspaceAccessMode(active)).toBe("active");

    const cancelled = makeWorkspaceData(
      "cancelled",
      new Date(Date.now() + 30 * DAY_MS).toISOString()
    );
    expect(isGracePeriodExpired(cancelled)).toBe(false);
    expect(getWorkspaceAccessMode(cancelled)).toBe("readonly");
  });
});

describe("stripe webhook integration — signature verification (T-049)", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns 200 and forwards the payload, signature and secret when valid", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const ws = installWorkspaceState(activeWorkspace());
    mocks.mockConstructEvent.mockReturnValue(
      makeEvent("invoice.payment_succeeded", makeInvoice("cus_123"))
    );

    const res = await POST(makeRequest("raw-body", "t=123,v1=sig"));

    expect(res.status).toBe(200);
    expect(mocks.mockConstructEvent).toHaveBeenCalledWith(
      "raw-body",
      "t=123,v1=sig",
      "whsec_test"
    );
    expect(ws.get().status).toBe("active");
  });

  it("returns 403 and does not touch the workspace when invalid", async () => {
    mocks.mockConstructEvent.mockImplementation(() => {
      throw new Error("Signature verification failed");
    });

    const res = await POST(makeRequest("raw-body"));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Invalid signature" });
    expect(mocks.mockWorkspaceFindFirst).not.toHaveBeenCalled();
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });
});

describe("stripe webhook integration — grace period banner date (T-049)", () => {
  const bannerSource = readFileSync(
    new URL("../components/billing/grace-period-banner.tsx", import.meta.url),
    "utf8"
  );

  it("formats and renders the grace period end date", () => {
    expect(bannerSource).toContain(
      "new Date(workspace.gracePeriodEndsAt).toLocaleDateString()"
    );
    expect(bannerSource).toContain('t("message", { date })');
  });

  it("only renders while a grace period end date exists", () => {
    expect(bannerSource).toContain("if (!workspace?.gracePeriodEndsAt) return null;");
  });
});

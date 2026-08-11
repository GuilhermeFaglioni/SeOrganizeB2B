import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockPortalSessionsCreate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: {
      findUnique: mocks.mockProfileFindUnique,
    },
    workspace: {
      findUnique: mocks.mockWorkspaceFindUnique,
    },
  },
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: mocks.mockPortalSessionsCreate,
      },
    },
  },
}));

import { POST } from "../app/api/stripe/portal/route";

const makeRequest = () =>
  new Request("http://x/api/stripe/portal", { method: "POST" });

describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockGetUser.mockResolvedValue({ id: "user-1" });
    mocks.mockProfileFindUnique.mockResolvedValue({ tenantId: "ws_1" });
    mocks.mockWorkspaceFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_123",
    });
    mocks.mockPortalSessionsCreate.mockResolvedValue({
      url: "https://billing.stripe.com/session",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mocks.mockGetUser.mockResolvedValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(mocks.mockProfileFindUnique).not.toHaveBeenCalled();
    expect(mocks.mockPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when the workspace has no stripeCustomerId", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue({
      stripeCustomerId: null,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(400);
    expect(mocks.mockPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it("creates a billing portal session and returns its URL", async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mocks.mockPortalSessionsCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "http://x/app",
    });
    expect(await res.json()).toEqual({
      data: { url: "https://billing.stripe.com/session" },
      error: null,
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  requireAIStudioAccess: vi.fn(),
  getAICreditBalance: vi.fn(),
  getAICreditLedgerHistory: vi.fn(),
  getMemberCreditLimitUsage: vi.fn(),
  getActiveManagedAICycle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/ai/studio-http", () => ({
  requireAIStudioAccess: mocks.requireAIStudioAccess,
  unauthorizedResponse: () => new Response(null, { status: 401 }),
}));
vi.mock("@/lib/ai/credit-ledger", () => ({
  getAICreditBalance: mocks.getAICreditBalance,
  getAICreditLedgerHistory: mocks.getAICreditLedgerHistory,
  AICreditLedgerError: class AICreditLedgerError extends Error {},
}));
vi.mock("@/lib/ai/member-credit-limits", () => ({ getMemberCreditLimitUsage: mocks.getMemberCreditLimitUsage }));
vi.mock("@/lib/ai/managed-cycle", () => ({ getActiveManagedAICycle: mocks.getActiveManagedAICycle }));

import { GET } from "../app/api/ai/credits/route";

describe("AI credit balance API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getUser.mockResolvedValue({ id: "user-1" });
    mocks.requireAIStudioAccess.mockResolvedValue({ tenantId: "tenant-1" });
    mocks.getAICreditBalance.mockResolvedValue({
      promotional: 1,
      subscription: 2,
      purchased: 3,
      total: 6,
    });
    mocks.getAICreditLedgerHistory.mockResolvedValue([]);
    mocks.getMemberCreditLimitUsage.mockResolvedValue({ limit: null, used: 0, remaining: null });
    mocks.getActiveManagedAICycle.mockResolvedValue(null);
  });

  it("requires authentication", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await GET())?.status).toBe(401);
    expect(mocks.requireAIStudioAccess).not.toHaveBeenCalled();
  });

  it("returns separated balances and tenant history", async () => {
    const response = await GET();
    expect(response).toBeDefined();
    if (!response) return;
    expect(response.status).toBe(200);
    expect(mocks.getAICreditBalance).toHaveBeenCalledWith("tenant-1");
    expect(mocks.getAICreditLedgerHistory).toHaveBeenCalledWith("tenant-1");
    await expect(response.json()).resolves.toEqual({
      data: {
        balance: { promotional: 1, subscription: 2, purchased: 3, total: 6 },
        history: [],
        cycle: null,
        memberLimit: { limit: null, used: 0, remaining: null },
      },
      error: null,
    });
  });
});

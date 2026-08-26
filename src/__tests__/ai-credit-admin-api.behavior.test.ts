import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSuperAdminStatus: vi.fn(),
  findFirst: vi.fn(),
  getBalance: vi.fn(),
  getHistory: vi.fn(),
  apply: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/admin/super-admin", () => ({ getSuperAdminStatus: mocks.getSuperAdminStatus }));
vi.mock("../../prisma/client", () => ({
  prisma: { workspace: { findFirst: mocks.findFirst } },
  withTenantBypass: (_fn: () => unknown) => _fn(),
}));
vi.mock("@/lib/ai/credit-ledger", () => ({
  AI_CREDIT_POOLS: ["promotional", "subscription", "purchased"],
  getAICreditBalance: mocks.getBalance,
  getAICreditLedgerHistory: mocks.getHistory,
  applyManualAICreditOperation: mocks.apply,
  AICreditAdminError: class AICreditAdminError extends Error {},
}));

import { GET, POST } from "../app/api/admin/tenants/[id]/ai-credits/route";

describe("admin AI credit API", () => {
  const request = () => new NextRequest("http://localhost");

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getUser.mockResolvedValue({ id: "admin-1" });
    mocks.getSuperAdminStatus.mockResolvedValue(true);
    mocks.findFirst.mockResolvedValue({ id: "tenant-1" });
    mocks.getBalance.mockResolvedValue({ promotional: 1, subscription: 2, purchased: 3, total: 6 });
    mocks.getHistory.mockResolvedValue([]);
    mocks.apply.mockResolvedValue({ id: "entry-1", pool: "promotional", quantity: 5 });
  });

  it("rejects unauthenticated and non-admin callers", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await GET(request(), { params: Promise.resolve({ id: "tenant-1" }) }))?.status).toBe(401);
    mocks.getUser.mockResolvedValue({ id: "user-1" });
    mocks.getSuperAdminStatus.mockResolvedValue(false);
    expect((await GET(request(), { params: Promise.resolve({ id: "tenant-1" }) }))?.status).toBe(403);
  });

  it("checks the requested tenant and forwards the actor to the operation", async () => {
    const response = await POST(
      new NextRequest("http://localhost", { method: "POST", body: JSON.stringify({ operation: "grant", quantity: 5, campaign: "launch", reason: "Launch" }) }),
      { params: Promise.resolve({ id: "tenant-1" }) },
    );
    expect(response?.status).toBe(201);
    expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-1", actorId: "admin-1", operation: "grant", quantity: 5 }));
  });

  it("does not expose another tenant", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await GET(request(), { params: Promise.resolve({ id: "missing" }) }))?.status).toBe(404);
    expect(mocks.getBalance).not.toHaveBeenCalled();
  });
});

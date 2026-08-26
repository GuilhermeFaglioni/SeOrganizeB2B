import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), superAdmin: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/admin/super-admin", () => ({ getSuperAdminStatus: mocks.superAdmin }));
vi.mock("../../prisma/client", () => ({ prisma: { aiCreditPackage: { create: mocks.create } } }));

import { POST } from "../app/api/admin/ai-credit-packages/route";

describe("AI credit package admin API", () => {
  beforeEach(() => { mocks.getUser.mockReset(); mocks.superAdmin.mockReset(); mocks.create.mockReset(); mocks.getUser.mockResolvedValue({ id: "admin" }); mocks.superAdmin.mockResolvedValue(true); mocks.create.mockResolvedValue({ id: "pkg-1", name: "Starter" }); });
  it("rejects non-platform-admins", async () => { mocks.superAdmin.mockResolvedValue(false); const response = await POST(new Request("http://x", { method: "POST", body: "{}" })); expect(response).toBeDefined(); if (!response) return; expect(response.status).toBe(403); expect(mocks.create).not.toHaveBeenCalled(); });
  it("creates a validated package", async () => { const response = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Starter", stripePriceId: "price_1", priceCents: 1000, creditQuantity: 100, maxPurchasesPerMonth: 2, maxCreditsPerMonth: 300 }) })); expect(response).toBeDefined(); if (!response) return; expect(response.status).toBe(201); expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ creditQuantity: 100, priceCents: 1000, maxPurchasesPerMonth: 2 }) }); });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getTenantContext: vi.fn(), getEffectivePermissions: vi.fn(), createPending: vi.fn(), profileFindUnique: vi.fn(), purchaseUpdate: vi.fn(), customerCreate: vi.fn(), sessionCreate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/authz/tenant-context", () => ({ getTenantContext: mocks.getTenantContext }));
vi.mock("@/lib/authz/authz", () => ({ getEffectivePermissions: mocks.getEffectivePermissions, hasPermission: (effective: { allowed?: boolean }) => effective.allowed === true }));
vi.mock("@/lib/ai/credit-packages", () => ({ createPendingAICreditPurchase: mocks.createPending, listAICreditPackages: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ stripe: { customers: { create: mocks.customerCreate }, checkout: { sessions: { create: mocks.sessionCreate } } } }));
vi.mock("../../prisma/client", () => ({ prisma: { profile: { findUnique: mocks.profileFindUnique }, workspace: { update: vi.fn() }, aiCreditPurchase: { update: mocks.purchaseUpdate } }, withTenant: vi.fn((_tenant: string, fn: () => unknown) => fn()) }));

import { POST } from "../app/api/stripe/credit-packages/route";

describe("AI credit package checkout API", () => {
  beforeEach(() => { Object.values(mocks).forEach((mock) => mock.mockReset()); mocks.getUser.mockResolvedValue({ id: "member-1", email: "member@example.com" }); mocks.getTenantContext.mockResolvedValue({ tenantId: "tenant-1" }); });
  it("requires the delegated purchase permission", async () => { mocks.getEffectivePermissions.mockResolvedValue({ allowed: false }); const response = await POST(new NextRequest("http://x", { method: "POST", body: JSON.stringify({ packageId: "pkg-1" }) })); expect(response).toBeDefined(); if (!response) return; expect(response.status).toBe(403); expect(mocks.createPending).not.toHaveBeenCalled(); });
  it("requires authentication", async () => { mocks.getUser.mockResolvedValue(null); const response = await POST(new NextRequest("http://x", { method: "POST", body: "{}" })); expect(response).toBeDefined(); if (!response) return; expect(response.status).toBe(401); });

  it("updates the stable purchase identity after Checkout creation", async () => {
    mocks.getEffectivePermissions.mockResolvedValue({ allowed: true });
    mocks.profileFindUnique.mockResolvedValue({ tenantId: "tenant-1", tenant: { id: "tenant-1", stripeCustomerId: "cus-1" } });
    mocks.createPending.mockResolvedValue({ id: "purchase-1", stripePriceId: "price-1" });
    mocks.sessionCreate.mockResolvedValue({ id: "cs-1", url: "https://checkout.test" });
    await POST(new NextRequest("http://x", { method: "POST", body: JSON.stringify({ packageId: "pkg-1" }) }));
    expect(mocks.purchaseUpdate).toHaveBeenCalledWith({ where: { id: "purchase-1" }, data: { stripeCheckoutSessionId: "cs-1" } });
  });
});

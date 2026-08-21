import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn() }),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "test@co" }),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    plan: {
      findMany: vi.fn().mockResolvedValue([
        { id: "p1", name: "Pro", stripePriceId: "price_pro", allowedModules: ["tasks"], isInternal: false },
        { id: "cb1", name: "Closed Beta", stripePriceId: null, allowedModules: ["tasks"], isInternal: true },
      ]),
    },
  },
}));

vi.mock("stripe", () => ({
  Stripe: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: vi.fn() } },
  })),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: { checkout: { sessions: { create: vi.fn() } } },
}));

import { GET as plansList } from "../app/api/plans/route";

describe("public plans API", () => {
  it("queries plans with isInternal=false filter", async () => {
    await plansList();
    const { prisma } = await import("../../prisma/client");
    expect(prisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isInternal: false }),
      }),
    );
  });
});

describe("test-checkout page", () => {
  it("filters isInternal=false from plan query", async () => {
    const { prisma } = await import("../../prisma/client");
    // Import the page module to verify the query shape
    const mod = await import("../app/test-checkout/page");
    // The page module's default function calls prisma.plan.findMany
    // with { where: { isActive: true, isInternal: false } }
    // We verify via the mock call args
    await mod.default();
    expect(prisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isInternal: false }),
      }),
    );
  });
});

describe("test-checkout page metadata", () => {
  it("includes robots noindex for test pages", async () => {
    const mod = await import("../app/test-checkout/page");
    expect(mod.metadata).toEqual(
      expect.objectContaining({
        robots: { index: false, follow: false },
      }),
    );
  });

  it("return page includes robots noindex", async () => {
    const mod = await import("../app/test-checkout/return/page");
    expect(mod.metadata).toEqual(
      expect.objectContaining({
        robots: { index: false, follow: false },
      }),
    );
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetSuperAdminStatus: vi.fn(),
  mockPlanFindMany: vi.fn(),
  mockPlanCreate: vi.fn(),
  mockPlanFindUnique: vi.fn(),
  mockPlanUpdate: vi.fn(),
  mockPlanUpdateMany: vi.fn(),
  mockPrismaTransaction: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("@/lib/admin/super-admin", () => ({
  getSuperAdminStatus: mocks.mockGetSuperAdminStatus,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    plan: {
      findMany: mocks.mockPlanFindMany,
      create: mocks.mockPlanCreate,
      findUnique: mocks.mockPlanFindUnique,
      update: mocks.mockPlanUpdate,
      updateMany: mocks.mockPlanUpdateMany,
    },
    $transaction: mocks.mockPrismaTransaction,
  },
}));

import {
  GET as listPlans,
  POST as createPlan,
} from "../app/api/admin/plans/route";
import {
  GET as getPlan,
  PATCH as patchPlan,
  DELETE as deletePlan,
} from "../app/api/admin/plans/[id]/route";

const makeRequest = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const superAdmin = () => {
  mocks.mockGetUser.mockResolvedValue({ id: "user-1" });
  mocks.mockGetSuperAdminStatus.mockResolvedValue(true);
};

const planRow = (overrides: Record<string, unknown> = {}) => ({
  id: "p1",
  name: "Pro",
  stripePriceId: "price_1",
  allowedModules: ["tasks", "calendar"],
  isDefault: false,
  isActive: true,
  createdAt: new Date("2026-08-11T10:00:00Z"),
  updatedAt: new Date("2026-08-11T10:00:00Z"),
  ...overrides,
});

describe("admin plans API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.mockGetUser.mockResolvedValue(null);

    const res = await listPlans();

    expect(res.status).toBe(401);
    expect(mocks.mockPlanFindMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin on every operation", async () => {
    mocks.mockGetUser.mockResolvedValue({ id: "user-1" });
    mocks.mockGetSuperAdminStatus.mockResolvedValue(false);

    const listRes = await listPlans();
    expect(listRes.status).toBe(403);
    expect(mocks.mockPlanFindMany).not.toHaveBeenCalled();

    const createRes = await createPlan(
      makeRequest("http://x/api/admin/plans", "POST", {
        name: "X",
        allowedModules: [],
      })
    );
    expect(createRes.status).toBe(403);
    expect(mocks.mockPlanCreate).not.toHaveBeenCalled();

    const getRes = await getPlan(
      makeRequest("http://x/api/admin/plans/p1", "GET"),
      { params: { id: "p1" } } as never
    );
    expect(getRes.status).toBe(403);

    const patchRes = await patchPlan(
      makeRequest("http://x/api/admin/plans/p1", "PATCH", { name: "Y" }),
      { params: { id: "p1" } } as never
    );
    expect(patchRes.status).toBe(403);

    const deleteRes = await deletePlan(
      makeRequest("http://x/api/admin/plans/p1", "DELETE"),
      { params: { id: "p1" } } as never
    );
    expect(deleteRes.status).toBe(403);
    expect(mocks.mockPlanUpdate).not.toHaveBeenCalled();
  });

  it("lists all plans without an isActive filter", async () => {
    superAdmin();
    mocks.mockPlanFindMany.mockResolvedValue([
      planRow(),
      planRow({ id: "p2", name: "Starter", isActive: false }),
    ]);

    const res = await listPlans();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0].name).toBe("Pro");
    expect(json.data[1].isActive).toBe(false);
    expect(mocks.mockPlanFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } })
    );
  });

  it("creates a plan with modules and stripePriceId", async () => {
    superAdmin();
    mocks.mockPlanCreate.mockResolvedValue(
      planRow({ name: "Starter", allowedModules: ["tasks"] })
    );

    const res = await createPlan(
      makeRequest("http://x/api/admin/plans", "POST", {
        name: "Starter",
        stripePriceId: "price_1",
        allowedModules: ["tasks"],
      })
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.name).toBe("Starter");
    expect(json.data.isActive).toBe(true);
    expect(mocks.mockPlanCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Starter",
          stripePriceId: "price_1",
          allowedModules: ["tasks"],
          isDefault: false,
          isActive: true,
        }),
      })
    );
  });

  it("unsets other defaults when creating a default plan", async () => {
    superAdmin();
    mocks.mockPrismaTransaction.mockResolvedValue([
      { count: 1 },
      planRow({ id: "p2", name: "Enterprise", isDefault: true }),
    ]);

    const res = await createPlan(
      makeRequest("http://x/api/admin/plans", "POST", {
        name: "Enterprise",
        allowedModules: ["tasks", "calendar"],
        isDefault: true,
      })
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.isDefault).toBe(true);
    expect(mocks.mockPlanUpdateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    expect(mocks.mockPlanCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isDefault: true, isActive: true }),
      })
    );
  });

  it("returns 400 when name is missing", async () => {
    superAdmin();

    const res = await createPlan(
      makeRequest("http://x/api/admin/plans", "POST", { allowedModules: [] })
    );

    expect(res.status).toBe(400);
    expect(mocks.mockPlanCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when allowedModules is not an array of strings", async () => {
    superAdmin();

    const res = await createPlan(
      makeRequest("http://x/api/admin/plans", "POST", {
        name: "X",
        allowedModules: "tasks",
      })
    );

    expect(res.status).toBe(400);
    expect(mocks.mockPlanCreate).not.toHaveBeenCalled();
  });

  it("edits a plan without affecting tenants", async () => {
    superAdmin();
    mocks.mockPlanFindUnique.mockResolvedValue(planRow());
    mocks.mockPlanUpdate.mockResolvedValue(
      planRow({ name: "Pro Plus", stripePriceId: "price_2" })
    );

    const res = await patchPlan(
      makeRequest("http://x/api/admin/plans/p1", "PATCH", {
        name: "Pro Plus",
        stripePriceId: "price_2",
        allowedModules: ["tasks", "calendar", "projects"],
      }),
      { params: { id: "p1" } } as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.name).toBe("Pro Plus");
    expect(mocks.mockPlanUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1" },
        data: expect.objectContaining({
          name: "Pro Plus",
          stripePriceId: "price_2",
          allowedModules: ["tasks", "calendar", "projects"],
        }),
      })
    );
  });

  it("unsets other defaults when patching a plan to be default", async () => {
    superAdmin();
    mocks.mockPlanFindUnique.mockResolvedValue(planRow());
    mocks.mockPrismaTransaction.mockResolvedValue([
      { count: 1 },
      planRow({ isDefault: true }),
    ]);

    const res = await patchPlan(
      makeRequest("http://x/api/admin/plans/p1", "PATCH", { isDefault: true }),
      { params: { id: "p1" } } as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.isDefault).toBe(true);
    expect(mocks.mockPlanUpdateMany).toHaveBeenCalledWith({
      where: { isDefault: true, id: { not: "p1" } },
      data: { isDefault: false },
    });
  });

  it("deactivates a plan softly on delete", async () => {
    superAdmin();
    mocks.mockPlanFindUnique.mockResolvedValue(planRow());
    mocks.mockPlanUpdate.mockResolvedValue(planRow({ isActive: false }));

    const res = await deletePlan(
      makeRequest("http://x/api/admin/plans/p1", "DELETE"),
      { params: { id: "p1" } } as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.isActive).toBe(false);
    expect(mocks.mockPlanUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { isActive: false },
    });
  });

  it("returns 404 when patching a missing plan", async () => {
    superAdmin();
    mocks.mockPlanFindUnique.mockResolvedValue(null);

    const res = await patchPlan(
      makeRequest("http://x/api/admin/plans/nope", "PATCH", { name: "X" }),
      { params: { id: "nope" } } as never
    );

    expect(res.status).toBe(404);
    expect(mocks.mockPlanUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when deleting a missing plan", async () => {
    superAdmin();
    mocks.mockPlanFindUnique.mockResolvedValue(null);

    const res = await deletePlan(
      makeRequest("http://x/api/admin/plans/nope", "DELETE"),
      { params: { id: "nope" } } as never
    );

    expect(res.status).toBe(404);
    expect(mocks.mockPlanUpdate).not.toHaveBeenCalled();
  });
});
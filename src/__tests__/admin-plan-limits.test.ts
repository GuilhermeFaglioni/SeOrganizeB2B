import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetSuperAdminStatus: vi.fn(),
  mockPlanFindUnique: vi.fn(),
  mockPlanLimitFindMany: vi.fn(),
  mockPlanLimitFindFirst: vi.fn(),
  mockPlanLimitCreate: vi.fn(),
  mockPlanLimitUpdate: vi.fn(),
  mockPlanLimitDelete: vi.fn(),
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
      findUnique: mocks.mockPlanFindUnique,
    },
    planLimit: {
      findMany: mocks.mockPlanLimitFindMany,
      findFirst: mocks.mockPlanLimitFindFirst,
      create: mocks.mockPlanLimitCreate,
      update: mocks.mockPlanLimitUpdate,
      delete: mocks.mockPlanLimitDelete,
    },
  },
}));

import {
  GET as listLimits,
  POST as createLimit,
} from "../app/api/admin/plans/[id]/limits/route";
import {
  GET as getLimit,
  PATCH as patchLimit,
  DELETE as deleteLimit,
} from "../app/api/admin/plans/[id]/limits/[limitId]/route";

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
  allowedModules: ["tasks"],
  isDefault: false,
  isActive: true,
  createdAt: new Date("2026-08-11T10:00:00Z"),
  updatedAt: new Date("2026-08-11T10:00:00Z"),
  ...overrides,
});

const limitRow = (overrides: Record<string, unknown> = {}) => ({
  id: "lim1",
  planId: "p1",
  resource: "tasks",
  limit: 50,
  behavior: "hard",
  createdAt: new Date("2026-08-11T10:00:00Z"),
  updatedAt: new Date("2026-08-11T10:00:00Z"),
  ...overrides,
});

describe("admin plan limits API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.mockGetUser.mockResolvedValue(null);

    const res = await listLimits(
      makeRequest("http://x/api/admin/plans/p1/limits", "GET"),
      { params: { id: "p1" } } as never
    );

    expect(res.status).toBe(401);
    expect(mocks.mockPlanLimitFindMany).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-super-admin on every operation", async () => {
    mocks.mockGetUser.mockResolvedValue({ id: "user-1" });
    mocks.mockGetSuperAdminStatus.mockResolvedValue(false);

    const listRes = await listLimits(
      makeRequest("http://x/api/admin/plans/p1/limits", "GET"),
      { params: { id: "p1" } } as never
    );
    expect(listRes.status).toBe(403);
    expect(mocks.mockPlanLimitFindMany).not.toHaveBeenCalled();

    const createRes = await createLimit(
      makeRequest("http://x/api/admin/plans/p1/limits", "POST", {
        resource: "tasks",
        limit: 50,
        behavior: "hard",
      }),
      { params: { id: "p1" } } as never
    );
    expect(createRes.status).toBe(403);
    expect(mocks.mockPlanLimitCreate).not.toHaveBeenCalled();

    const getRes = await getLimit(
      makeRequest("http://x/api/admin/plans/p1/limits/lim1", "GET"),
      { params: { id: "p1", limitId: "lim1" } } as never
    );
    expect(getRes.status).toBe(403);

    const patchRes = await patchLimit(
      makeRequest("http://x/api/admin/plans/p1/limits/lim1", "PATCH", {
        limit: 100,
      }),
      { params: { id: "p1", limitId: "lim1" } } as never
    );
    expect(patchRes.status).toBe(403);
    expect(mocks.mockPlanLimitUpdate).not.toHaveBeenCalled();

    const deleteRes = await deleteLimit(
      makeRequest("http://x/api/admin/plans/p1/limits/lim1", "DELETE"),
      { params: { id: "p1", limitId: "lim1" } } as never
    );
    expect(deleteRes.status).toBe(403);
    expect(mocks.mockPlanLimitDelete).not.toHaveBeenCalled();
  });

  it("lists limits for a plan", async () => {
    superAdmin();
    mocks.mockPlanFindUnique.mockResolvedValue(planRow());
    mocks.mockPlanLimitFindMany.mockResolvedValue([
      limitRow(),
      limitRow({ id: "lim2", resource: "users", limit: 10, behavior: "warning" }),
    ]);

    const res = await listLimits(
      makeRequest("http://x/api/admin/plans/p1/limits", "GET"),
      { params: { id: "p1" } } as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0].resource).toBe("tasks");
    expect(json.data[1].behavior).toBe("warning");
    expect(mocks.mockPlanLimitFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { planId: "p1" },
        orderBy: { createdAt: "asc" },
      })
    );
  });

  it("returns 404 when listing limits for a missing plan", async () => {
    superAdmin();
    mocks.mockPlanFindUnique.mockResolvedValue(null);

    const res = await listLimits(
      makeRequest("http://x/api/admin/plans/nope/limits", "GET"),
      { params: { id: "nope" } } as never
    );

    expect(res.status).toBe(404);
    expect(mocks.mockPlanLimitFindMany).not.toHaveBeenCalled();
  });

  it("creates a limit with resource, limit and behavior", async () => {
    superAdmin();
    mocks.mockPlanFindUnique.mockResolvedValue(planRow());
    mocks.mockPlanLimitCreate.mockResolvedValue(limitRow());

    const res = await createLimit(
      makeRequest("http://x/api/admin/plans/p1/limits", "POST", {
        resource: "tasks",
        limit: 50,
        behavior: "hard",
      }),
      { params: { id: "p1" } } as never
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.resource).toBe("tasks");
    expect(json.data.limit).toBe(50);
    expect(json.data.behavior).toBe("hard");
    expect(mocks.mockPlanLimitCreate).toHaveBeenCalledWith({
      data: { planId: "p1", resource: "tasks", limit: 50, behavior: "hard" },
    });
  });

  it("returns 400 when creating a limit with an invalid resource", async () => {
    superAdmin();

    const res = await createLimit(
      makeRequest("http://x/api/admin/plans/p1/limits", "POST", {
        resource: "invoices",
        limit: 50,
        behavior: "hard",
      }),
      { params: { id: "p1" } } as never
    );

    expect(res.status).toBe(400);
    expect(mocks.mockPlanLimitCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when creating a limit with an invalid behavior", async () => {
    superAdmin();

    const res = await createLimit(
      makeRequest("http://x/api/admin/plans/p1/limits", "POST", {
        resource: "tasks",
        limit: 50,
        behavior: "strict",
      }),
      { params: { id: "p1" } } as never
    );

    expect(res.status).toBe(400);
    expect(mocks.mockPlanLimitCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when creating a limit with a non-integer or negative limit", async () => {
    superAdmin();

    const negativeRes = await createLimit(
      makeRequest("http://x/api/admin/plans/p1/limits", "POST", {
        resource: "tasks",
        limit: -1,
        behavior: "hard",
      }),
      { params: { id: "p1" } } as never
    );
    expect(negativeRes.status).toBe(400);

    const floatRes = await createLimit(
      makeRequest("http://x/api/admin/plans/p1/limits", "POST", {
        resource: "tasks",
        limit: 1.5,
        behavior: "hard",
      }),
      { params: { id: "p1" } } as never
    );
    expect(floatRes.status).toBe(400);

    expect(mocks.mockPlanLimitCreate).not.toHaveBeenCalled();
  });

  it("returns 404 when creating a limit for a missing plan", async () => {
    superAdmin();
    mocks.mockPlanFindUnique.mockResolvedValue(null);

    const res = await createLimit(
      makeRequest("http://x/api/admin/plans/nope/limits", "POST", {
        resource: "tasks",
        limit: 50,
        behavior: "hard",
      }),
      { params: { id: "nope" } } as never
    );

    expect(res.status).toBe(404);
    expect(mocks.mockPlanLimitCreate).not.toHaveBeenCalled();
  });

  it("gets a single limit scoped to the plan", async () => {
    superAdmin();
    mocks.mockPlanLimitFindFirst.mockResolvedValue(limitRow());

    const res = await getLimit(
      makeRequest("http://x/api/admin/plans/p1/limits/lim1", "GET"),
      { params: { id: "p1", limitId: "lim1" } } as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe("lim1");
    expect(mocks.mockPlanLimitFindFirst).toHaveBeenCalledWith({
      where: { id: "lim1", planId: "p1" },
    });
  });

  it("returns 404 when a limit does not belong to the plan", async () => {
    superAdmin();
    mocks.mockPlanLimitFindFirst.mockResolvedValue(null);

    const res = await getLimit(
      makeRequest("http://x/api/admin/plans/p1/limits/other", "GET"),
      { params: { id: "p1", limitId: "other" } } as never
    );

    expect(res.status).toBe(404);
  });

  it("edits a limit", async () => {
    superAdmin();
    mocks.mockPlanLimitFindFirst.mockResolvedValue(
      limitRow({ limit: 50, behavior: "hard" })
    );
    mocks.mockPlanLimitUpdate.mockResolvedValue(
      limitRow({ limit: 100, behavior: "warning" })
    );

    const res = await patchLimit(
      makeRequest("http://x/api/admin/plans/p1/limits/lim1", "PATCH", {
        limit: 100,
        behavior: "warning",
      }),
      { params: { id: "p1", limitId: "lim1" } } as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.limit).toBe(100);
    expect(json.data.behavior).toBe("warning");
    expect(mocks.mockPlanLimitUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lim1" },
        data: expect.objectContaining({ limit: 100, behavior: "warning" }),
      })
    );
  });

  it("returns 400 when patching a limit with an invalid resource", async () => {
    superAdmin();

    const res = await patchLimit(
      makeRequest("http://x/api/admin/plans/p1/limits/lim1", "PATCH", {
        resource: "invoices",
      }),
      { params: { id: "p1", limitId: "lim1" } } as never
    );

    expect(res.status).toBe(400);
    expect(mocks.mockPlanLimitUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when patching a limit that does not belong to the plan", async () => {
    superAdmin();
    mocks.mockPlanLimitFindFirst.mockResolvedValue(null);

    const res = await patchLimit(
      makeRequest("http://x/api/admin/plans/p1/limits/other", "PATCH", {
        limit: 100,
      }),
      { params: { id: "p1", limitId: "other" } } as never
    );

    expect(res.status).toBe(404);
    expect(mocks.mockPlanLimitUpdate).not.toHaveBeenCalled();
  });

  it("removes a limit", async () => {
    superAdmin();
    mocks.mockPlanLimitFindFirst.mockResolvedValue(limitRow());
    mocks.mockPlanLimitDelete.mockResolvedValue(limitRow());

    const res = await deleteLimit(
      makeRequest("http://x/api/admin/plans/p1/limits/lim1", "DELETE"),
      { params: { id: "p1", limitId: "lim1" } } as never
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.id).toBe("lim1");
    expect(mocks.mockPlanLimitDelete).toHaveBeenCalledWith({
      where: { id: "lim1" },
    });
  });

  it("returns 404 when deleting a limit that does not belong to the plan", async () => {
    superAdmin();
    mocks.mockPlanLimitFindFirst.mockResolvedValue(null);

    const res = await deleteLimit(
      makeRequest("http://x/api/admin/plans/p1/limits/other", "DELETE"),
      { params: { id: "p1", limitId: "other" } } as never
    );

    expect(res.status).toBe(404);
    expect(mocks.mockPlanLimitDelete).not.toHaveBeenCalled();
  });
});
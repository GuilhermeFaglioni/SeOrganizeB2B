import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetSuperAdminStatus: vi.fn(),
  mockWorkspaceFindMany: vi.fn(),
  mockWorkspaceFindFirst: vi.fn(),
  mockWorkspaceUpdate: vi.fn(),
  mockProfileFindMany: vi.fn(),
  mockPlanFindUnique: vi.fn(),
  mockCountWorkspaceUsage: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("@/lib/admin/super-admin", () => ({
  getSuperAdminStatus: mocks.mockGetSuperAdminStatus,
}));

vi.mock("@/lib/features", () => ({
  countWorkspaceUsage: mocks.mockCountWorkspaceUsage,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    workspace: {
      findMany: mocks.mockWorkspaceFindMany,
      findFirst: mocks.mockWorkspaceFindFirst,
      update: mocks.mockWorkspaceUpdate,
    },
    profile: { findMany: mocks.mockProfileFindMany },
    plan: { findUnique: mocks.mockPlanFindUnique },
  },
  withTenant: vi.fn(async (_tenantId: string, fn: () => unknown) => fn()),
  withTenantBypass: vi.fn(async (fn: () => unknown) => fn()),
}));

import { GET as listTenants } from "../app/api/admin/tenants/route";
import {
  GET as getTenant,
  PATCH as patchTenant,
  DELETE as deleteTenant,
} from "../app/api/admin/tenants/[id]/route";

const makeUser = () => ({ id: "admin_1", email: "admin@example.com" });

const makeWorkspace = (overrides: Record<string, unknown> = {}) => ({
  id: "ws_1",
  name: "Acme",
  slug: "acme",
  logoUrl: null,
  companyName: null,
  status: "active",
  gracePeriodEndsAt: null,
  cancelledAt: null,
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  planId: "plan_1",
  plan: { id: "plan_1", name: "Pro", isActive: true },
  ...overrides,
});

const makeRequest = (body?: unknown) =>
  new NextRequest("http://x/api/admin/tenants/ws_1", {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const params = { params: { id: "ws_1" } };

const USAGE = {
  users: 3,
  tasks: 12,
  projects: 4,
  contracts: 1,
  clients: 2,
  proposals: 0,
  documents: 5,
  calendarEvents: 0,
};

function resetMocks() {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.mockGetUser.mockResolvedValue(makeUser());
  mocks.mockGetSuperAdminStatus.mockResolvedValue(true);
  mocks.mockCountWorkspaceUsage.mockResolvedValue(USAGE);
}

beforeEach(resetMocks);

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/tenants", () => {
  it("lists active workspaces with plan and usage", async () => {
    mocks.mockWorkspaceFindMany.mockResolvedValue([
      makeWorkspace(),
      makeWorkspace({
        id: "ws_2",
        name: "Beta",
        slug: "beta",
        plan: { id: "plan_2", name: "Free" },
      }),
    ]);

    const res = await listTenants();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.error).toBeNull();
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toMatchObject({
      id: "ws_1",
      name: "Acme",
      slug: "acme",
      status: "active",
      plan: { id: "plan_1", name: "Pro" },
      usage: { users: 3, tasks: 12, projects: 4 },
    });

    expect(mocks.mockWorkspaceFindMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { plan: { select: { id: true, name: true } } },
    });
    expect(mocks.mockCountWorkspaceUsage).toHaveBeenCalledWith("ws_1");
    expect(mocks.mockCountWorkspaceUsage).toHaveBeenCalledWith("ws_2");
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.mockGetUser.mockResolvedValue(null);
    const res = await listTenants();
    expect(res.status).toBe(401);
    expect(mocks.mockWorkspaceFindMany).not.toHaveBeenCalled();
  });

  it("returns 403 for non-super-admins", async () => {
    mocks.mockGetSuperAdminStatus.mockResolvedValue(false);
    const res = await listTenants();
    expect(res.status).toBe(403);
    expect(mocks.mockWorkspaceFindMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/tenants/[id]", () => {
  it("returns full workspace details with profiles and usage", async () => {
    mocks.mockWorkspaceFindFirst.mockResolvedValue(makeWorkspace());
    mocks.mockProfileFindMany.mockResolvedValue([
      {
        id: "p_1",
        email: "owner@acme.com",
        name: "Owner",
        avatarUrl: null,
        role: { id: "r_1", name: "Admin" },
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);

    const res = await getTenant(new NextRequest("http://x"), params);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.id).toBe("ws_1");
    expect(json.data.plan).toEqual({ id: "plan_1", name: "Pro", isActive: true });
    expect(json.data.profiles).toHaveLength(1);
    expect(json.data.profiles[0].email).toBe("owner@acme.com");
    expect(json.data.usage).toEqual(USAGE);

    expect(mocks.mockWorkspaceFindFirst).toHaveBeenCalledWith({
      where: { id: "ws_1", deletedAt: null },
      include: { plan: true },
    });
  });

  it("returns 404 when the tenant does not exist", async () => {
    mocks.mockWorkspaceFindFirst.mockResolvedValue(null);
    const res = await getTenant(new NextRequest("http://x"), params);
    expect(res.status).toBe(404);
    expect(mocks.mockProfileFindMany).not.toHaveBeenCalled();
  });

  it("returns 403 for non-super-admins", async () => {
    mocks.mockGetSuperAdminStatus.mockResolvedValue(false);
    const res = await getTenant(new NextRequest("http://x"), params);
    expect(res.status).toBe(403);
    expect(mocks.mockWorkspaceFindFirst).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/tenants/[id]", () => {
  it("changes the tenant status", async () => {
    mocks.mockWorkspaceFindFirst.mockResolvedValue(makeWorkspace());
    mocks.mockWorkspaceUpdate.mockResolvedValue(
      makeWorkspace({ status: "grace_period" })
    );

    const res = await patchTenant(makeRequest({ status: "grace_period" }), params);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.status).toBe("grace_period");
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { status: "grace_period" },
    });
  });

  it("changes the tenant plan after validating it is active", async () => {
    mocks.mockWorkspaceFindFirst.mockResolvedValue(makeWorkspace());
    mocks.mockPlanFindUnique.mockResolvedValue({ id: "plan_2", isActive: true });
    mocks.mockWorkspaceUpdate.mockResolvedValue(
      makeWorkspace({ planId: "plan_2" })
    );

    const res = await patchTenant(makeRequest({ planId: "plan_2" }), params);
    expect(res.status).toBe(200);
    expect(mocks.mockPlanFindUnique).toHaveBeenCalledWith({
      where: { id: "plan_2" },
      select: { id: true, isActive: true },
    });
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { planId: "plan_2" },
    });
  });

  it("extends the grace period by 3 days from the current end date", async () => {
    const gracePeriodEndsAt = new Date("2026-06-01T12:00:00Z");
    mocks.mockWorkspaceFindFirst.mockResolvedValue(
      makeWorkspace({ gracePeriodEndsAt })
    );
    mocks.mockWorkspaceUpdate.mockResolvedValue(
      makeWorkspace({ gracePeriodEndsAt: new Date(gracePeriodEndsAt.getTime() + 3 * 24 * 60 * 60 * 1000) })
    );

    const res = await patchTenant(makeRequest({ extendGracePeriod: true }), params);
    expect(res.status).toBe(200);

    const expected = new Date(gracePeriodEndsAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { gracePeriodEndsAt: expected },
    });
  });

  it("sets the grace period to now + 3 days when no end date exists", async () => {
    const before = Date.now();
    mocks.mockWorkspaceFindFirst.mockResolvedValue(makeWorkspace());
    mocks.mockWorkspaceUpdate.mockResolvedValue(makeWorkspace());

    const res = await patchTenant(makeRequest({ extendGracePeriod: true }), params);
    expect(res.status).toBe(200);

    const [arg] = mocks.mockWorkspaceUpdate.mock.calls[0] as [
      { data: { gracePeriodEndsAt?: Date } }
    ];
    const grace = arg.data.gracePeriodEndsAt!.getTime();
    expect(grace).toBeGreaterThanOrEqual(before + 3 * 24 * 60 * 60 * 1000);
    expect(grace).toBeLessThanOrEqual(Date.now() + 3 * 24 * 60 * 60 * 1000);
  });

  it("returns 400 for an invalid status", async () => {
    mocks.mockWorkspaceFindFirst.mockResolvedValue(makeWorkspace());
    const res = await patchTenant(makeRequest({ status: "bogus" }), params);
    expect(res.status).toBe(400);
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when the plan does not exist or is inactive", async () => {
    mocks.mockWorkspaceFindFirst.mockResolvedValue(makeWorkspace());
    mocks.mockPlanFindUnique.mockResolvedValue(null);
    const res = await patchTenant(makeRequest({ planId: "missing" }), params);
    expect(res.status).toBe(400);
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the tenant does not exist", async () => {
    mocks.mockWorkspaceFindFirst.mockResolvedValue(null);
    const res = await patchTenant(makeRequest({ status: "cancelled" }), params);
    expect(res.status).toBe(404);
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 for non-super-admins", async () => {
    mocks.mockGetSuperAdminStatus.mockResolvedValue(false);
    const res = await patchTenant(makeRequest({ status: "cancelled" }), params);
    expect(res.status).toBe(403);
    expect(mocks.mockWorkspaceFindFirst).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/tenants/[id]", () => {
  it("soft deletes an active tenant and cancels it", async () => {
    mocks.mockWorkspaceFindFirst.mockResolvedValue(makeWorkspace());
    mocks.mockWorkspaceUpdate.mockResolvedValue(
      makeWorkspace({ status: "cancelled", deletedAt: new Date() })
    );

    const res = await deleteTenant(new NextRequest("http://x"), params);
    expect(res.status).toBe(200);

    const [arg] = mocks.mockWorkspaceUpdate.mock.calls[0] as [
      { data: { deletedAt?: Date; status?: string; cancelledAt?: Date } }
    ];
    expect(arg.data.deletedAt).toBeInstanceOf(Date);
    expect(arg.data.status).toBe("cancelled");
    expect(arg.data.cancelledAt).toBeInstanceOf(Date);
  });

  it("soft deletes a non-active tenant without changing its status", async () => {
    mocks.mockWorkspaceFindFirst.mockResolvedValue(
      makeWorkspace({ status: "grace_period" })
    );
    mocks.mockWorkspaceUpdate.mockResolvedValue(
      makeWorkspace({ status: "grace_period", deletedAt: new Date() })
    );

    const res = await deleteTenant(new NextRequest("http://x"), params);
    expect(res.status).toBe(200);

    const [arg] = mocks.mockWorkspaceUpdate.mock.calls[0] as [
      { data: { deletedAt?: Date; status?: string; cancelledAt?: Date } }
    ];
    expect(arg.data.deletedAt).toBeInstanceOf(Date);
    expect(arg.data.status).toBeUndefined();
    expect(arg.data.cancelledAt).toBeUndefined();
  });

  it("returns 404 when the tenant does not exist", async () => {
    mocks.mockWorkspaceFindFirst.mockResolvedValue(null);
    const res = await deleteTenant(new NextRequest("http://x"), params);
    expect(res.status).toBe(404);
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 for non-super-admins", async () => {
    mocks.mockGetSuperAdminStatus.mockResolvedValue(false);
    const res = await deleteTenant(new NextRequest("http://x"), params);
    expect(res.status).toBe(403);
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });
});
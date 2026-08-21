import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { TenantContext } from "@/lib/authz/tenant-context";

const mocks = vi.hoisted(() => ({
  mockDenyFor: vi.fn(),
  mockGetEffectivePermissions: vi.fn(),
  mockRoleFindUnique: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockProfileUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "admin-1", email: "admin@b.c" }),
}));

vi.mock("@/lib/authz/authz", () => ({
  denyFor: mocks.mockDenyFor,
  getEffectivePermissions: mocks.mockGetEffectivePermissions,
  hasPermission: vi.fn(() => true),
  can: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    role: {
      findUnique: mocks.mockRoleFindUnique,
    },
    profile: {
      findUnique: mocks.mockProfileFindUnique,
      update: mocks.mockProfileUpdate,
    },
  },
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
  withTenantBypass: (fn: () => unknown) => fn(),
  requireTenantId: () => "tenant-1",
  getTenantId: () => "tenant-1",
}));

vi.mock("@/lib/authz/tenant-context", () => ({
  getTenantContext: vi.fn(),
}));

import { getTenantContext } from "@/lib/authz/tenant-context";
import { PATCH as assignRolePATCH } from "../app/api/profiles/[id]/role/route";

const makeRequest = (url: string, body?: unknown) =>
  new NextRequest(url, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const adminContext: TenantContext = {
  tenantId: "tenant-1",
  workspaceStatus: "active",
  gracePeriodEndsAt: null,
  cancelledAt: null,
  isAdmin: true,
};

const memberContext: TenantContext = {
  tenantId: "tenant-1",
  workspaceStatus: "active",
  gracePeriodEndsAt: null,
  cancelledAt: null,
  isAdmin: false,
};

describe("PATCH /api/profiles/[id]/role — multi-tenant role assignment", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockDenyFor.mockResolvedValue(null);
    vi.mocked(getTenantContext).mockResolvedValue(adminContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("assigns a role to a member of the same tenant", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue({
      id: "member-1",
      tenantId: "tenant-1",
    });
    mocks.mockRoleFindUnique.mockResolvedValue({
      id: "r1",
      name: "Editor",
      tenantId: "tenant-1",
      isAdmin: false,
    });
    mocks.mockProfileUpdate.mockResolvedValue({
      id: "member-1",
      tenantId: "tenant-1",
      roleId: "r1",
    });

    const res = await assignRolePATCH(
      makeRequest("http://x/api/profiles/member-1/role", { roleId: "r1" }),
      { params: Promise.resolve({ id: "member-1" }) }
    );

    expect(res.status).toBe(200);
    expect(mocks.mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "member-1" },
        data: { roleId: "r1" },
      })
    );
    const json = await res.json();
    expect(json.data.roleId).toBe("r1");
  });

  it("returns 403 when the requester is not a tenant admin", async () => {
    vi.mocked(getTenantContext).mockResolvedValue(memberContext);

    const res = await assignRolePATCH(
      makeRequest("http://x/api/profiles/member-1/role", { roleId: "r1" }),
      { params: Promise.resolve({ id: "member-1" }) }
    );

    expect(res.status).toBe(403);
    expect(mocks.mockProfileFindUnique).not.toHaveBeenCalled();
    expect(mocks.mockProfileUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when the role belongs to another tenant", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue({
      id: "member-1",
      tenantId: "tenant-1",
    });
    mocks.mockRoleFindUnique.mockResolvedValue({
      id: "r2",
      name: "Editor",
      tenantId: "tenant-2",
      isAdmin: false,
    });

    const res = await assignRolePATCH(
      makeRequest("http://x/api/profiles/member-1/role", { roleId: "r2" }),
      { params: Promise.resolve({ id: "member-1" }) }
    );

    expect(res.status).toBe(400);
    expect(mocks.mockProfileUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when the role does not exist in the tenant", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue({
      id: "member-1",
      tenantId: "tenant-1",
    });
    mocks.mockRoleFindUnique.mockResolvedValue(null);

    const res = await assignRolePATCH(
      makeRequest("http://x/api/profiles/member-1/role", { roleId: "r1" }),
      { params: Promise.resolve({ id: "member-1" }) }
    );

    expect(res.status).toBe(400);
    expect(mocks.mockProfileUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the profile does not exist", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(null);

    const res = await assignRolePATCH(
      makeRequest("http://x/api/profiles/ghost/role", { roleId: "r1" }),
      { params: Promise.resolve({ id: "ghost" }) }
    );

    expect(res.status).toBe(404);
    expect(mocks.mockRoleFindUnique).not.toHaveBeenCalled();
    expect(mocks.mockProfileUpdate).not.toHaveBeenCalled();
  });

  it("returns 404 when the profile belongs to another tenant", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue({
      id: "member-9",
      tenantId: "tenant-2",
    });

    const res = await assignRolePATCH(
      makeRequest("http://x/api/profiles/member-9/role", { roleId: "r1" }),
      { params: Promise.resolve({ id: "member-9" }) }
    );

    expect(res.status).toBe(404);
    expect(mocks.mockProfileUpdate).not.toHaveBeenCalled();
  });

  it("allows an admin to clear a member's role", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue({
      id: "member-1",
      tenantId: "tenant-1",
    });
    mocks.mockProfileUpdate.mockResolvedValue({
      id: "member-1",
      tenantId: "tenant-1",
      roleId: null,
    });

    const res = await assignRolePATCH(
      makeRequest("http://x/api/profiles/member-1/role", { roleId: null }),
      { params: Promise.resolve({ id: "member-1" }) }
    );

    expect(res.status).toBe(200);
    expect(mocks.mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "member-1" },
        data: { roleId: null },
      })
    );
    expect(mocks.mockRoleFindUnique).not.toHaveBeenCalled();
  });
});

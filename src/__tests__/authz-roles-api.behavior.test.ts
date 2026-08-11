import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  mockDenyFor: vi.fn(),
  mockGetEffectivePermissions: vi.fn(),
  mockRoleFindMany: vi.fn(),
  mockRoleFindUnique: vi.fn(),
  mockRoleCreate: vi.fn(),
  mockRoleUpdate: vi.fn(),
  mockRoleDelete: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockWorkspaceUpsert: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockProfileUpdate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "a@b.c" }),
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
      findMany: mocks.mockRoleFindMany,
      findUnique: mocks.mockRoleFindUnique,
      create: mocks.mockRoleCreate,
      update: mocks.mockRoleUpdate,
      delete: mocks.mockRoleDelete,
    },
    workspace: {
      findUnique: mocks.mockWorkspaceFindUnique,
      upsert: mocks.mockWorkspaceUpsert,
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
  getTenantContext: vi.fn().mockResolvedValue({
    tenantId: "tenant-1",
    workspaceStatus: "active",
    gracePeriodEndsAt: null,
    cancelledAt: null,
    isAdmin: true,
  }),
}));

import { getTenantContext } from "@/lib/authz/tenant-context";
import { GET as listRolesGET, POST as createRolePOST } from "../app/api/roles/route";
import { PATCH as setDefaultPATCH } from "../app/api/roles/default/route";
import { PATCH as assignRolePATCH } from "../app/api/profiles/[id]/role/route";

const makeRequest = (url: string, body?: unknown, method?: string) =>
  new NextRequest(url, {
    method: method ?? (body !== undefined ? "POST" : "GET"),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

describe("roles API", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockDenyFor.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists roles for a manager scoped to their tenant", async () => {
    mocks.mockRoleFindMany.mockResolvedValue([
      { id: "r1", name: "Editor", permissions: ["tasks.view"], isAdmin: false, createdAt: "", updatedAt: "", _count: { profiles: 1 } },
    ]);
    mocks.mockWorkspaceFindUnique.mockResolvedValue({ defaultRoleId: "r1" });
    const res = await listRolesGET();
    expect(res.status).toBe(200);
    expect(mocks.mockRoleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-1" }),
      })
    );
    const json = await res.json();
    expect(json.data[0].name).toBe("Editor");
    expect(json.data[0].isDefault).toBe(true);
  });

  it("returns 403 when the user lacks manage_roles", async () => {
    mocks.mockDenyFor.mockResolvedValue(
      new NextResponse(null, { status: 403 })
    );
    const res = await listRolesGET();
    expect(res.status).toBe(403);
    expect(mocks.mockRoleFindMany).not.toHaveBeenCalled();
  });

  it("creates a role and sanitizes permissions", async () => {
    mocks.mockRoleCreate.mockResolvedValue({ id: "r2", name: "Financeiro" });
    const res = await createRolePOST(
      makeRequest("http://x/api/roles", {
        name: "Financeiro",
        permissions: ["financial.contracts.view", "not-valid"],
      })
    );
    expect(res.status).toBe(201);
    expect(mocks.mockRoleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Financeiro",
          tenantId: "tenant-1",
          permissions: [
            { resource: "financial.contracts", action: "view", scope: "all" },
          ],
        }),
      })
    );
  });

  it("sets the default role", async () => {
    mocks.mockRoleFindUnique.mockResolvedValue({ id: "r1", isAdmin: false });
    mocks.mockWorkspaceUpsert.mockResolvedValue({ id: "default", defaultRoleId: "r1" });
    const res = await setDefaultPATCH(
      makeRequest("http://x/api/roles/default", { roleId: "r1" })
    );
    expect(res.status).toBe(200);
    expect(mocks.mockWorkspaceUpsert).toHaveBeenCalled();
  });

  it("rejects assigning a role by a non-tenant-admin", async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      tenantId: "tenant-1",
      workspaceStatus: "active",
      gracePeriodEndsAt: null,
      cancelledAt: null,
      isAdmin: false,
    });
    const res = await assignRolePATCH(
      makeRequest("http://x/api/profiles/u1/role", { roleId: "admin" }),
      { params: { id: "u1" } }
    );
    expect(res.status).toBe(403);
    expect(mocks.mockProfileFindUnique).not.toHaveBeenCalled();
    expect(mocks.mockProfileUpdate).not.toHaveBeenCalled();
  });

  it("allows an admin to assign the Admin role", async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      tenantId: "tenant-1",
      workspaceStatus: "active",
      gracePeriodEndsAt: null,
      cancelledAt: null,
      isAdmin: true,
    });
    mocks.mockRoleFindUnique.mockResolvedValue({
      id: "admin",
      name: "Admin",
      isAdmin: true,
      tenantId: "tenant-1",
    });
    mocks.mockProfileFindUnique.mockResolvedValue({
      id: "u1",
      tenantId: "tenant-1",
    });
    mocks.mockProfileUpdate.mockResolvedValue({
      id: "u1",
      roleId: "admin",
      tenantId: "tenant-1",
    });
    const res = await assignRolePATCH(
      makeRequest("http://x/api/profiles/u1/role", { roleId: "admin" }),
      { params: { id: "u1" } }
    );
    expect(res.status).toBe(200);
    expect(mocks.mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { roleId: "admin" } })
    );
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { TenantContext } from "@/lib/authz/tenant-context";

const mocks = vi.hoisted(() => ({
  mockDenyFor: vi.fn(),
  mockRoleFindMany: vi.fn(),
  mockRoleFindUnique: vi.fn(),
  mockRoleCreate: vi.fn(),
  mockRoleUpdate: vi.fn(),
  mockRoleDelete: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "a@b.c" }),
}));

vi.mock("@/lib/authz/authz", () => ({
  denyFor: mocks.mockDenyFor,
  getEffectivePermissions: vi.fn(),
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
import { GET as listRolesGET, POST as createRolePOST } from "../app/api/roles/route";
import {
  PATCH as updateRolePATCH,
  DELETE as deleteRoleDELETE,
} from "../app/api/roles/[id]/route";

const makeRequest = (url: string, body?: unknown, method?: string) =>
  new NextRequest(url, {
    method: method ?? (body !== undefined ? "POST" : "GET"),
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

describe("roles API multi-tenant", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockDenyFor.mockResolvedValue(null);
    vi.mocked(getTenantContext).mockResolvedValue(adminContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET lists only the user's tenant roles", async () => {
    mocks.mockRoleFindMany.mockResolvedValue([
      { id: "r1", name: "Editor", tenantId: "tenant-1", permissions: [], isAdmin: false, createdAt: "", updatedAt: "", _count: { profiles: 1 } },
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
    expect(json.data).toHaveLength(1);
    expect(json.data[0].tenantId).toBe("tenant-1");
  });

  it("GET returns 400 when the user has no workspace", async () => {
    vi.mocked(getTenantContext).mockResolvedValue({
      ...adminContext,
      tenantId: null,
    });

    const res = await listRolesGET();

    expect(res.status).toBe(400);
    expect(mocks.mockRoleFindMany).not.toHaveBeenCalled();
  });

  it("POST creates a role with the user's tenantId", async () => {
    mocks.mockRoleCreate.mockResolvedValue({ id: "r2", name: "Financeiro", tenantId: "tenant-1" });

    const res = await createRolePOST(
      makeRequest("http://x/api/roles", { name: "Financeiro", permissions: [] })
    );

    expect(res.status).toBe(201);
    expect(mocks.mockRoleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Financeiro",
          tenantId: "tenant-1",
        }),
      })
    );
  });

  it("POST returns 403 when a non-admin tries to create a role", async () => {
    vi.mocked(getTenantContext).mockResolvedValue(memberContext);

    const res = await createRolePOST(
      makeRequest("http://x/api/roles", { name: "Financeiro", permissions: [] })
    );

    expect(res.status).toBe(403);
    expect(mocks.mockRoleCreate).not.toHaveBeenCalled();
  });

  it("PATCH rejects editing the Admin role", async () => {
    mocks.mockRoleFindUnique.mockResolvedValue({
      id: "admin",
      name: "Admin",
      isAdmin: true,
      permissions: [],
    });

    const res = await updateRolePATCH(
      makeRequest("http://x/api/roles/admin", { name: "Super Admin" }, "PATCH"),
      { params: Promise.resolve({ id: "admin" }) }
    );

    expect(res.status).toBe(400);
    expect(mocks.mockRoleUpdate).not.toHaveBeenCalled();
  });

  it("DELETE rejects deleting the Admin role", async () => {
    mocks.mockRoleFindUnique.mockResolvedValue({
      id: "admin",
      name: "Admin",
      isAdmin: true,
      permissions: [],
    });

    const res = await deleteRoleDELETE(
      makeRequest("http://x/api/roles/admin", undefined, "DELETE"),
      { params: Promise.resolve({ id: "admin" }) }
    );

    expect(res.status).toBe(400);
    expect(mocks.mockRoleDelete).not.toHaveBeenCalled();
  });

  it("PATCH allows editing a non-admin role within the tenant", async () => {
    mocks.mockRoleFindUnique.mockResolvedValue({
      id: "r1",
      name: "Editor",
      isAdmin: false,
      permissions: [],
    });
    mocks.mockRoleUpdate.mockResolvedValue({ id: "r1", name: "Editor Plus" });

    const res = await updateRolePATCH(
      makeRequest("http://x/api/roles/r1", { name: "Editor Plus" }, "PATCH"),
      { params: Promise.resolve({ id: "r1" }) }
    );

    expect(res.status).toBe(200);
    expect(mocks.mockRoleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: expect.objectContaining({ name: "Editor Plus" }),
      })
    );
  });
});
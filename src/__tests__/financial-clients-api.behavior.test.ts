import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    client: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../prisma/client", () => ({
  prisma: mockPrisma,
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

vi.mock("@/lib/authz/authz", () => ({
  denyFor: vi.fn().mockResolvedValue(null),
  getEffectivePermissions: vi.fn().mockResolvedValue({
    isAdmin: true,
    roleId: 'admin',
    roleName: 'Admin',
    permissions: [],
  }),
  can: vi.fn().mockResolvedValue(true),
  hasPermission: vi.fn().mockReturnValue(true),
  canViewResource: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "a@b.c" }),
}));

import { GET as listClients } from "../app/api/clients/route";
import {
  GET as getClient,
  PATCH as patchClient,
} from "../app/api/clients/[id]/route";

const makeRequest = (url: string, body?: unknown) =>
  new NextRequest(url, {
    method: body !== undefined ? "POST" : "GET",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

describe("clients API route behavior", () => {
  beforeEach(() => {
    mockPrisma.client.findMany.mockReset();
    mockPrisma.client.count.mockReset();
    mockPrisma.client.create.mockReset();
    mockPrisma.client.findUnique.mockReset();
    mockPrisma.client.update.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for an empty PATCH name without calling update", async () => {
    const res = await patchClient(makeRequest("http://x/api/clients/c1", { name: "   " }), {
      params: { id: "c1" },
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-string PATCH name without calling update", async () => {
    const res = await patchClient(makeRequest("http://x/api/clients/c1", { name: 42 }), {
      params: { id: "c1" },
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(mockPrisma.client.update).not.toHaveBeenCalled();
  });

  it("trims a valid PATCH name and updates", async () => {
    mockPrisma.client.update.mockResolvedValue({
      id: "c1",
      name: "Acme",
      active: true,
    });
    const res = await patchClient(makeRequest("http://x/api/clients/c1", { name: "  Acme  " }), {
      params: { id: "c1" },
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.client.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({ name: "Acme" }),
    });
  });

  it("defaults invalid pagination to page 1 and pageSize 25", async () => {
    mockPrisma.client.findMany.mockResolvedValue([]);
    mockPrisma.client.count.mockResolvedValue(0);

    const res = await listClients(makeRequest("http://x/api/clients?page=abc&pageSize=xyz"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.page).toBe(1);
    expect(json.data.pageSize).toBe(25);
    expect(json.data.totalPages).toBe(1);

    const findManyArgs = mockPrisma.client.findMany.mock.calls[0][0];
    expect(findManyArgs.skip).toBe(0);
    expect(findManyArgs.take).toBe(25);
  });

  it("clamps pageSize above the max to 50", async () => {
    mockPrisma.client.findMany.mockResolvedValue([]);
    mockPrisma.client.count.mockResolvedValue(0);

    const res = await listClients(makeRequest("http://x/api/clients?page=1&pageSize=999"));
    const json = await res.json();
    expect(json.data.pageSize).toBe(50);
  });

  it("requires authentication on list", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await listClients(makeRequest("http://x/api/clients"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when a client is not found", async () => {
    mockPrisma.client.findUnique.mockResolvedValue(null);
    const res = await getClient(makeRequest("http://x/api/clients/missing"), {
      params: { id: "missing" },
    });
    expect(res.status).toBe(404);
  });

  it("filters active clients when active=true", async () => {
    mockPrisma.client.findMany.mockResolvedValue([{ id: "c1", name: "A", active: true }]);
    mockPrisma.client.count.mockResolvedValue(1);

    await listClients(makeRequest("http://x/api/clients?active=true"));

    const where = mockPrisma.client.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ active: true });
    const countWhere = mockPrisma.client.count.mock.calls[0][0].where;
    expect(countWhere).toEqual({ active: true });
  });

  it("filters inactive clients when active=false", async () => {
    mockPrisma.client.findMany.mockResolvedValue([{ id: "c2", name: "B", active: false }]);
    mockPrisma.client.count.mockResolvedValue(1);

    await listClients(makeRequest("http://x/api/clients?active=false"));

    const where = mockPrisma.client.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ active: false });
    const countWhere = mockPrisma.client.count.mock.calls[0][0].where;
    expect(countWhere).toEqual({ active: false });
  });

  it("returns all clients when active=all (no active predicate)", async () => {
    mockPrisma.client.findMany.mockResolvedValue([]);
    mockPrisma.client.count.mockResolvedValue(0);

    await listClients(makeRequest("http://x/api/clients?active=all"));

    const where = mockPrisma.client.findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("active");
    const countWhere = mockPrisma.client.count.mock.calls[0][0].where;
    expect(countWhere).not.toHaveProperty("active");
  });

  it("defaults to active-only when active param is omitted (backward compat)", async () => {
    mockPrisma.client.findMany.mockResolvedValue([]);
    mockPrisma.client.count.mockResolvedValue(0);

    await listClients(makeRequest("http://x/api/clients"));

    const where = mockPrisma.client.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ active: true });
  });

  it("defaults to active-only for unrecognized active values (backward compat)", async () => {
    mockPrisma.client.findMany.mockResolvedValue([]);
    mockPrisma.client.count.mockResolvedValue(0);

    await listClients(makeRequest("http://x/api/clients?active=garbage"));

    const where = mockPrisma.client.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ active: true });
  });
});

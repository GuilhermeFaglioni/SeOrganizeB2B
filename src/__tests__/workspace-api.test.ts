import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetEffectivePermissions: vi.fn(),
  mockDenyFor: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockProfileCount: vi.fn(),
  mockTaskCount: vi.fn(),
  mockProjectCount: vi.fn(),
  mockContractCount: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockWorkspaceFindFirst: vi.fn(),
  mockWorkspaceUpdate: vi.fn(),
  mockWithTenant: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("@/lib/authz/authz", () => ({
  getEffectivePermissions: mocks.mockGetEffectivePermissions,
  denyFor: mocks.mockDenyFor,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: {
      findUnique: mocks.mockProfileFindUnique,
      count: mocks.mockProfileCount,
    },
    task: { count: mocks.mockTaskCount },
    project: { count: mocks.mockProjectCount },
    contract: { count: mocks.mockContractCount },
    role: { findFirst: mocks.mockRoleFindFirst },
    workspace: {
      findFirst: mocks.mockWorkspaceFindFirst,
      update: mocks.mockWorkspaceUpdate,
    },
  },
  withTenant: mocks.mockWithTenant,
  withTenantBypass: vi.fn(async (fn: () => unknown) => fn()),
}));

import { GET, PATCH } from "../app/api/workspace/route";

const makeRequest = (body?: unknown) =>
  new NextRequest("http://x/api/workspace", {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });

const makeUser = () => ({ id: "user_1", email: "owner@acme.com" });

const makeProfile = () => ({
  tenant: {
    id: "ws_1",
    name: "Acme",
    slug: "acme",
    logoUrl: null,
    companyName: "Acme Inc",
    onboardingCompleted: true,
    status: "active",
    gracePeriodEndsAt: null,
    plan: {
      id: "plan_1",
      name: "Pro",
      allowedModules: ["tasks", "projects", "contracts"],
      planLimits: [
        { resource: "users", limit: 5, behavior: "hard" },
        { resource: "tasks", limit: 100, behavior: "warning" },
      ],
    },
  },
});

describe("GET /api/workspace", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => {
      if (typeof mock === "function") mock.mockReset();
    });
    mocks.mockGetUser.mockResolvedValue(makeUser());
    mocks.mockWithTenant.mockImplementation(async (_tenantId: string, fn: () => unknown) => fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns workspace data with plan, limits and real-time usage", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(makeProfile());
    mocks.mockProfileCount.mockResolvedValue(2);
    mocks.mockTaskCount.mockResolvedValue(13);
    mocks.mockProjectCount.mockResolvedValue(5);
    mocks.mockContractCount.mockResolvedValue(0);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.id).toBe("ws_1");
    expect(json.data.name).toBe("Acme");
    expect(json.data.slug).toBe("acme");
    expect(json.data.status).toBe("active");
    expect(json.data.onboardingCompleted).toBe(true);
    expect(json.data.plan).toEqual({
      id: "plan_1",
      name: "Pro",
      allowedModules: ["tasks", "projects", "contracts"],
    });
    expect(json.data.features.allowedModules).toEqual([
      "tasks",
      "projects",
      "contracts",
    ]);
    expect(json.data.features.usage).toEqual({
      users: 2,
      tasks: 13,
      projects: 5,
      contracts: 0,
    });
    expect(json.data.features.limits).toEqual({
      users: { limit: 5, remaining: 3, behavior: "hard" },
      tasks: { limit: 100, remaining: 87, behavior: "warning" },
    });

    expect(mocks.mockWithTenant).toHaveBeenCalledWith("ws_1", expect.any(Function));
    expect(mocks.mockProfileCount).toHaveBeenCalledWith({
      where: { tenantId: "ws_1" },
    });
    expect(mocks.mockTaskCount).toHaveBeenCalledWith({
      where: { tenantId: "ws_1" },
    });
    expect(mocks.mockContractCount).toHaveBeenCalledWith({
      where: { tenantId: "ws_1" },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.mockGetUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mocks.mockProfileFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the user has no workspace", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
    expect(mocks.mockTaskCount).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/workspace", () => {
  const makeAdmin = () => ({
    isAdmin: true,
    roleId: "r_admin",
    roleName: "Admin",
    permissions: [],
  });

  beforeEach(() => {
    Object.values(mocks).forEach((mock) => {
      if (typeof mock === "function") mock.mockReset();
    });
    mocks.mockGetUser.mockResolvedValue(makeUser());
    mocks.mockGetEffectivePermissions.mockResolvedValue(makeAdmin());
    mocks.mockDenyFor.mockResolvedValue(null);
    mocks.mockWithTenant.mockImplementation(async (_tenantId: string, fn: () => unknown) => fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates the workspace when the caller is an admin", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(makeProfile());
    mocks.mockWorkspaceFindFirst.mockResolvedValue(null);
    mocks.mockWorkspaceUpdate.mockResolvedValue({
      id: "ws_1",
      name: "Acme 2",
      slug: "acme-2",
      logoUrl: "https://cdn.example.com/logo.png",
      companyName: "Acme Inc",
    });

    const res = await PATCH(
      makeRequest({
        name: "Acme 2",
        slug: "acme-2",
        companyName: "Acme Inc",
        logoUrl: "https://cdn.example.com/logo.png",
      })
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.name).toBe("Acme 2");
    expect(json.data.slug).toBe("acme-2");

    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: {
        name: "Acme 2",
        slug: "acme-2",
        companyName: "Acme Inc",
        logoUrl: "https://cdn.example.com/logo.png",
      },
    });
  });

  it("returns 403 when the caller is not an admin", async () => {
    mocks.mockGetEffectivePermissions.mockResolvedValue({
      isAdmin: false,
      roleId: "r1",
      roleName: "Editor",
      permissions: [],
    });

    const res = await PATCH(makeRequest({ name: "Acme 2" }));
    expect(res.status).toBe(403);
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
    expect(mocks.mockProfileFindUnique).not.toHaveBeenCalled();
  });

  it("returns the check-in block before mutating a workspace", async () => {
    mocks.mockDenyFor.mockResolvedValue(new Response(null, { status: 403 }));

    const res = await PATCH(makeRequest({ name: "Acme 2" }));

    expect(res.status).toBe(403);
    expect(mocks.mockDenyFor).toHaveBeenCalledWith("user_1", "manage_roles");
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("returns 409 when the slug is already used by another workspace", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(makeProfile());
    mocks.mockWorkspaceFindFirst.mockResolvedValue({ id: "ws_2", slug: "acme-2" });

    const res = await PATCH(makeRequest({ slug: "acme-2" }));
    expect(res.status).toBe(409);
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when defaultRoleId is not a role of the workspace tenant", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(makeProfile());
    mocks.mockRoleFindFirst.mockResolvedValue(null);

    const res = await PATCH(makeRequest({ defaultRoleId: "r_other" }));
    expect(res.status).toBe(400);
    expect(mocks.mockWithTenant).toHaveBeenCalledWith("ws_1", expect.any(Function));
    expect(mocks.mockRoleFindFirst).toHaveBeenCalledWith({
      where: { id: "r_other", tenantId: "ws_1" },
    });
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });

  it("accepts a defaultRoleId that belongs to the workspace tenant", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(makeProfile());
    mocks.mockRoleFindFirst.mockResolvedValue({
      id: "r1",
      name: "Editor",
      tenantId: "ws_1",
    });
    mocks.mockWorkspaceUpdate.mockResolvedValue({
      id: "ws_1",
      defaultRoleId: "r1",
    });

    const res = await PATCH(makeRequest({ defaultRoleId: "r1" }));
    expect(res.status).toBe(200);
    expect(mocks.mockWorkspaceUpdate).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      data: { defaultRoleId: "r1" },
    });
  });

  it("returns 400 when a body field fails validation", async () => {
    const res = await PATCH(makeRequest({ name: 123 }));
    expect(res.status).toBe(400);
    expect(mocks.mockWorkspaceUpdate).not.toHaveBeenCalled();
  });
});

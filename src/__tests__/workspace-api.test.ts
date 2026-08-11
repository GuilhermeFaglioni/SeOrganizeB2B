import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetEffectivePermissions: vi.fn(),
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

import { GET } from "../app/api/workspace/route";

const makeUser = () => ({ id: "user_1", email: "owner@acme.com" });

const makeProfile = () => ({
  tenant: {
    id: "ws_1",
    name: "Acme",
    slug: "acme",
    logoUrl: null,
    companyName: "Acme Inc",
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
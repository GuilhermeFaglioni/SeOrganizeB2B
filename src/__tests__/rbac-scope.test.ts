import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  hasPermission,
  can,
  canViewResource,
  denyFor,
  getEffectivePermissions,
  getUserAreaIds,
  getUserProjectIds,
} from "../lib/authz/authz";
import { applyScopeFilter, getUserScope } from "../lib/authz/scope-filter";

const mocks = vi.hoisted(() => ({
  mockProfileFindFirst: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockTeamMemberAreaFindMany: vi.fn(),
  mockProjectMemberFindMany: vi.fn(),
  mockTaskFindUnique: vi.fn(),
  mockProjectFindUnique: vi.fn(),
  mockDocumentFindUnique: vi.fn(),
  mockIsWorkspaceAccessBlocked: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: { findFirst: mocks.mockProfileFindFirst },
    workspace: { findUnique: mocks.mockWorkspaceFindUnique },
    role: { findFirst: mocks.mockRoleFindFirst },
    teamMemberArea: { findMany: mocks.mockTeamMemberAreaFindMany },
    projectMember: { findMany: mocks.mockProjectMemberFindMany },
    task: { findUnique: mocks.mockTaskFindUnique },
    project: { findUnique: mocks.mockProjectFindUnique },
    document: { findUnique: mocks.mockDocumentFindUnique },
  },
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
  withTenantBypass: (fn: () => unknown) => fn(),
}));

vi.mock("../lib/tenant", () => ({
  isWorkspaceAccessBlocked: mocks.mockIsWorkspaceAccessBlocked,
}));

const profileWith = (permissions: unknown, isAdmin = false) => ({
  id: "user-1",
  tenantId: "tenant-1",
  role: {
    id: "r1",
    name: "Member",
    isAdmin,
    permissions,
    tenantId: "tenant-1",
  },
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.mockTeamMemberAreaFindMany.mockResolvedValue([]);
  mocks.mockProjectMemberFindMany.mockResolvedValue([]);
  mocks.mockIsWorkspaceAccessBlocked.mockReturnValue(false);
});

describe("hasPermission (async by userId) — checklist", () => {
  it("scope all → true", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "all" }])
    );
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "all" })
    ).resolves.toBe(true);
  });

  it("scope area + user has area-scoped permission → true", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "area" })
    ).resolves.toBe(true);
  });

  it("scope area + user does NOT have area-scoped permission → false", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "area" })
    ).resolves.toBe(false);
  });

  it("scope project + user has project-scoped permission → true", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "project" })
    ).resolves.toBe(true);
  });

  it("scope project + user does NOT have any view permission → false", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith([]));
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "project" })
    ).resolves.toBe(false);
  });

  it("admin bypass → true for everything", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith([], true));
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "area" })
    ).resolves.toBe(true);
    await expect(
      hasPermission("user-1", { resource: "bogus", action: "thing", scope: "project" })
    ).resolves.toBe(true);
  });
});

describe("canViewResource — checklist", () => {
  it("scope all → true", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "all" }])
    );
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(true);
  });

  it("scope area + resource in the user's area → true", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue({ project: { areaId: "area-1" } });
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(true);
  });

  it("scope area + resource in another area → false", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue({ project: { areaId: "area-9" } });
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(false);
  });

  it("scope area + document in another area → false", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "documents", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockDocumentFindUnique.mockResolvedValue({
      project: { areaId: "area-9" },
    });
    await expect(canViewResource("user-1", "document", "doc-1")).resolves.toBe(false);
  });

  it("scope area + project in another area → false", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "projects", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockProjectFindUnique.mockResolvedValue({ areaId: "area-9" });
    await expect(canViewResource("user-1", "project", "proj-1")).resolves.toBe(false);
  });

  it("scope project + resource in the user's project → true", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue({ projectId: "proj-1" });
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(true);
  });

  it("scope project + resource in another project → false", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue({ projectId: "proj-9" });
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(false);
  });

  it("scope project + document in another project → false", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "documents", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    mocks.mockDocumentFindUnique.mockResolvedValue({ projectId: "proj-9" });
    await expect(canViewResource("user-1", "document", "doc-1")).resolves.toBe(false);
  });

  it("admin bypass → true for everything", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith([], true));
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(true);
    await expect(canViewResource("user-1", "bogus", "x")).resolves.toBe(true);
  });
});

describe("applyScopeFilter — checklist filtering", () => {
  it("filters tasks by the correct area", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    const where = await applyScopeFilter("user-1", "tenant-1", "task", {
      archived: false,
    });
    expect(where).toEqual({
      archived: false,
      project: { areaId: { in: ["area-1"] } },
    });
  });

  it("filters tasks by the correct project", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    const where = await applyScopeFilter("user-1", "tenant-1", "task", {
      archived: false,
    });
    expect(where).toEqual({ archived: false, projectId: { in: ["proj-1"] } });
  });

  it("filters documents by the correct area", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "documents", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    const where = await applyScopeFilter("user-1", "tenant-1", "document", {});
    expect(where).toEqual({ project: { areaId: { in: ["area-1"] } } });
  });

  it("filters documents by the correct project", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "documents", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    const where = await applyScopeFilter("user-1", "tenant-1", "document", {});
    expect(where).toEqual({ projectId: { in: ["proj-1"] } });
  });

  it("empty area memberships match nothing", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    const where = await applyScopeFilter("user-1", "tenant-1", "task", {});
    expect(where).toEqual({ project: { areaId: { in: [] } } });
  });

  it("empty project memberships match nothing", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    const where = await applyScopeFilter("user-1", "tenant-1", "task", {});
    expect(where).toEqual({ projectId: { in: [] } });
  });
});

describe("getUserScope", () => {
  it("returns the view permission scope for tasks", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    await expect(getUserScope("user-1", "tenant-1", "task")).resolves.toBe("area");
  });

  it("returns all for admins", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith([], true));
    await expect(getUserScope("user-1", "tenant-1", "task")).resolves.toBe("all");
  });
});

describe("getEffectivePermissions — branch coverage", () => {
  it("returns empty permissions when the profile does not exist", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(null);
    await expect(getEffectivePermissions("ghost")).resolves.toEqual({
      tenantId: null,
      isAdmin: false,
      roleId: null,
      roleName: null,
      permissions: [],
    });
  });

  it("ignores a role from another tenant and falls back to the workspace default role", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      role: {
        id: "r-other",
        name: "Other",
        isAdmin: false,
        permissions: [],
        tenantId: "tenant-2",
      },
    });
    mocks.mockWorkspaceFindUnique.mockResolvedValue({ defaultRoleId: "r-default" });
    mocks.mockRoleFindFirst.mockResolvedValue({
      id: "r-default",
      name: "Default",
      isAdmin: false,
      permissions: [{ resource: "tasks", action: "view", scope: "area" }],
      tenantId: "tenant-1",
    });
    const effective = await getEffectivePermissions("user-1");
    expect(effective.roleId).toBe("r-default");
    expect(effective.permissions).toEqual([
      { resource: "tasks", action: "view", scope: "area" },
    ]);
  });

  it("returns empty permissions when no default role is configured", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue({
      id: "user-1",
      tenantId: "tenant-1",
      role: {
        id: "r-other",
        name: "Other",
        isAdmin: false,
        permissions: [],
        tenantId: "tenant-2",
      },
    });
    mocks.mockWorkspaceFindUnique.mockResolvedValue({ defaultRoleId: null });
    const effective = await getEffectivePermissions("user-1");
    expect(effective.isAdmin).toBe(false);
    expect(effective.permissions).toEqual([]);
  });
});

describe("getUserAreaIds / getUserProjectIds", () => {
  it("returns [] when there is no tenant", async () => {
    await expect(getUserAreaIds("user-1", null)).resolves.toEqual([]);
    await expect(getUserProjectIds("user-1", null)).resolves.toEqual([]);
    expect(mocks.mockTeamMemberAreaFindMany).not.toHaveBeenCalled();
    expect(mocks.mockProjectMemberFindMany).not.toHaveBeenCalled();
  });

  it("returns the user's area membership ids", async () => {
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([
      { areaId: "area-1" },
      { areaId: "area-2" },
    ]);
    await expect(getUserAreaIds("user-1", "tenant-1")).resolves.toEqual([
      "area-1",
      "area-2",
    ]);
  });

  it("returns the user's project membership ids scoped to the tenant", async () => {
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    await expect(getUserProjectIds("user-1", "tenant-1")).resolves.toEqual([
      "proj-1",
    ]);
    expect(mocks.mockProjectMemberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: "user-1", project: { tenantId: "tenant-1" } },
      })
    );
  });
});

describe("can", () => {
  it("wraps getEffectivePermissions + hasPermission", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "all" }])
    );
    await expect(can("user-1", "tasks.view")).resolves.toBe(true);
    await expect(can("user-1", "tasks.create")).resolves.toBe(false);
  });
});

describe("denyFor", () => {
  it("returns a 403 FORBIDDEN response when the user lacks the permission", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    const res = await denyFor("user-1", "tasks.create");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    await expect(res!.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "FORBIDDEN" }),
      })
    );
  });

  it("returns null when the user has the permission and the workspace is active", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "all" }])
    );
    mocks.mockWorkspaceFindUnique.mockResolvedValue({
      status: "ACTIVE",
      cancelledAt: null,
    });
    await expect(denyFor("user-1", "tasks.view")).resolves.toBeNull();
  });

  it("returns a 403 WORKSPACE_CANCELLED response when the workspace is blocked", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "all" }])
    );
    mocks.mockWorkspaceFindUnique.mockResolvedValue({
      status: "CANCELLED",
      cancelledAt: new Date(),
    });
    mocks.mockIsWorkspaceAccessBlocked.mockReturnValue(true);
    const res = await denyFor("user-1", "tasks.view");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    await expect(res!.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: "WORKSPACE_CANCELLED" }),
      })
    );
  });

  it("skips the workspace check when the user has no tenant", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue({
      id: "user-1",
      tenantId: null,
      role: {
        id: "r1",
        name: "Member",
        isAdmin: false,
        permissions: [{ resource: "tasks", action: "view", scope: "all" }],
        tenantId: null,
      },
    });
    await expect(denyFor("user-1", "tasks.view")).resolves.toBeNull();
    expect(mocks.mockWorkspaceFindUnique).not.toHaveBeenCalled();
  });
});
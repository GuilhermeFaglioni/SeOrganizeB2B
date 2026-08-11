import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  hasPermission,
  getEffectivePermissions,
  canViewResource,
} from "../lib/authz/authz";

const mocks = vi.hoisted(() => ({
  mockProfileFindFirst: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockTeamMemberAreaFindMany: vi.fn(),
  mockProjectMemberFindMany: vi.fn(),
  mockTaskFindUnique: vi.fn(),
  mockProjectFindUnique: vi.fn(),
  mockDocumentFindUnique: vi.fn(),
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
  isWorkspaceAccessBlocked: () => false,
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
});

describe("getEffectivePermissions", () => {
  it("returns the full permission list with scopes (legacy strings become all)", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([
        { resource: "tasks", action: "view", scope: "area" },
        "financial.contracts.view",
      ])
    );
    const effective = await getEffectivePermissions("user-1");
    expect(effective.isAdmin).toBe(false);
    expect(effective.permissions).toEqual([
      { resource: "tasks", action: "view", scope: "area" },
      { resource: "financial.contracts", action: "view", scope: "all" },
    ]);
  });
});

describe("hasPermission (async by userId, each scope)", () => {
  it("grants any requested scope when the granted scope is all", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "all" }])
    );
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "all" })
    ).resolves.toBe(true);
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "area" })
    ).resolves.toBe(true);
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "project" })
    ).resolves.toBe(true);
  });

  it("area scope covers area and project but not all", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "area" })
    ).resolves.toBe(true);
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "project" })
    ).resolves.toBe(true);
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "all" })
    ).resolves.toBe(false);
  });

  it("project scope covers only project", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "project" })
    ).resolves.toBe(true);
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "area" })
    ).resolves.toBe(false);
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "all" })
    ).resolves.toBe(false);
  });

  it("admins pass every scoped request", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith([], true));
    await expect(
      hasPermission("user-1", { resource: "tasks", action: "view", scope: "area" })
    ).resolves.toBe(true);
    await expect(
      hasPermission("user-1", { resource: "bogus", action: "thing", scope: "project" })
    ).resolves.toBe(true);
  });
});

describe("canViewResource — scope all", () => {
  it("grants any resource when the user has view with scope all", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "all" }])
    );
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(true);
    expect(mocks.mockTaskFindUnique).not.toHaveBeenCalled();
    expect(mocks.mockTeamMemberAreaFindMany).not.toHaveBeenCalled();
    expect(mocks.mockProjectMemberFindMany).not.toHaveBeenCalled();
  });

  it("treats a legacy string permission as scope all (backward compat)", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith(["tasks.view"]));
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(true);
  });
});

describe("canViewResource — scope area", () => {
  it("grants a task whose project area is in the user's areas", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue({ project: { areaId: "area-1" } });
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(true);
    expect(mocks.mockTaskFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "task-1" } })
    );
  });

  it("denies a task whose project area is outside the user's areas", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue({ project: { areaId: "area-9" } });
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(false);
  });

  it("grants a project whose area is in the user's areas", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "projects", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockProjectFindUnique.mockResolvedValue({ areaId: "area-1" });
    await expect(canViewResource("user-1", "project", "proj-1")).resolves.toBe(true);
  });

  it("grants a document whose project area is in the user's areas", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "documents", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockDocumentFindUnique.mockResolvedValue({ project: { areaId: "area-1" } });
    await expect(canViewResource("user-1", "document", "doc-1")).resolves.toBe(true);
  });

  it("grants an area the user belongs to and denies others", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "areas", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    await expect(canViewResource("user-1", "area", "area-1")).resolves.toBe(true);
    await expect(canViewResource("user-1", "area", "area-9")).resolves.toBe(false);
  });

  it("denies when the resource does not exist", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue(null);
    await expect(canViewResource("user-1", "task", "task-404")).resolves.toBe(false);
  });
});

describe("canViewResource — scope project", () => {
  it("grants a task whose project is in the user's project memberships", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue({ projectId: "proj-1" });
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(true);
    expect(mocks.mockProjectMemberFindMany).toHaveBeenCalled();
  });

  it("denies a task whose project is not in the user's project memberships", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue({ projectId: "proj-9" });
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(false);
  });

  it("grants a document whose project is in the user's project memberships", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "documents", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    mocks.mockDocumentFindUnique.mockResolvedValue({ projectId: "proj-1" });
    await expect(canViewResource("user-1", "document", "doc-1")).resolves.toBe(true);
  });

  it("grants a project the user is a member of and denies others", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "projects", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    await expect(canViewResource("user-1", "project", "proj-1")).resolves.toBe(true);
    await expect(canViewResource("user-1", "project", "proj-9")).resolves.toBe(false);
  });
});

describe("canViewResource — denial paths", () => {
  it("denies when the user has no view permission", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith([]));
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(false);
  });

  it("denies when the user has a different action but not view", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "create", scope: "all" }])
    );
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(false);
  });

  it("denies an unknown entity type", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "all" }])
    );
    await expect(canViewResource("user-1", "widget", "w-1")).resolves.toBe(false);
  });
});

describe("canViewResource — admin bypass", () => {
  it("grants everything to admins, even unknown entity types", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith([], true));
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(true);
    await expect(canViewResource("user-1", "bogus", "x")).resolves.toBe(true);
    expect(mocks.mockTaskFindUnique).not.toHaveBeenCalled();
    expect(mocks.mockTeamMemberAreaFindMany).not.toHaveBeenCalled();
    expect(mocks.mockProjectMemberFindMany).not.toHaveBeenCalled();
  });
});
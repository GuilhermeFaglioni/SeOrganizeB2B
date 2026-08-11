import { describe, expect, it, vi, beforeEach } from "vitest";
import { applyScopeFilter, getUserScope } from "../lib/authz/scope-filter";
import { canViewResource } from "../lib/authz/authz";

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

describe("getUserScope", () => {
  it("returns all for admins (bypass)", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith([], true));
    await expect(
      getUserScope("user-1", "tenant-1", "task")
    ).resolves.toBe("all");
  });

  it("returns the view permission scope for a resource", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    await expect(
      getUserScope("user-1", "tenant-1", "task")
    ).resolves.toBe("area");
  });

  it("maps calendarEvent to the calendar resource", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "calendar", action: "view", scope: "project" }])
    );
    await expect(
      getUserScope("user-1", "tenant-1", "calendarEvent")
    ).resolves.toBe("project");
  });

  it("defaults to all when no view permission exists", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith([]));
    await expect(
      getUserScope("user-1", "tenant-1", "task")
    ).resolves.toBe("all");
  });
});

describe("applyScopeFilter — all", () => {
  it("returns baseWhere unchanged for scope all", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "all" }])
    );
    const base = { archived: false };
    const where = await applyScopeFilter("user-1", "tenant-1", "task", base);
    expect(where).toEqual(base);
    expect(mocks.mockTeamMemberAreaFindMany).not.toHaveBeenCalled();
    expect(mocks.mockProjectMemberFindMany).not.toHaveBeenCalled();
  });
});

describe("applyScopeFilter — admin bypass", () => {
  it("returns baseWhere unchanged for admins", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith([], true));
    const base = { archived: false };
    const where = await applyScopeFilter("user-1", "tenant-1", "task", base);
    expect(where).toEqual(base);
    expect(mocks.mockTeamMemberAreaFindMany).not.toHaveBeenCalled();
    expect(mocks.mockProjectMemberFindMany).not.toHaveBeenCalled();
  });
});

describe("applyScopeFilter — area", () => {
  it("filters projects by areaId in userAreas", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "projects", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([
      { areaId: "area-1" },
      { areaId: "area-2" },
    ]);
    const where = await applyScopeFilter("user-1", "tenant-1", "project", {
      archived: false,
    });
    expect(where).toEqual({
      archived: false,
      areaId: { in: ["area-1", "area-2"] },
    });
  });

  it("filters tasks through project.areaId", async () => {
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

  it("filters documents through project.areaId", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "documents", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    const where = await applyScopeFilter("user-1", "tenant-1", "document", {});
    expect(where).toEqual({ project: { areaId: { in: ["area-1"] } } });
  });

  it("filters calendarEvents by areaId in userAreas", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "calendar", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    const where = await applyScopeFilter(
      "user-1",
      "tenant-1",
      "calendarEvent",
      { userId: "user-1" }
    );
    expect(where).toEqual({ userId: "user-1", areaId: { in: ["area-1"] } });
  });

  it("matches nothing when the user has no areas", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "projects", action: "view", scope: "area" }])
    );
    const where = await applyScopeFilter("user-1", "tenant-1", "project", {});
    expect(where).toEqual({ areaId: { in: [] } });
  });
});

describe("applyScopeFilter — project", () => {
  it("filters tasks by projectId in userProjects", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    const where = await applyScopeFilter("user-1", "tenant-1", "task", {
      archived: false,
    });
    expect(where).toEqual({ archived: false, projectId: { in: ["proj-1"] } });
  });

  it("filters documents by projectId in userProjects", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "documents", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([
      { projectId: "proj-1" },
      { projectId: "proj-2" },
    ]);
    const where = await applyScopeFilter("user-1", "tenant-1", "document", {});
    expect(where).toEqual({ projectId: { in: ["proj-1", "proj-2"] } });
  });

  it("leaves projects unfiltered (no project-level filter)", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "projects", action: "view", scope: "project" }])
    );
    const base = { archived: false };
    const where = await applyScopeFilter("user-1", "tenant-1", "project", base);
    expect(where).toEqual(base);
  });

  it("matches nothing when the user has no project memberships", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    const where = await applyScopeFilter("user-1", "tenant-1", "task", {});
    expect(where).toEqual({ projectId: { in: [] } });
  });
});

describe("applyScopeFilter — merging", () => {
  it("preserves existing filters while adding the scope filter", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);
    const where = await applyScopeFilter("user-1", "tenant-1", "task", {
      title: { contains: "urgent" },
    });
    expect(where).toEqual({
      title: { contains: "urgent" },
      projectId: { in: ["proj-1"] },
    });
  });
});

describe("canViewResource integration with scope filters", () => {
  it("grants a task that passes the area scope filter", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue({
      project: { areaId: "area-1" },
    });
    const where = await applyScopeFilter("user-1", "tenant-1", "task", {});
    expect(where).toEqual({ project: { areaId: { in: ["area-1"] } } });
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(
      true
    );
  });

  it("denies a task outside the area scope filter", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue({
      project: { areaId: "area-9" },
    });
    const where = await applyScopeFilter("user-1", "tenant-1", "task", {});
    expect(where).toEqual({ project: { areaId: { in: ["area-1"] } } });
    await expect(canViewResource("user-1", "task", "task-1")).resolves.toBe(
      false
    );
  });
});
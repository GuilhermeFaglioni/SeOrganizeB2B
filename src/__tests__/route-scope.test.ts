import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  mockProfileFindFirst: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockRoleFindFirst: vi.fn(),
  mockTeamMemberAreaFindMany: vi.fn(),
  mockProjectMemberFindMany: vi.fn(),
  mockProjectFindMany: vi.fn(),
  mockTaskFindMany: vi.fn(),
  mockTaskFindUnique: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockContractCount: vi.fn(),
  mockContractFindUnique: vi.fn(),
  mockListProposals: vi.fn(),
  mockComputeOverview: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: { findFirst: mocks.mockProfileFindFirst },
    workspace: { findUnique: mocks.mockWorkspaceFindUnique },
    role: { findFirst: mocks.mockRoleFindFirst },
    teamMemberArea: { findMany: mocks.mockTeamMemberAreaFindMany },
    projectMember: { findMany: mocks.mockProjectMemberFindMany },
    project: { findMany: mocks.mockProjectFindMany },
    task: {
      findMany: mocks.mockTaskFindMany,
      findUnique: mocks.mockTaskFindUnique,
    },
    contract: {
      findMany: mocks.mockContractFindMany,
      count: mocks.mockContractCount,
      findUnique: mocks.mockContractFindUnique,
    },
    closedBetaCheckinEdition: { findFirst: vi.fn().mockResolvedValue(null) },
    closedBetaEnrollment: { findUnique: vi.fn().mockResolvedValue(null) },
    closedBetaCheckinWorkspaceState: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
  withTenantBypass: (fn: () => unknown) => fn(),
  requireTenantId: () => "tenant-1",
  getTenantId: () => "tenant-1",
}));

vi.mock("../lib/tenant", () => ({
  isWorkspaceAccessBlocked: () => false,
  DEFAULT_WORKSPACE_ID: "workspace",
}));

vi.mock("@/lib/middleware/feature-gating", () => ({
  applyFeatureGate: vi
    .fn()
    .mockResolvedValue({ response: null, warning: null }),
  withFeatureWarning: (response: unknown) => response,
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1", email: "a@b.c" }),
}));

vi.mock("@/lib/financial/contracts-service", () => ({
  createContractDraft: vi.fn(),
  updateContract: vi.fn(),
  deleteContract: vi.fn(),
}));

vi.mock("@/lib/financial/proposals-service", () => ({
  createProposalDraft: vi.fn(),
  updateProposalDraft: vi.fn(),
  deleteProposal: vi.fn(),
  getProposal: vi.fn(),
  listProposals: mocks.mockListProposals,
}));

vi.mock("@/lib/financial/overview-service", () => ({
  computeOverview: mocks.mockComputeOverview,
}));

vi.mock("@/lib/financial/civil-date", () => ({
  todayCivilDate: () => "2026-08-01",
  isCivilDate: (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v),
}));

vi.mock("@/lib/activity/record", () => ({
  recordActivity: vi.fn(),
}));

vi.mock("@/lib/tasks/complete-recurring-task", () => ({
  completeRecurringTask: vi.fn(),
}));

vi.mock("@/lib/push", () => ({
  sendPushToUsers: vi.fn(),
  buildPushPayload: vi.fn(),
}));

import { GET as projectsGET } from "../app/api/projects/route";
import { GET as upcomingTasksGET } from "../app/api/tasks/upcoming/route";
import { GET as taskGET } from "../app/api/tasks/[taskId]/route";
import { GET as contractsGET } from "../app/api/contracts/route";
import { GET as contractGET } from "../app/api/contracts/[id]/route";

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
  mocks.mockWorkspaceFindUnique.mockResolvedValue({
    status: "ACTIVE",
    cancelledAt: null,
  });
  mocks.mockTeamMemberAreaFindMany.mockResolvedValue([]);
  mocks.mockProjectMemberFindMany.mockResolvedValue([]);
  mocks.mockProjectFindMany.mockResolvedValue([]);
  mocks.mockTaskFindMany.mockResolvedValue([]);
  mocks.mockContractFindMany.mockResolvedValue([]);
  mocks.mockContractCount.mockResolvedValue(0);
});

describe("route scope filtering — area scope", () => {
  it("lists only area resources for a user with area scope", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);

    const res = await upcomingTasksGET(
      new NextRequest("http://x/api/tasks/upcoming")
    );
    expect(res.status).toBe(200);

    const where = mocks.mockTaskFindMany.mock.calls[0][0].where;
    expect(where.project).toEqual({ areaId: { in: ["area-1"] } });
  });
});

describe("route scope filtering — project scope", () => {
  it("lists only project resources for a user with project scope", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "project" }])
    );
    mocks.mockProjectMemberFindMany.mockResolvedValue([{ projectId: "proj-1" }]);

    const res = await upcomingTasksGET(
      new NextRequest("http://x/api/tasks/upcoming")
    );
    expect(res.status).toBe(200);

    const where = mocks.mockTaskFindMany.mock.calls[0][0].where;
    expect(where.projectId).toEqual({ in: ["proj-1"] });
  });
});

describe("route scope filtering — individual access", () => {
  it("returns 404 when the user cannot view the resource", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "tasks", action: "view", scope: "area" }])
    );
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([{ areaId: "area-1" }]);
    mocks.mockTaskFindUnique.mockResolvedValue({
      id: "task-1",
      title: "T",
      project: { areaId: "area-9" },
    });

    const res = await taskGET(
      new NextRequest("http://x/api/tasks/task-1"),
      { params: { taskId: "task-1" } }
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("NOT_FOUND");
  });
});

describe("route scope filtering — admin bypass", () => {
  it("applies no extra filter for admins", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(profileWith([], true));

    const res = await projectsGET();
    expect(res.status).toBe(200);

    const where = mocks.mockProjectFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ archived: false });
  });
});

describe("route scope filtering — financial tenant-only fallback", () => {
  it("leaves the contracts where tenant-only for an area-scoped user", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "financial.contracts", action: "view", scope: "area" }])
    );
    mocks.mockContractFindMany.mockResolvedValue([]);
    mocks.mockContractCount.mockResolvedValue(0);

    const res = await contractsGET(
      new NextRequest("http://x/api/contracts?status=active")
    );
    expect(res.status).toBe(200);

    const where = mocks.mockContractFindMany.mock.calls[0][0].where;
    expect(where.status).toBe("active");
    expect(where).not.toHaveProperty("areaId");
    expect(where).not.toHaveProperty("projectId");
    expect(where).not.toHaveProperty("project");
  });

  it("grants access to a financial resource when the view permission exists", async () => {
    mocks.mockProfileFindFirst.mockResolvedValue(
      profileWith([{ resource: "financial.contracts", action: "view", scope: "area" }])
    );
    mocks.mockContractFindUnique.mockResolvedValue({ id: "ctr-1", title: "C" });

    const res = await contractGET(
      new NextRequest("http://x/api/contracts/ctr-1"),
      { params: { id: "ctr-1" } }
    );
    expect(res.status).toBe(200);
  });
});
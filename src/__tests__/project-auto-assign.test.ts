import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockDenyFor: vi.fn(),
  mockProjectFindFirst: vi.fn(),
  mockTeamMemberAreaFindMany: vi.fn(),
  mockProjectMemberCreateMany: vi.fn(),
  mockProjectMemberDeleteMany: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("@/lib/authz/authz", () => ({
  denyFor: mocks.mockDenyFor,
  getEffectivePermissions: vi.fn(),
  hasPermission: vi.fn(() => true),
  can: vi.fn().mockResolvedValue(true),
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

vi.mock("@/lib/middleware/feature-gating", () => ({
  applyFeatureGate: vi.fn().mockResolvedValue({ response: null, warning: null }),
  withFeatureWarning: (_response: NextResponse) => _response,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    project: {
      findFirst: mocks.mockProjectFindFirst,
    },
    teamMemberArea: {
      findMany: mocks.mockTeamMemberAreaFindMany,
    },
    projectMember: {
      createMany: mocks.mockProjectMemberCreateMany,
      deleteMany: mocks.mockProjectMemberDeleteMany,
    },
  },
  withTenant: (_tenantId: string, fn: () => unknown) => fn(),
  withTenantBypass: (fn: () => unknown) => fn(),
  requireTenantId: () => "tenant-1",
  getTenantId: () => "tenant-1",
}));

import { PATCH } from "../app/api/projects/[projectId]/auto-assign/route";

const makeRequest = (body: unknown) =>
  new NextRequest("http://x/api/projects/p1/auto-assign", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

const project = {
  id: "p1",
  name: "Projeto Alpha",
  areaId: "area-1",
  createdBy: "user-1",
  tenantId: "tenant-1",
  description: null,
  archived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("project auto-assign by area (T-032)", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockGetUser.mockResolvedValue({ id: "user-1", email: "a@b.c" });
    mocks.mockDenyFor.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.mockGetUser.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ enabled: true }), {
      params: Promise.resolve({ projectId: "p1" }),
    });
    expect(res.status).toBe(401);
    expect(mocks.mockProjectFindFirst).not.toHaveBeenCalled();
  });

  it("returns 403 when the user lacks permission to manage the project", async () => {
    mocks.mockDenyFor.mockResolvedValue(new NextResponse(null, { status: 403 }));
    const res = await PATCH(makeRequest({ enabled: true }), {
      params: Promise.resolve({ projectId: "p1" }),
    });
    expect(res.status).toBe(403);
    expect(mocks.mockProjectFindFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when the project does not exist", async () => {
    mocks.mockProjectFindFirst.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ enabled: true }), {
      params: Promise.resolve({ projectId: "p1" }),
    });
    expect(res.status).toBe(404);
    expect(mocks.mockProjectMemberCreateMany).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean enabled value", async () => {
    mocks.mockProjectFindFirst.mockResolvedValue(project);
    const res = await PATCH(makeRequest({ enabled: "yes" }), {
      params: Promise.resolve({ projectId: "p1" }),
    });
    expect(res.status).toBe(400);
    expect(mocks.mockProjectMemberCreateMany).not.toHaveBeenCalled();
  });

  it("adds area members as auto-assigned project members when enabled", async () => {
    mocks.mockProjectFindFirst.mockResolvedValue(project);
    mocks.mockTeamMemberAreaFindMany.mockResolvedValue([
      { userId: "u1" },
      { userId: "u2" },
    ]);
    mocks.mockProjectMemberCreateMany.mockResolvedValue({ count: 2 });

    const res = await PATCH(makeRequest({ enabled: true }), {
      params: Promise.resolve({ projectId: "p1" }),
    });
    expect(res.status).toBe(200);

    expect(mocks.mockTeamMemberAreaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { areaId: "area-1" } })
    );
    expect(mocks.mockProjectMemberCreateMany).toHaveBeenCalledWith({
      data: [
        { projectId: "p1", profileId: "u1", autoAssignedByArea: true },
        { projectId: "p1", profileId: "u2", autoAssignedByArea: true },
      ],
      skipDuplicates: true,
    });

    const json = await res.json();
    expect(json.data.autoAssignedByArea).toBe(true);
    expect(json.data.added).toBe(2);
  });

  it("does not fetch area members when the project has no area", async () => {
    mocks.mockProjectFindFirst.mockResolvedValue({ ...project, areaId: null });
    const res = await PATCH(makeRequest({ enabled: true }), {
      params: Promise.resolve({ projectId: "p1" }),
    });
    expect(res.status).toBe(200);
    expect(mocks.mockTeamMemberAreaFindMany).not.toHaveBeenCalled();
    expect(mocks.mockProjectMemberCreateMany).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.data.added).toBe(0);
  });

  it("removes only auto-assigned members when disabled, keeping manual ones", async () => {
    mocks.mockProjectFindFirst.mockResolvedValue(project);
    mocks.mockProjectMemberDeleteMany.mockResolvedValue({ count: 3 });

    const res = await PATCH(makeRequest({ enabled: false }), {
      params: Promise.resolve({ projectId: "p1" }),
    });
    expect(res.status).toBe(200);

    expect(mocks.mockProjectMemberDeleteMany).toHaveBeenCalledWith({
      where: { projectId: "p1", autoAssignedByArea: true },
    });

    const json = await res.json();
    expect(json.data.autoAssignedByArea).toBe(false);
    expect(json.data.removed).toBe(3);
  });
});
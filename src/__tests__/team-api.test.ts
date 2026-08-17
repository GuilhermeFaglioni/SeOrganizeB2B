import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/lib/authz/tenant-context";

type FindManyArgs = { where?: { tenantId?: string } };

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockDenyFor: vi.fn(),
  mockGetTenantContext: vi.fn(),
  mockProfileFindMany: vi.fn(),
  mockWithTenant: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("@/lib/authz/authz", () => ({
  denyFor: mocks.mockDenyFor,
}));

vi.mock("@/lib/authz/tenant-context", () => ({
  getTenantContext: mocks.mockGetTenantContext,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: {
      findMany: mocks.mockProfileFindMany,
    },
  },
  withTenant: mocks.mockWithTenant,
}));

import { GET } from "../app/api/team/route";

const tenantContext: TenantContext = {
  tenantId: "workspace-2",
  workspaceStatus: "active",
  gracePeriodEndsAt: null,
  cancelledAt: null,
  isAdmin: true,
};

const oldWorkspaceProfile = {
  id: "old-user",
  name: "Usuário antigo",
  email: "old@example.com",
  avatarUrl: null,
  roleId: null,
  role: null,
  teamMemberAreas: [],
};

const currentWorkspaceProfile = {
  id: "current-user",
  name: "Usuário atual",
  email: "current@example.com",
  avatarUrl: null,
  roleId: null,
  role: null,
  teamMemberAreas: [],
};

describe("GET /api/team", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockGetUser.mockResolvedValue({ id: "current-user" });
    mocks.mockDenyFor.mockResolvedValue(null);
    mocks.mockGetTenantContext.mockResolvedValue(tenantContext);
    mocks.mockWithTenant.mockImplementation(
      async (_tenantId: string, fn: () => unknown) => fn(),
    );
    mocks.mockProfileFindMany.mockImplementation((args: FindManyArgs) =>
      args.where?.tenantId === "workspace-2"
        ? [currentWorkspaceProfile]
        : [oldWorkspaceProfile, currentWorkspaceProfile],
    );
  });

  it("only returns members from the authenticated workspace", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(mocks.mockProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "workspace-2", removedAt: null },
      }),
    );
    expect(await res.json()).toMatchObject({
      data: [currentWorkspaceProfile],
      error: null,
    });
  });
});

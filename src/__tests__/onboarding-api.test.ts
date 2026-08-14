import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetTenantContext: vi.fn(),
  mockWorkspaceFindUnique: vi.fn(),
  mockWorkspaceUpdateMany: vi.fn(),
  mockClientCount: vi.fn(),
  mockProposalCount: vi.fn(),
  mockContractCount: vi.fn(),
  mockProjectCount: vi.fn(),
  mockWithTenant: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("@/lib/authz/tenant-context", () => ({
  getTenantContext: mocks.mockGetTenantContext,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    workspace: {
      findUnique: mocks.mockWorkspaceFindUnique,
      updateMany: mocks.mockWorkspaceUpdateMany,
    },
    client: { count: mocks.mockClientCount },
    proposal: { count: mocks.mockProposalCount },
    contract: { count: mocks.mockContractCount },
    project: { count: mocks.mockProjectCount },
  },
  withTenant: mocks.mockWithTenant,
}));

import { POST } from "../app/api/onboarding/route";

describe("POST /api/onboarding", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.mockGetUser.mockResolvedValue({ id: "user_1" });
    mocks.mockGetTenantContext.mockResolvedValue({
      tenantId: "ws_1",
      isAdmin: true,
    });
    mocks.mockWithTenant.mockImplementation(async (_tenantId: string, fn: () => unknown) => fn());
  });

  it("returns the persisted completion without loading onboarding data again", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue({
      onboardingCompleted: true,
    });

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { onboardingCompleted: true },
      error: null,
    });
    expect(mocks.mockClientCount).not.toHaveBeenCalled();
    expect(mocks.mockProposalCount).not.toHaveBeenCalled();
    expect(mocks.mockContractCount).not.toHaveBeenCalled();
    expect(mocks.mockProjectCount).not.toHaveBeenCalled();
  });

  it("persists completion after verifying all onboarding requirements", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue({
      onboardingCompleted: false,
      companyName: "Acme Inc",
    });
    mocks.mockClientCount.mockResolvedValue(1);
    mocks.mockProposalCount.mockResolvedValue(1);
    mocks.mockContractCount.mockResolvedValue(0);
    mocks.mockProjectCount.mockResolvedValue(1);
    mocks.mockWorkspaceUpdateMany.mockResolvedValue({ count: 1 });

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { onboardingCompleted: true },
      error: null,
    });
    expect(mocks.mockWorkspaceUpdateMany).toHaveBeenCalledWith({
      where: { id: "ws_1", onboardingCompleted: false },
      data: { onboardingCompleted: true },
    });
  });

  it("does not persist an incomplete onboarding", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue({
      onboardingCompleted: false,
      companyName: "Acme Inc",
    });
    mocks.mockClientCount.mockResolvedValue(1);
    mocks.mockProposalCount.mockResolvedValue(1);
    mocks.mockContractCount.mockResolvedValue(0);
    mocks.mockProjectCount.mockResolvedValue(0);

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { onboardingCompleted: false },
      error: null,
    });
    expect(mocks.mockWorkspaceUpdateMany).not.toHaveBeenCalled();
  });
});

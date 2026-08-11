import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockWorkspaceFindUnique: vi.fn(),
  mockProfileCount: vi.fn(),
  mockTaskCount: vi.fn(),
  mockProjectCount: vi.fn(),
  mockContractCount: vi.fn(),
  mockClientCount: vi.fn(),
  mockProposalCount: vi.fn(),
  mockDocumentCount: vi.fn(),
  mockCalendarEventCount: vi.fn(),
  mockWithTenant: vi.fn(),
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    workspace: { findUnique: mocks.mockWorkspaceFindUnique },
    profile: { count: mocks.mockProfileCount },
    task: { count: mocks.mockTaskCount },
    project: { count: mocks.mockProjectCount },
    contract: { count: mocks.mockContractCount },
    client: { count: mocks.mockClientCount },
    proposal: { count: mocks.mockProposalCount },
    document: { count: mocks.mockDocumentCount },
    calendarEvent: { count: mocks.mockCalendarEventCount },
  },
  withTenant: mocks.mockWithTenant,
  withTenantBypass: vi.fn(async (fn: () => unknown) => fn()),
}));

import {
  getWorkspaceFeatures,
  checkFeature,
  getWorkspaceLimits,
  checkLimit,
  clearAllCaches,
} from "../lib/features";

function makePlan(overrides: Partial<Record<"allowedModules", string[]>> = {}) {
  return {
    plan: {
      allowedModules: overrides.allowedModules ?? ["tasks", "projects"],
      planLimits: [],
    },
  };
}

function makePlanLimits(planLimits: unknown[]) {
  return {
    plan: { allowedModules: [], planLimits },
  };
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => {
    if (typeof mock === "function") mock.mockReset();
  });
  clearAllCaches();
  mocks.mockWithTenant.mockImplementation(
    async (_tenantId: string, fn: () => unknown) => fn()
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getWorkspaceFeatures", () => {
  it("returns the allowedModules of the plan", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlan({ allowedModules: ["tasks", "projects", "contracts"] })
    );

    const features = await getWorkspaceFeatures("ws_1");
    expect(features.allowedModules).toEqual(["tasks", "projects", "contracts"]);
    expect(mocks.mockWorkspaceFindUnique).toHaveBeenCalledWith({
      where: { id: "ws_1" },
      select: { plan: { select: { allowedModules: true, planLimits: true } } },
    });
  });

  it("returns empty allowedModules when the workspace has no plan", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue({ plan: null });

    const features = await getWorkspaceFeatures("ws_1");
    expect(features.allowedModules).toEqual([]);
  });

  it("returns empty allowedModules when the workspace does not exist", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(null);

    const features = await getWorkspaceFeatures("ws_missing");
    expect(features.allowedModules).toEqual([]);
  });
});

describe("checkFeature", () => {
  it("returns true when the module is allowed", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlan({ allowedModules: ["tasks", "projects"] })
    );

    await expect(checkFeature("ws_1", "tasks")).resolves.toBe(true);
  });

  it("returns false when the module is not allowed", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlan({ allowedModules: ["tasks", "projects"] })
    );

    await expect(checkFeature("ws_1", "contracts")).resolves.toBe(false);
  });

  it("returns false when the plan is null", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue({ plan: null });

    await expect(checkFeature("ws_1", "tasks")).resolves.toBe(false);
  });
});

describe("getWorkspaceLimits", () => {
  it("returns the plan_limits of the plan", async () => {
    const planLimits = [
      { id: "pl_1", planId: "p_1", resource: "users", limit: 5, behavior: "hard" },
      { id: "pl_2", planId: "p_1", resource: "tasks", limit: 100, behavior: "warning" },
    ];
    mocks.mockWorkspaceFindUnique.mockResolvedValue(makePlanLimits(planLimits));

    const limits = await getWorkspaceLimits("ws_1");
    expect(limits).toEqual(planLimits);
  });

  it("returns empty limits when the workspace has no plan", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue({ plan: null });

    const limits = await getWorkspaceLimits("ws_1");
    expect(limits).toEqual([]);
  });
});

describe("checkLimit", () => {
  it("returns a positive remaining when usage is within the limit", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_1", planId: "p_1", resource: "users", limit: 5, behavior: "hard" },
      ])
    );
    mocks.mockProfileCount.mockResolvedValue(2);

    const result = await checkLimit("ws_1", "users");
    expect(result).toEqual({ remaining: 3, limit: 5, behavior: "hard" });
    expect(mocks.mockWithTenant).toHaveBeenCalledWith("ws_1", expect.any(Function));
    expect(mocks.mockProfileCount).toHaveBeenCalledWith({
      where: { tenantId: "ws_1" },
    });
  });

  it("returns remaining 0 when a hard limit is reached", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_1", planId: "p_1", resource: "users", limit: 2, behavior: "hard" },
      ])
    );
    mocks.mockProfileCount.mockResolvedValue(2);

    const result = await checkLimit("ws_1", "users");
    expect(result).toEqual({ remaining: 0, limit: 2, behavior: "hard" });
  });

  it("never returns a negative remaining", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_1", planId: "p_1", resource: "projects", limit: 3, behavior: "hard" },
      ])
    );
    mocks.mockProjectCount.mockResolvedValue(10);

    const result = await checkLimit("ws_1", "projects");
    expect(result.remaining).toBe(0);
  });

  it("reports low remaining for a warning behavior limit", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_2", planId: "p_1", resource: "tasks", limit: 100, behavior: "warning" },
      ])
    );
    mocks.mockTaskCount.mockResolvedValue(95);

    const result = await checkLimit("ws_1", "tasks");
    expect(result).toEqual({ remaining: 5, limit: 100, behavior: "warning" });
  });

  it("returns infinity limits when the resource has no configured limit", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_1", planId: "p_1", resource: "users", limit: 5, behavior: "hard" },
      ])
    );

    const result = await checkLimit("ws_1", "clients");
    expect(result).toEqual({
      remaining: Number.POSITIVE_INFINITY,
      limit: Number.POSITIVE_INFINITY,
      behavior: "hard",
    });
    expect(mocks.mockClientCount).not.toHaveBeenCalled();
  });

  it("counts every supported resource with the tenant scope", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_1", planId: "p_1", resource: "clients", limit: 10, behavior: "hard" },
        { id: "pl_2", planId: "p_1", resource: "proposals", limit: 10, behavior: "hard" },
        { id: "pl_3", planId: "p_1", resource: "documents", limit: 10, behavior: "hard" },
        { id: "pl_4", planId: "p_1", resource: "calendarEvents", limit: 10, behavior: "warning" },
      ])
    );
    mocks.mockClientCount.mockResolvedValue(1);
    mocks.mockProposalCount.mockResolvedValue(2);
    mocks.mockDocumentCount.mockResolvedValue(3);
    mocks.mockCalendarEventCount.mockResolvedValue(4);

    await expect(checkLimit("ws_1", "clients")).resolves.toMatchObject({
      remaining: 9,
    });
    await expect(checkLimit("ws_1", "proposals")).resolves.toMatchObject({
      remaining: 8,
    });
    await expect(checkLimit("ws_1", "documents")).resolves.toMatchObject({
      remaining: 7,
    });
    await expect(checkLimit("ws_1", "calendarEvents")).resolves.toMatchObject({
      remaining: 6,
    });

    expect(mocks.mockClientCount).toHaveBeenCalledWith({
      where: { tenantId: "ws_1" },
    });
    expect(mocks.mockProposalCount).toHaveBeenCalledWith({
      where: { tenantId: "ws_1" },
    });
    expect(mocks.mockDocumentCount).toHaveBeenCalledWith({
      where: { tenantId: "ws_1" },
    });
    expect(mocks.mockCalendarEventCount).toHaveBeenCalledWith({
      where: { tenantId: "ws_1" },
    });
  });
});

describe("features/limits caching", () => {
  it("caches features so a second call does not re-query", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlan({ allowedModules: ["tasks"] })
    );

    await getWorkspaceFeatures("ws_1");
    await getWorkspaceFeatures("ws_1");

    expect(mocks.mockWorkspaceFindUnique).toHaveBeenCalledTimes(1);
  });

  it("caches limits so a second call does not re-query", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_1", planId: "p_1", resource: "users", limit: 5, behavior: "hard" },
      ])
    );

    await getWorkspaceLimits("ws_1");
    await getWorkspaceLimits("ws_1");

    expect(mocks.mockWorkspaceFindUnique).toHaveBeenCalledTimes(1);
  });

  it("keeps features and limits in separate caches", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_1", planId: "p_1", resource: "users", limit: 5, behavior: "hard" },
      ])
    );

    await getWorkspaceFeatures("ws_1");
    await getWorkspaceLimits("ws_1");

    expect(mocks.mockWorkspaceFindUnique).toHaveBeenCalledTimes(2);
  });

  it("keeps distinct cache entries per workspace", async () => {
    mocks.mockWorkspaceFindUnique.mockImplementation(async ({ where }) =>
      makePlan({
        allowedModules: where.id === "ws_a" ? ["tasks"] : ["contracts"],
      })
    );

    await getWorkspaceFeatures("ws_a");
    await getWorkspaceFeatures("ws_b");
    await getWorkspaceFeatures("ws_a");
    await getWorkspaceFeatures("ws_b");

    expect(mocks.mockWorkspaceFindUnique).toHaveBeenCalledTimes(2);
  });

  it("re-queries after the cache TTL expires", async () => {
    vi.useFakeTimers();
    try {
      mocks.mockWorkspaceFindUnique.mockResolvedValue(
        makePlan({ allowedModules: ["tasks"] })
      );

      await getWorkspaceFeatures("ws_1");
      vi.advanceTimersByTime(31_000);
      await getWorkspaceFeatures("ws_1");

      expect(mocks.mockWorkspaceFindUnique).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

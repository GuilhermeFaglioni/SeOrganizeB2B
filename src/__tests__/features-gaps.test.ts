import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockWorkspaceFindUnique: vi.fn(),
  mockTaskCount: vi.fn(),
  mockProfileCount: vi.fn(),
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
    task: { count: mocks.mockTaskCount },
    profile: { count: mocks.mockProfileCount },
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
  checkFeature,
  checkLimit,
  countWorkspaceUsage,
  getWorkspaceFeatures,
  getWorkspaceLimits,
  clearCache,
  clearFeaturesCache,
  clearLimitsCache,
  clearAllCaches,
} from "../lib/features";

function makePlanLimits(planLimits: unknown[]) {
  return { plan: { allowedModules: [], planLimits } };
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

describe("checkFeature (gaps)", () => {
  it("returns false when the plan is null", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue({ plan: null });

    await expect(checkFeature("ws_1", "tasks")).resolves.toBe(false);
  });
});

describe("checkLimit (gaps)", () => {
  it("returns a blocked result when a hard limit is exactly reached", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_1", planId: "p_1", resource: "tasks", limit: 3, behavior: "hard" },
      ])
    );
    mocks.mockTaskCount.mockResolvedValue(3);

    const result = await checkLimit("ws_1", "tasks");
    expect(result).toEqual({ remaining: 0, limit: 3, behavior: "hard" });
  });

  it("reports a warning behavior for a low remaining warning limit", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_2", planId: "p_1", resource: "tasks", limit: 50, behavior: "warning" },
      ])
    );
    mocks.mockTaskCount.mockResolvedValue(48);

    const result = await checkLimit("ws_1", "tasks");
    expect(result).toEqual({ remaining: 2, limit: 50, behavior: "warning" });
  });

  it("treats a resource without a counter as unused", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_1", planId: "p_1", resource: "reports", limit: 5, behavior: "hard" },
      ])
    );

    const result = await checkLimit("ws_1", "reports");
    expect(result).toEqual({ remaining: 5, limit: 5, behavior: "hard" });
    expect(mocks.mockWithTenant).not.toHaveBeenCalled();
  });

  it("maps any non-hard behavior to warning", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(
      makePlanLimits([
        { id: "pl_1", planId: "p_1", resource: "tasks", limit: 10, behavior: "soft" },
      ])
    );
    mocks.mockTaskCount.mockResolvedValue(0);

    const result = await checkLimit("ws_1", "tasks");
    expect(result.behavior).toBe("warning");
  });
});

describe("countWorkspaceUsage (gaps)", () => {
  it("counts every resource under the tenant scope", async () => {
    mocks.mockProfileCount.mockResolvedValue(1);
    mocks.mockTaskCount.mockResolvedValue(2);
    mocks.mockProjectCount.mockResolvedValue(3);
    mocks.mockContractCount.mockResolvedValue(4);
    mocks.mockClientCount.mockResolvedValue(5);
    mocks.mockProposalCount.mockResolvedValue(6);
    mocks.mockDocumentCount.mockResolvedValue(7);
    mocks.mockCalendarEventCount.mockResolvedValue(8);

    const usage = await countWorkspaceUsage("ws_1");

    expect(usage).toEqual({
      users: 1,
      tasks: 2,
      projects: 3,
      contracts: 4,
      clients: 5,
      proposals: 6,
      documents: 7,
      calendarEvents: 8,
    });
    expect(mocks.mockProfileCount).toHaveBeenCalledWith({
      where: { tenantId: "ws_1" },
    });
    expect(mocks.mockCalendarEventCount).toHaveBeenCalledWith({
      where: { tenantId: "ws_1" },
    });
  });
});

describe("cache invalidation (gaps)", () => {
  it("clearFeaturesCache forces a re-query of features", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue({
      plan: { allowedModules: ["tasks"], planLimits: [] },
    });

    await getWorkspaceFeatures("ws_1");
    clearFeaturesCache("ws_1");
    await getWorkspaceFeatures("ws_1");

    expect(mocks.mockWorkspaceFindUnique).toHaveBeenCalledTimes(2);
  });

  it("clearLimitsCache forces a re-query of limits", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(makePlanLimits([]));

    await getWorkspaceLimits("ws_1");
    clearLimitsCache("ws_1");
    await getWorkspaceLimits("ws_1");

    expect(mocks.mockWorkspaceFindUnique).toHaveBeenCalledTimes(2);
  });

  it("clearCache clears both feature and limit caches", async () => {
    mocks.mockWorkspaceFindUnique.mockResolvedValue(makePlanLimits([]));

    await getWorkspaceFeatures("ws_1");
    await getWorkspaceLimits("ws_1");
    clearCache("ws_1");
    await getWorkspaceFeatures("ws_1");
    await getWorkspaceLimits("ws_1");

    expect(mocks.mockWorkspaceFindUnique).toHaveBeenCalledTimes(4);
  });

  it("re-queries limits after the cache TTL expires", async () => {
    vi.useFakeTimers();
    try {
      mocks.mockWorkspaceFindUnique.mockResolvedValue(makePlanLimits([]));

      await getWorkspaceLimits("ws_1");
      vi.advanceTimersByTime(31_000);
      await getWorkspaceLimits("ws_1");

      expect(mocks.mockWorkspaceFindUnique).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
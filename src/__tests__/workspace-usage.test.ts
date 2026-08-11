import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockProfileFindUnique: vi.fn(),
  mockProfileCount: vi.fn(),
  mockProfileFindMany: vi.fn(),
  mockTaskCount: vi.fn(),
  mockTaskFindMany: vi.fn(),
  mockProjectCount: vi.fn(),
  mockProjectFindMany: vi.fn(),
  mockContractCount: vi.fn(),
  mockContractFindMany: vi.fn(),
  mockClientCount: vi.fn(),
  mockClientFindMany: vi.fn(),
  mockProposalCount: vi.fn(),
  mockProposalFindMany: vi.fn(),
  mockDocumentCount: vi.fn(),
  mockDocumentFindMany: vi.fn(),
  mockCalendarEventCount: vi.fn(),
  mockCalendarEventFindMany: vi.fn(),
  mockWithTenant: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.mockGetUser,
}));

vi.mock("../../prisma/client", () => ({
  prisma: {
    profile: {
      findUnique: mocks.mockProfileFindUnique,
      count: mocks.mockProfileCount,
      findMany: mocks.mockProfileFindMany,
    },
    task: {
      count: mocks.mockTaskCount,
      findMany: mocks.mockTaskFindMany,
    },
    project: {
      count: mocks.mockProjectCount,
      findMany: mocks.mockProjectFindMany,
    },
    contract: {
      count: mocks.mockContractCount,
      findMany: mocks.mockContractFindMany,
    },
    client: {
      count: mocks.mockClientCount,
      findMany: mocks.mockClientFindMany,
    },
    proposal: {
      count: mocks.mockProposalCount,
      findMany: mocks.mockProposalFindMany,
    },
    document: {
      count: mocks.mockDocumentCount,
      findMany: mocks.mockDocumentFindMany,
    },
    calendarEvent: {
      count: mocks.mockCalendarEventCount,
      findMany: mocks.mockCalendarEventFindMany,
    },
  },
  withTenant: mocks.mockWithTenant,
  withTenantBypass: vi.fn(async (fn: () => unknown) => fn()),
}));

import { GET } from "../app/api/workspace/usage/route";

const makeUser = () => ({ id: "user_1", email: "owner@acme.com" });

const COUNT_VALUES = {
  users: 3,
  tasks: 47,
  projects: 8,
  contracts: 2,
  clients: 5,
  proposals: 1,
  documents: 12,
  calendarEvents: 23,
};

function stubCounts() {
  mocks.mockProfileCount.mockResolvedValue(COUNT_VALUES.users);
  mocks.mockTaskCount.mockResolvedValue(COUNT_VALUES.tasks);
  mocks.mockProjectCount.mockResolvedValue(COUNT_VALUES.projects);
  mocks.mockContractCount.mockResolvedValue(COUNT_VALUES.contracts);
  mocks.mockClientCount.mockResolvedValue(COUNT_VALUES.clients);
  mocks.mockProposalCount.mockResolvedValue(COUNT_VALUES.proposals);
  mocks.mockDocumentCount.mockResolvedValue(COUNT_VALUES.documents);
  mocks.mockCalendarEventCount.mockResolvedValue(COUNT_VALUES.calendarEvents);
}

describe("GET /api/workspace/usage", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => {
      if (typeof mock === "function") mock.mockReset();
    });
    mocks.mockGetUser.mockResolvedValue(makeUser());
    mocks.mockProfileFindUnique.mockResolvedValue({ tenantId: "ws_1" });
    mocks.mockWithTenant.mockImplementation(
      async (_tenantId: string, fn: () => unknown) => fn()
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the current count of every resource in the workspace", async () => {
    stubCounts();

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toEqual(COUNT_VALUES);
    expect(json.error).toBeNull();
  });

  it("counts every resource inside a tenant scope", async () => {
    stubCounts();

    await GET();

    expect(mocks.mockWithTenant).toHaveBeenCalled();
    for (const mock of [
      mocks.mockProfileCount,
      mocks.mockTaskCount,
      mocks.mockProjectCount,
      mocks.mockContractCount,
      mocks.mockClientCount,
      mocks.mockProposalCount,
      mocks.mockDocumentCount,
      mocks.mockCalendarEventCount,
    ]) {
      expect(mock).toHaveBeenCalledWith({ where: { tenantId: "ws_1" } });
      expect(mock).toHaveBeenCalledTimes(1);
    }
  });

  it("uses count(), never findMany().length, to compute usage", async () => {
    stubCounts();
    for (const mock of [
      mocks.mockProfileFindMany,
      mocks.mockTaskFindMany,
      mocks.mockProjectFindMany,
      mocks.mockContractFindMany,
      mocks.mockClientFindMany,
      mocks.mockProposalFindMany,
      mocks.mockDocumentFindMany,
      mocks.mockCalendarEventFindMany,
    ]) {
      mock.mockResolvedValue([{}, {}, {}]);
    }

    const res = await GET();
    const json = await res.json();
    expect(json.data).toEqual(COUNT_VALUES);

    for (const mock of [
      mocks.mockProfileFindMany,
      mocks.mockTaskFindMany,
      mocks.mockProjectFindMany,
      mocks.mockContractFindMany,
      mocks.mockClientFindMany,
      mocks.mockProposalFindMany,
      mocks.mockDocumentFindMany,
      mocks.mockCalendarEventFindMany,
    ]) {
      expect(mock).not.toHaveBeenCalled();
    }
  });

  it("returns 401 when unauthenticated", async () => {
    mocks.mockGetUser.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    expect(mocks.mockProfileFindUnique).not.toHaveBeenCalled();
    expect(mocks.mockTaskCount).not.toHaveBeenCalled();
  });

  it("returns 404 when the user has no workspace", async () => {
    mocks.mockProfileFindUnique.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(404);
    expect(mocks.mockTaskCount).not.toHaveBeenCalled();
  });
});
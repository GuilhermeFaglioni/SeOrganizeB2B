import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prismaClient: {
    closedBetaCheckinEdition: { findUnique: vi.fn() },
    closedBetaEnrollment: { findUnique: vi.fn() },
    profile: { findUnique: vi.fn() },
    closedBetaCheckinResponse: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    closedBetaCheckinWorkspaceState: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof mocks.prismaClient) => Promise<unknown>) => fn(mocks.prismaClient)),
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    closedBetaAuditEvent: { create: vi.fn() },
  },
}));

vi.mock("../../prisma/client", () => ({
  prisma: mocks.prismaClient,
}));

vi.mock("node:crypto", () => ({
  randomUUID: () => "uuid-1",
}));

import { submitCheckinResponse } from "../lib/closed-beta/checkin";

const edition = {
  id: "ed-1",
  status: "published",
  opensAt: new Date("2026-08-01"),
  closesAt: null,
  questions: [],
};
const enrollment = { status: "active" };
const profileA = { tenantId: "ws-1", removedAt: null };
const profileB = { tenantId: "ws-1", removedAt: null };

function p2002Error() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed",
    { code: "P2002", clientVersion: "5.0.0", meta: { target: ["edition_id", "profile_id"] } },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prismaClient.closedBetaCheckinEdition.findUnique.mockResolvedValue(edition);
  mocks.prismaClient.closedBetaEnrollment.findUnique.mockResolvedValue(enrollment);
  mocks.prismaClient.profile.findUnique.mockResolvedValue(profileA);
  mocks.prismaClient.closedBetaCheckinWorkspaceState.update.mockResolvedValue({});
});

describe("check-in real concurrency via P2002", () => {
  it("two concurrent submissions for the same member: second recovers from P2002 as duplicate", async () => {
    // Both findUnique calls return null (no prior response)
    mocks.prismaClient.closedBetaCheckinResponse.findFirst
      .mockResolvedValue(null);

    // FOR UPDATE returns pending state for both
    mocks.prismaClient.$queryRaw.mockResolvedValue([
      { id: "state-1", status: "pending", exemption_expires_at: null },
    ]);

    // First create succeeds, second throws P2002
    let createCallCount = 0;
    mocks.prismaClient.closedBetaCheckinResponse.create.mockImplementation(
      async () => {
        createCallCount++;
        if (createCallCount === 1) {
          return { id: "resp-1", editionId: "ed-1", workspaceId: "ws-1", profileId: "user-a", answers: {}, isPrimary: true, createdAt: new Date(), updatedAt: new Date() };
        }
        throw p2002Error();
      },
    );

    // Recovery path: findUnique returns the existing response, findUnique on state returns completed
    mocks.prismaClient.closedBetaCheckinResponse.findFirst
      .mockResolvedValueOnce(null) // first findUnique in txn
      .mockResolvedValueOnce(null) // second findUnique in txn (P2002 recovery)
      .mockResolvedValue({ id: "resp-1", editionId: "ed-1", workspaceId: "ws-1", profileId: "user-a", answers: {}, isPrimary: true, createdAt: new Date(), updatedAt: new Date() }); // recovery findUnique

    mocks.prismaClient.closedBetaCheckinWorkspaceState.findUnique
      .mockResolvedValue(null) // first call (no state yet)
      .mockResolvedValue({ id: "state-1", status: "completed", exemptionExpiresAt: null }); // recovery call

    // Fire two concurrent submissions
    const [resultA, resultB] = await Promise.all([
      submitCheckinResponse({
        editionId: "ed-1",
        workspaceId: "ws-1",
        profileId: "user-a",
        answers: {},
        didNotUse: true,
        actor: { userId: "user-a", email: "a@co" },
      }),
      submitCheckinResponse({
        editionId: "ed-1",
        workspaceId: "ws-1",
        profileId: "user-a",
        answers: {},
        didNotUse: true,
        actor: { userId: "user-a", email: "a@co" },
      }),
    ]);

    // Exactly one of them completed the workspace; the other recovered as duplicate
    const results = [resultA, resultB];
    const duplicates = results.filter((r) => r.duplicate);
    const completers = results.filter((r) => r.completedWorkspace && !r.duplicate);

    // One should have completed, one should be duplicate
    expect(completers).toHaveLength(1);
    expect(duplicates).toHaveLength(1);

    // The duplicate result must include the existing response
    expect(duplicates[0].response).toBeDefined();
    expect(duplicates[0].response.id).toBe("resp-1");

    // Workspace state update happened exactly once (first-wins)
    expect(mocks.prismaClient.closedBetaCheckinWorkspaceState.update).toHaveBeenCalledTimes(1);
    expect(mocks.prismaClient.closedBetaCheckinWorkspaceState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "completed" }),
      }),
    );
  });

  it("two concurrent submissions for different members: second sees completed state via FOR UPDATE", async () => {
    // Both findUnique return null (no prior response for either member)
    mocks.prismaClient.closedBetaCheckinResponse.findFirst
      .mockResolvedValue(null);

    // Simulate FOR UPDATE serialization: first call sees pending, second sees completed
    let queryRawCallCount = 0;
    mocks.prismaClient.$queryRaw.mockImplementation(async () => {
      queryRawCallCount++;
      if (queryRawCallCount === 1) {
        return [{ id: "state-1", status: "pending", exemption_expires_at: null }];
      }
      return [{ id: "state-1", status: "completed", exemption_expires_at: null }];
    });

    // Both create succeed (different profileIds, no P2002)
    let createCount = 0;
    mocks.prismaClient.closedBetaCheckinResponse.create.mockImplementation(
      async (data: Record<string, unknown>) => {
        createCount++;
        return {
          id: `resp-${createCount}`,
          editionId: "ed-1",
          workspaceId: "ws-1",
          profileId: (data.data as Record<string, unknown>).profileId,
          answers: {},
          isPrimary: createCount === 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
    );

    mocks.prismaClient.closedBetaCheckinWorkspaceState.findUnique
      .mockResolvedValue(null);

    const [resultA, resultB] = await Promise.all([
      submitCheckinResponse({
        editionId: "ed-1",
        workspaceId: "ws-1",
        profileId: "user-a",
        answers: {},
        actor: { userId: "user-a", email: "a@co" },
      }),
      submitCheckinResponse({
        editionId: "ed-1",
        workspaceId: "ws-1",
        profileId: "user-b",
        answers: {},
        actor: { userId: "user-b", email: "b@co" },
      }),
    ]);

    // Neither is a duplicate (different profileIds, both created)
    expect(resultA.duplicate).toBe(false);
    expect(resultB.duplicate).toBe(false);

    // Exactly one completed the workspace (first sees pending → completes; second sees completed → skips)
    const completers = [resultA, resultB].filter((r) => r.completedWorkspace);
    expect(completers).toHaveLength(1);

    // State update happened exactly once (first-wins)
    expect(mocks.prismaClient.closedBetaCheckinWorkspaceState.update).toHaveBeenCalledTimes(1);
  });

  it("same member re-submission finds existing response without P2002 (pre-check path)", async () => {
    // First findUnique returns null, second returns existing
    mocks.prismaClient.closedBetaCheckinResponse.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "resp-1", editionId: "ed-1", workspaceId: "ws-1", profileId: "user-a", answers: {}, isPrimary: true, createdAt: new Date(), updatedAt: new Date() });

    mocks.prismaClient.closedBetaCheckinWorkspaceState.findUnique.mockResolvedValue({
      id: "state-1",
      status: "completed",
    });

    mocks.prismaClient.$queryRaw.mockResolvedValue([
      { id: "state-1", status: "completed", exemption_expires_at: null },
    ]);
    mocks.prismaClient.closedBetaCheckinResponse.create.mockImplementation(
      async (data: Record<string, unknown>) => ({
        id: "resp-new",
        editionId: "ed-1",
        workspaceId: "ws-1",
        profileId: "user-a",
        answers: {},
        isPrimary: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    mocks.prismaClient.closedBetaCheckinWorkspaceState.update.mockResolvedValue({});

    const result1 = await submitCheckinResponse({
      editionId: "ed-1",
      workspaceId: "ws-1",
      profileId: "user-a",
      answers: {},
      actor: { userId: "user-a", email: "a@co" },
    });

    expect(result1.duplicate).toBe(false);

    const result2 = await submitCheckinResponse({
      editionId: "ed-1",
      workspaceId: "ws-1",
      profileId: "user-a",
      answers: {},
      actor: { userId: "user-a", email: "a@co" },
    });

    // Second submission returns duplicate via pre-check path
    expect(result2.duplicate).toBe(true);
    expect(result2.completedWorkspace).toBe(true);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  prismaClient: {
    closedBetaCheckinEdition: { findUnique: vi.fn() },
    closedBetaEnrollment: { findUnique: vi.fn() },
    profile: { findUnique: vi.fn() },
    closedBetaCheckinResponse: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    closedBetaCheckinWorkspaceState: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (fn: unknown) => fn(mocks.prismaClient)),
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prismaClient.closedBetaCheckinEdition.findUnique.mockResolvedValue(edition);
  mocks.prismaClient.closedBetaEnrollment.findUnique.mockResolvedValue(enrollment);
  mocks.prismaClient.profile.findUnique.mockResolvedValue(profileA);
});

describe("check-in concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prismaClient.closedBetaCheckinEdition.findUnique.mockResolvedValue(edition);
    mocks.prismaClient.closedBetaEnrollment.findUnique.mockResolvedValue(enrollment);
    mocks.prismaClient.profile.findUnique.mockResolvedValue(profileA);
  });

  it("second member submission does not double-complete the workspace", async () => {
    // First member: no existing response, state is pending → unlocks workspace
    mocks.prismaClient.closedBetaCheckinResponse.findUnique
      .mockResolvedValueOnce(null) // member A: inside transaction
      .mockResolvedValueOnce(null); // member B: inside transaction

    let callCount = 0;
    mocks.prismaClient.$queryRaw.mockImplementation(async (sql: unknown) => {
      callCount++;
      return [{ id: "state-1", status: callCount <= 1 ? "pending" : "completed", exemption_expires_at: null }];
    });

    mocks.prismaClient.closedBetaCheckinResponse.create.mockImplementation(async (data: Record<string, unknown>) => {
      return { id: `resp-${callCount}`, ...data.data };
    });

    mocks.prismaClient.closedBetaCheckinWorkspaceState.update.mockResolvedValue({});

    const resultA = await submitCheckinResponse({
      editionId: "ed-1",
      workspaceId: "ws-1",
      profileId: "user-a",
      answers: {},
      actor: { userId: "user-a", email: "a@co" },
    });

    expect(resultA.completedWorkspace).toBe(true);
    expect(resultA.duplicate).toBe(false);

    mocks.prismaClient.profile.findUnique.mockResolvedValue(profileB);

    const resultB = await submitCheckinResponse({
      editionId: "ed-1",
      workspaceId: "ws-1",
      profileId: "user-b",
      answers: {},
      actor: { userId: "user-b", email: "b@co" },
    });

    // Second member: workspace already completed → isPrimary=false, no double-update
    expect(resultB.completedWorkspace).toBe(false);
    expect(resultB.duplicate).toBe(false);

    // State update should only happen once (for member A's unlock)
    expect(mocks.prismaClient.closedBetaCheckinWorkspaceState.update).toHaveBeenCalledTimes(1);
  });

  it("handles idempotent re-submission via existing response check", async () => {
    // Same member submits twice: findUnique is called once per submission inside transaction
    mocks.prismaClient.closedBetaCheckinResponse.findUnique
      .mockResolvedValueOnce(null) // first submission: no existing
      .mockResolvedValueOnce({ id: "resp-1" }); // second submission: finds existing

    mocks.prismaClient.closedBetaCheckinWorkspaceState.findUnique.mockResolvedValue({
      id: "state-1",
      status: "completed",
    });

    // For the first submission, we need the full transaction path
    mocks.prismaClient.$queryRaw.mockResolvedValue([{ id: "state-1", status: "completed", exemption_expires_at: null }]);
    mocks.prismaClient.closedBetaCheckinResponse.create.mockImplementation(async (data: Record<string, unknown>) => ({
      id: "resp-new",
      ...data.data,
    }));
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

    // The second submission finds the existing response and returns duplicate
    expect(result2.duplicate).toBe(true);
    expect(result2.completedWorkspace).toBe(true); // workspace was completed by first submission
  });
});

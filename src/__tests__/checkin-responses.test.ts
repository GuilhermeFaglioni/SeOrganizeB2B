import { beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.hoisted(() => ({ recordClosedBetaAudit: vi.fn() }));

const prismaMock = vi.hoisted(() => {
  const prisma = {
    closedBetaCheckinEdition: {
      findUnique: vi.fn(),
    },
    closedBetaCheckinResponse: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    closedBetaCheckinWorkspaceState: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    closedBetaEnrollment: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((fn: unknown) =>
    (fn as (client: unknown) => unknown)(prisma),
  );
  return prisma;
});

vi.mock("../../prisma/client", () => ({ prisma: prismaMock }));
vi.mock("../lib/closed-beta/service", () => ({
  recordClosedBetaAudit: auditMock.recordClosedBetaAudit,
}));

import {
  exportCheckinResponses,
  getCheckinEditionMetrics,
  getCheckinResponseGrouping,
  listCheckinResponses,
} from "../lib/closed-beta/responses";
import { resetCheckinResponse } from "../lib/closed-beta/checkin";

const edition = {
  id: "edition-1",
  title: "Check-in Semana 1",
  status: "published",
  createdAt: new Date("2026-08-18T09:00:00Z"),
  questions: [
    {
      id: "q-rating",
      text: "Como avalia o valor?",
      type: "rating",
      options: null,
      required: true,
      position: 1,
      theme: "value",
      isSuggestionQuestion: false,
    },
    {
      id: "q-suggestion",
      text: "Qual funcionalidade você adicionaria?",
      type: "short_text",
      options: null,
      required: true,
      position: 2,
      theme: "features",
      isSuggestionQuestion: true,
    },
  ],
};

const actor = { userId: "admin-1", email: "admin@example.com" };

function resetMocks(node: unknown) {
  if (!node) return;
  if (typeof (node as { mockReset?: unknown }).mockReset === "function") {
    (node as { mockReset: () => void }).mockReset();
    return;
  }
  if (typeof node !== "object") return;
  for (const value of Object.values(node as Record<string, unknown>)) resetMocks(value);
}

beforeEach(() => {
  resetMocks(prismaMock);
  auditMock.recordClosedBetaAudit.mockReset();
  auditMock.recordClosedBetaAudit.mockResolvedValue(undefined);
  prismaMock.closedBetaCheckinWorkspaceState.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.closedBetaEnrollment.findMany.mockResolvedValue([]);
  prismaMock.$transaction.mockImplementation((fn: unknown) =>
    (fn as (client: unknown) => unknown)(prismaMock),
  );
});

describe("listCheckinResponses", () => {
  it("lists responses scoped to the edition with company and responder info", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(edition);
    prismaMock.closedBetaCheckinResponse.findMany.mockResolvedValue([
      {
        id: "r1",
        editionId: "edition-1",
        workspaceId: "w1",
        profileId: "p1",
        isPrimary: true,
        createdAt: new Date("2026-08-18T10:00:00Z"),
        answers: { "q-rating": 5 },
        workspace: { id: "w1", name: "Acme", slug: "acme" },
        profile: { id: "p1", email: "a@acme.com", name: "Ana" },
      },
    ]);
    prismaMock.closedBetaCheckinWorkspaceState.findMany.mockResolvedValue([
      { workspaceId: "w1", status: "completed" },
    ]);

    const rows = await listCheckinResponses({ editionId: "edition-1" });

    expect(rows).toHaveLength(1);
    expect(rows[0].workspaceName).toBe("Acme");
    expect(rows[0].responderEmail).toBe("a@acme.com");
    expect(rows[0].workspaceStatus).toBe("completed");
    expect(prismaMock.closedBetaCheckinResponse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ editionId: "edition-1" }) }),
    );
  });

  it("throws when the edition does not exist", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(null);
    await expect(listCheckinResponses({ editionId: "missing" })).rejects.toThrow();
  });

  it("includes active companies that have not submitted a response", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(edition);
    prismaMock.closedBetaCheckinResponse.findMany.mockResolvedValue([]);
    prismaMock.closedBetaCheckinWorkspaceState.findMany.mockResolvedValue([]);
    prismaMock.closedBetaEnrollment.findMany.mockResolvedValue([
      {
        workspaceId: "w2",
        workspace: { id: "w2", name: "Beta Co" },
        owner: { id: "p2", email: "owner@beta.co", name: "Bia" },
      },
    ]);

    const rows = await listCheckinResponses({ editionId: "edition-1" });

    expect(rows).toEqual([
      expect.objectContaining({
        id: "pending:edition-1:w2",
        workspaceId: "w2",
        workspaceName: "Beta Co",
        responderEmail: "owner@beta.co",
        createdAt: null,
        workspaceStatus: "pending",
      }),
    ]);
  });
});

describe("getCheckinResponseGrouping", () => {
  it("groups answers by question, skipping unanswered questions", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(edition);
    prismaMock.closedBetaCheckinResponse.findMany.mockResolvedValue([
      {
        id: "r1",
        workspaceId: "w1",
        answers: { "q-rating": 5 },
        workspace: { id: "w1", name: "Acme" },
      },
    ]);

    const grouped = await getCheckinResponseGrouping("edition-1");

    expect(grouped).toHaveLength(2);
    const rating = grouped.find((g) => g.questionId === "q-rating");
    expect(rating?.responses).toHaveLength(1);
    expect(rating?.responses[0].value).toBe(5);
    const suggestion = grouped.find((g) => g.questionId === "q-suggestion");
    expect(suggestion?.responses).toHaveLength(0);
  });
});

describe("getCheckinEditionMetrics", () => {
  it("computes completion rate and average response time", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(edition);
    prismaMock.closedBetaCheckinWorkspaceState.findMany.mockResolvedValue([
      {
        status: "completed",
        completedAt: new Date("2026-08-18T10:00:00Z"),
        createdAt: new Date("2026-08-18T09:00:00Z"),
      },
      { status: "pending", completedAt: null, createdAt: new Date("2026-08-18T09:00:00Z") },
    ]);
    prismaMock.closedBetaCheckinResponse.findMany.mockResolvedValue([
      { createdAt: new Date("2026-08-18T10:00:00Z") },
    ]);
    prismaMock.closedBetaEnrollment.count.mockResolvedValue(2);

    const metrics = await getCheckinEditionMetrics("edition-1");

    expect(metrics.completed).toBe(1);
    expect(metrics.pending).toBe(1);
    expect(metrics.completionRate).toBe(50);
    expect(metrics.averageResponseSeconds).toBe(3600);
  });
});

describe("exportCheckinResponses", () => {
  it("flattens responses into one row per question answer", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(edition);
    prismaMock.closedBetaCheckinResponse.findMany.mockResolvedValue([
      {
        id: "r1",
        workspaceId: "w1",
        answers: { "q-rating": 5, "q-suggestion": "Integração" },
        createdAt: new Date("2026-08-18T10:00:00Z"),
        workspace: { name: "Acme" },
        profile: { email: "a@acme.com" },
      },
    ]);

    const rows = await exportCheckinResponses("edition-1");

    expect(rows).toHaveLength(2);
    expect(rows[0].questionText).toBe("Como avalia o valor?");
    expect(rows[0].answer).toBe("5");
    expect(rows[1].answer).toBe("Integração");
  });
});

describe("resetCheckinResponse", () => {
  it("reopens a completed workspace while preserving the historical responses", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue({ id: "edition-1", status: "published" });
    prismaMock.closedBetaCheckinWorkspaceState.findUnique.mockResolvedValue({
      id: "state-1",
      editionId: "edition-1",
      workspaceId: "w1",
      status: "completed",
      completedByProfileId: "p1",
      completedAt: new Date("2026-08-18T10:00:00Z"),
    });
    prismaMock.closedBetaCheckinResponse.findMany.mockResolvedValue([
      { id: "r1", profileId: "p1", isPrimary: true, createdAt: new Date() },
    ]);
    prismaMock.closedBetaCheckinWorkspaceState.update.mockResolvedValue({
      id: "state-1",
      status: "pending",
    });

    const result = await resetCheckinResponse("edition-1", "w1", actor);

    expect(result.state.status).toBe("pending");
    expect(result.preservedResponses).toEqual(["r1"]);
    expect(prismaMock.closedBetaCheckinWorkspaceState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "pending", completedAt: null }),
      }),
    );
    expect(prismaMock.closedBetaCheckinResponse.updateMany).toHaveBeenCalledWith({
      where: { editionId: "edition-1", workspaceId: "w1", isCurrent: true },
      data: { isCurrent: false },
    });
    expect(auditMock.recordClosedBetaAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "checkin.response.reset" }),
    );
  });

  it("refuses to reset a workspace that is not completed", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue({ id: "edition-1", status: "published" });
    prismaMock.closedBetaCheckinWorkspaceState.findUnique.mockResolvedValue({
      id: "state-1",
      status: "pending",
    });

    await expect(resetCheckinResponse("edition-1", "w1", actor)).rejects.toThrow();
    expect(prismaMock.closedBetaCheckinWorkspaceState.update).not.toHaveBeenCalled();
  });
});

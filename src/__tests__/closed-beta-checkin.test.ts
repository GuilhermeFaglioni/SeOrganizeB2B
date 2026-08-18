import { beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.hoisted(() => ({ recordClosedBetaAudit: vi.fn() }));

const prismaMock = vi.hoisted(() => {
  const prisma = {
    closedBetaCheckinEdition: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    closedBetaCheckinQuestion: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    closedBetaCheckinResponse: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    closedBetaCheckinWorkspaceState: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    closedBetaEnrollment: {
      findUnique: vi.fn(),
    },
    profile: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
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
  CheckinConflictError,
  CheckinEditionClosedError,
  CheckinValidationError,
  createCheckinEdition,
  publishCheckinEdition,
  closeCheckinEdition,
  grantCheckinExemption,
  invalidateActiveCheckinEditionCache,
  revokeCheckinExemption,
  getCheckinEditionPhase,
  getWorkspaceCheckin,
  submitCheckinResponse,
} from "../lib/closed-beta/checkin";

const suggestionQuestion = {
  id: "q-suggestion",
  text: "Qual funcionalidade você adicionaria?",
  type: "short_text",
  required: true,
  position: 0,
  theme: "features",
  isSuggestionQuestion: true,
} as const;

function editionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "edition-1",
    title: "Check-in Semana 1",
    status: "draft",
    isMandatory: true,
    opensAt: null,
    closesAt: null,
    createdAt: new Date("2026-08-18T09:00:00Z"),
    updatedAt: new Date("2026-08-18T09:00:00Z"),
    ...overrides,
  };
}

function publishedEdition(overrides: Record<string, unknown> = {}) {
  return editionRow({
    status: "published",
    opensAt: new Date("2026-08-10T00:00:00Z"),
    closesAt: new Date("2026-08-17T00:00:00Z"),
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
      suggestionQuestion,
    ],
    ...overrides,
  });
}

const actor = { userId: "admin-1", email: "admin@example.com" };

function resetMocks(node: unknown) {
  if (!node) return;
  if (typeof (node as { mockReset?: unknown }).mockReset === "function") {
    (node as { mockReset: () => void }).mockReset();
    return;
  }
  if (typeof node !== "object") return;
  for (const value of Object.values(node as Record<string, unknown>)) {
    resetMocks(value);
  }
}

beforeEach(() => {
  resetMocks(prismaMock);
  auditMock.recordClosedBetaAudit.mockReset();
  invalidateActiveCheckinEditionCache();
  prismaMock.$transaction.mockImplementation((fn: unknown) =>
    (fn as (client: unknown) => unknown)(prismaMock),
  );
  prismaMock.$executeRaw.mockResolvedValue(undefined);
  auditMock.recordClosedBetaAudit.mockResolvedValue(undefined);
});

describe("check-in edition phase", () => {
  it("classifies upcoming, open and overdue phases for a published edition", () => {
    const now = new Date("2026-08-18T12:00:00Z");
    expect(
      getCheckinEditionPhase(
        { status: "published", opensAt: new Date("2026-08-19T00:00:00Z"), closesAt: new Date("2026-08-25T00:00:00Z") },
        now,
      ),
    ).toBe("upcoming");
    expect(
      getCheckinEditionPhase(
        { status: "published", opensAt: new Date("2026-08-17T00:00:00Z"), closesAt: new Date("2026-08-19T00:00:00Z") },
        now,
      ),
    ).toBe("open");
    expect(
      getCheckinEditionPhase(
        { status: "published", opensAt: new Date("2026-08-10T00:00:00Z"), closesAt: new Date("2026-08-17T00:00:00Z") },
        now,
      ),
    ).toBe("overdue");
    expect(
      getCheckinEditionPhase(
        { status: "draft", opensAt: null, closesAt: null },
        now,
      ),
    ).toBeNull();
  });
});

describe("createCheckinEdition", () => {
  it("creates a draft with ordered questions and records an audit event", async () => {
    prismaMock.closedBetaCheckinEdition.create.mockResolvedValue(
      editionRow({ id: "edition-new" }),
    );
    prismaMock.closedBetaCheckinQuestion.createMany.mockResolvedValue({ count: 2 });
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(
      editionRow({
        id: "edition-new",
        questions: [
          { ...suggestionQuestion, editionId: "edition-new" },
        ],
      }),
    );

    const edition = await createCheckinEdition(
      {
        title: "Check-in Semana 1",
        questions: [suggestionQuestion],
      },
      actor,
    );

    expect(edition.status).toBe("draft");
    expect(prismaMock.closedBetaCheckinEdition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "draft", isMandatory: true }),
      }),
    );
    expect(prismaMock.closedBetaCheckinQuestion.createMany).toHaveBeenCalled();
    expect(auditMock.recordClosedBetaAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "checkin.edition.created" }),
    );
  });

  it("rejects an edition without questions", async () => {
    await expect(
      createCheckinEdition({ title: "Vazio", questions: [] }, actor),
    ).rejects.toBeInstanceOf(CheckinValidationError);
  });

  it("rejects a choice question without options", async () => {
    await expect(
      createCheckinEdition(
        {
          title: "Escolha",
          questions: [{ text: "Qual?", type: "single_choice" }],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(CheckinValidationError);
  });
});

describe("publishCheckinEdition", () => {
  it("publishes an edition with a suggestion question and audits it", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(
      publishedEdition({ status: "draft", opensAt: null, closesAt: null }),
    );
    prismaMock.closedBetaCheckinEdition.findFirst.mockResolvedValue(null);
    prismaMock.closedBetaCheckinEdition.update.mockResolvedValue(
      publishedEdition(),
    );
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(
      publishedEdition(),
    );

    const edition = await publishCheckinEdition(
      "edition-1",
      {
        opensAt: new Date("2026-08-19T00:00:00Z"),
        closesAt: new Date("2026-08-25T00:00:00Z"),
      },
      actor,
    );

    expect(edition.status).toBe("published");
    expect(prismaMock.closedBetaCheckinEdition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "published" }),
      }),
    );
    expect(auditMock.recordClosedBetaAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "checkin.edition.published" }),
    );
  });

  it("blocks publication without a suggestion question", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(
      publishedEdition({
        status: "draft",
        opensAt: null,
        closesAt: null,
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
        ],
      }),
    );

    await expect(
      publishCheckinEdition("edition-1", {}, actor),
    ).rejects.toBeInstanceOf(CheckinValidationError);
    expect(prismaMock.closedBetaCheckinEdition.update).not.toHaveBeenCalled();
  });

  it("prevents a second published mandatory edition", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(
      publishedEdition({ status: "draft", opensAt: null, closesAt: null }),
    );
    prismaMock.closedBetaCheckinEdition.findFirst.mockResolvedValue(
      editionRow({ id: "edition-other", status: "published" }),
    );

    await expect(
      publishCheckinEdition("edition-1", {}, actor),
    ).rejects.toBeInstanceOf(CheckinConflictError);
  });
});

describe("closeCheckinEdition", () => {
  it("closes a published edition", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(
      publishedEdition(),
    );
    prismaMock.closedBetaCheckinEdition.update.mockResolvedValue(
      publishedEdition({ status: "closed" }),
    );

    const edition = await closeCheckinEdition("edition-1", actor);
    expect(edition.status).toBe("closed");
    expect(auditMock.recordClosedBetaAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "checkin.edition.closed" }),
    );
  });

  it("rejects closing a draft", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(
      editionRow(),
    );
    await expect(closeCheckinEdition("edition-1", actor)).rejects.toBeInstanceOf(
      CheckinValidationError,
    );
  });
});

describe("submitCheckinResponse", () => {
  const validAnswers = {
    "q-rating": 5,
    "q-suggestion": "Integração com WhatsApp",
  };

  beforeEach(() => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(
      publishedEdition(),
    );
    prismaMock.closedBetaEnrollment.findUnique.mockResolvedValue({
      status: "active",
    });
    prismaMock.profile.findUnique.mockResolvedValue({
      tenantId: "workspace-1",
      removedAt: null,
    });
  });

  it("completes the workspace with the first valid response", async () => {
    prismaMock.closedBetaCheckinResponse.findUnique.mockResolvedValue(null);
    prismaMock.$queryRaw.mockResolvedValue([
      { id: "state-1", status: "pending", exemption_expires_at: null },
    ]);
    prismaMock.closedBetaCheckinResponse.create.mockResolvedValue({
      id: "response-1",
      editionId: "edition-1",
      workspaceId: "workspace-1",
      profileId: "profile-1",
      isPrimary: true,
    });
    prismaMock.closedBetaCheckinWorkspaceState.update.mockResolvedValue({
      status: "completed",
    });

    const result = await submitCheckinResponse({
      editionId: "edition-1",
      workspaceId: "workspace-1",
      profileId: "profile-1",
      answers: validAnswers,
      actor,
    });

    expect(result.completedWorkspace).toBe(true);
    expect(result.workspaceStatus).toBe("completed");
    expect(prismaMock.closedBetaCheckinResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPrimary: true, profileId: "profile-1" }),
      }),
    );
    expect(prismaMock.closedBetaCheckinWorkspaceState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "completed",
          completedByProfileId: "profile-1",
        }),
      }),
    );
    expect(auditMock.recordClosedBetaAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "checkin.response.completed" }),
    );
  });

  it("stores an optional response when the company is already complete", async () => {
    prismaMock.closedBetaCheckinResponse.findUnique.mockResolvedValue(null);
    prismaMock.$queryRaw.mockResolvedValue([
      { id: "state-1", status: "completed", exemption_expires_at: null },
    ]);
    prismaMock.closedBetaCheckinResponse.create.mockResolvedValue({
      id: "response-2",
      isPrimary: false,
    });

    const result = await submitCheckinResponse({
      editionId: "edition-1",
      workspaceId: "workspace-1",
      profileId: "profile-2",
      answers: validAnswers,
      actor,
    });

    expect(result.completedWorkspace).toBe(false);
    expect(result.workspaceStatus).toBe("completed");
    expect(prismaMock.closedBetaCheckinResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPrimary: false }),
      }),
    );
    expect(prismaMock.closedBetaCheckinWorkspaceState.update).not.toHaveBeenCalled();
  });

  it("is idempotent for the same member and edition", async () => {
    prismaMock.closedBetaCheckinResponse.findUnique.mockResolvedValue({
      id: "response-1",
      isPrimary: true,
    });
    prismaMock.closedBetaCheckinWorkspaceState.findUnique.mockResolvedValue({
      status: "completed",
    });

    const result = await submitCheckinResponse({
      editionId: "edition-1",
      workspaceId: "workspace-1",
      profileId: "profile-1",
      answers: validAnswers,
      actor,
    });

    expect(result.duplicate).toBe(true);
    expect(prismaMock.closedBetaCheckinResponse.create).not.toHaveBeenCalled();
  });

  it("rejects submissions for a workspace outside the beta", async () => {
    prismaMock.closedBetaEnrollment.findUnique.mockResolvedValue(null);

    await expect(
      submitCheckinResponse({
        editionId: "edition-1",
        workspaceId: "workspace-1",
        profileId: "profile-1",
        answers: validAnswers,
        actor,
      }),
    ).rejects.toBeInstanceOf(CheckinValidationError);
  });

  it("rejects submissions missing required questions", async () => {
    await expect(
      submitCheckinResponse({
        editionId: "edition-1",
        workspaceId: "workspace-1",
        profileId: "profile-1",
        answers: { "q-rating": 5 },
        actor,
      }),
    ).rejects.toBeInstanceOf(CheckinValidationError);
  });

  it("rejects a rating outside the allowed range", async () => {
    await expect(
      submitCheckinResponse({
        editionId: "edition-1",
        workspaceId: "workspace-1",
        profileId: "profile-1",
        answers: { "q-rating": 99, "q-suggestion": "x" },
        actor,
      }),
    ).rejects.toBeInstanceOf(CheckinValidationError);
  });

  it("accepts an empty answer as a no-suggestion response", async () => {
    prismaMock.closedBetaCheckinResponse.findUnique.mockResolvedValue(null);
    prismaMock.$queryRaw.mockResolvedValue([
      { id: "state-1", status: "pending", exemption_expires_at: null },
    ]);
    prismaMock.closedBetaCheckinResponse.create.mockResolvedValue({
      id: "response-1",
      isPrimary: true,
    });

    const result = await submitCheckinResponse({
      editionId: "edition-1",
      workspaceId: "workspace-1",
      profileId: "profile-1",
      answers: { "q-rating": 5, "q-suggestion": "" },
      actor,
    });

    expect(result.completedWorkspace).toBe(true);
  });

  it("accepts a did-not-use submission without required answers", async () => {
    prismaMock.closedBetaCheckinResponse.findUnique.mockResolvedValue(null);
    prismaMock.$queryRaw.mockResolvedValue([
      { id: "state-1", status: "pending", exemption_expires_at: null },
    ]);
    prismaMock.closedBetaCheckinResponse.create.mockResolvedValue({
      id: "response-1",
      isPrimary: true,
    });

    const result = await submitCheckinResponse({
      editionId: "edition-1",
      workspaceId: "workspace-1",
      profileId: "profile-1",
      answers: {},
      didNotUse: true,
      actor,
    });

    expect(result.completedWorkspace).toBe(true);
    expect(prismaMock.closedBetaCheckinResponse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          answers: expect.objectContaining({ __did_not_use__: true }),
        }),
      }),
    );
  });

  it("rejects submissions for a closed edition", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(
      publishedEdition({ status: "closed" }),
    );

    await expect(
      submitCheckinResponse({
        editionId: "edition-1",
        workspaceId: "workspace-1",
        profileId: "profile-1",
        answers: validAnswers,
        actor,
      }),
    ).rejects.toBeInstanceOf(CheckinEditionClosedError);
  });
});

describe("getWorkspaceCheckin", () => {
  const now = new Date("2026-08-18T12:00:00Z");

  beforeEach(() => {
    prismaMock.closedBetaCheckinEdition.findFirst.mockResolvedValue(
      publishedEdition(),
    );
    prismaMock.closedBetaEnrollment.findUnique.mockResolvedValue({
      status: "active",
    });
  });

  it("reports blocked when an overdue edition is still pending", async () => {
    prismaMock.closedBetaCheckinWorkspaceState.findUnique.mockResolvedValue(null);

    const status = await getWorkspaceCheckin("workspace-1", now);
    expect(status.blocked).toBe(true);
    expect(status.phase).toBe("overdue");
    expect(status.workspaceStatus).toBe("pending");
  });

  it("does not block a completed workspace", async () => {
    prismaMock.closedBetaCheckinWorkspaceState.findUnique.mockResolvedValue({
      status: "completed",
    });

    const status = await getWorkspaceCheckin("workspace-1", now);
    expect(status.blocked).toBe(false);
    expect(status.workspaceStatus).toBe("completed");
  });

  it("does not block a workspace with a valid exemption", async () => {
    prismaMock.closedBetaCheckinWorkspaceState.findUnique.mockResolvedValue({
      status: "exempt",
      exemptionExpiresAt: new Date("2026-08-25T00:00:00Z"),
    });

    const status = await getWorkspaceCheckin("workspace-1", now);
    expect(status.blocked).toBe(false);
    expect(status.workspaceStatus).toBe("exempt");
  });

  it("blocks a workspace whose exemption has expired", async () => {
    prismaMock.closedBetaCheckinWorkspaceState.findUnique.mockResolvedValue({
      status: "exempt",
      exemptionExpiresAt: new Date("2026-08-17T00:00:00Z"),
    });

    const status = await getWorkspaceCheckin("workspace-1", now);
    expect(status.blocked).toBe(true);
    expect(status.workspaceStatus).toBe("pending");
  });

  it("never blocks a workspace outside the beta", async () => {
    prismaMock.closedBetaEnrollment.findUnique.mockResolvedValue(null);

    const status = await getWorkspaceCheckin("workspace-1", now);
    expect(status.blocked).toBe(false);
    expect(status.workspaceStatus).toBe("not_applicable");
  });

  it("reports not applicable when there is no active edition", async () => {
    prismaMock.closedBetaCheckinEdition.findFirst.mockResolvedValue(null);

    const status = await getWorkspaceCheckin("workspace-1", now);
    expect(status.blocked).toBe(false);
    expect(status.editionId).toBeNull();
    expect(status.workspaceStatus).toBe("not_applicable");
  });
});

describe("check-in exemptions", () => {
  it("grants a temporary exemption with reason, expiry and audit", async () => {
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue(
      editionRow({ status: "published" }),
    );
    prismaMock.closedBetaCheckinWorkspaceState.upsert.mockResolvedValue({
      status: "exempt",
      exemptionReason: "Suporte",
      exemptionExpiresAt: new Date("2026-08-25T00:00:00Z"),
    });

    const state = await grantCheckinExemption({
      editionId: "edition-1",
      workspaceId: "workspace-1",
      reason: "Suporte",
      expiresAt: new Date("2026-08-25T00:00:00Z"),
      actor,
    });

    expect(state.status).toBe("exempt");
    expect(prismaMock.closedBetaCheckinWorkspaceState.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "exempt" }),
      }),
    );
    expect(auditMock.recordClosedBetaAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "checkin.exemption.granted" }),
    );
  });

  it("requires a reason and an expiration date", async () => {
    await expect(
      grantCheckinExemption({
        editionId: "edition-1",
        workspaceId: "workspace-1",
        reason: "",
        expiresAt: new Date("2026-08-25T00:00:00Z"),
        actor,
      }),
    ).rejects.toBeInstanceOf(CheckinValidationError);
  });

  it("revokes an active exemption", async () => {
    prismaMock.closedBetaCheckinWorkspaceState.findUnique.mockResolvedValue({
      id: "state-1",
      status: "exempt",
    });
    prismaMock.closedBetaCheckinWorkspaceState.update.mockResolvedValue({
      status: "pending",
    });

    const state = await revokeCheckinExemption("edition-1", "workspace-1", actor);
    expect(state.status).toBe("pending");
    expect(auditMock.recordClosedBetaAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "checkin.exemption.revoked" }),
    );
  });
});

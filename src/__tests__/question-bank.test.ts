import { beforeEach, describe, expect, it, vi } from "vitest";

const auditMock = vi.hoisted(() => ({ recordClosedBetaAudit: vi.fn() }));

const prismaMock = vi.hoisted(() => {
  const prisma = {
    closedBetaQuestionBank: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    closedBetaCheckinEdition: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    closedBetaCheckinQuestion: {
      createMany: vi.fn(),
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
vi.mock("../lib/closed-beta/question-bank", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/closed-beta/question-bank")>();
  return {
    ...actual,
    getActiveQuestionBankItems: vi.fn(),
  };
});

import {
  QuestionBankValidationError,
  createQuestionBankItem,
  listQuestionBankItems,
  setQuestionBankItemStatus,
  updateQuestionBankItem,
} from "../lib/closed-beta/question-bank";
import { getActiveQuestionBankItems } from "../lib/closed-beta/question-bank";
import { createCheckinEdition, duplicateCheckinEdition } from "../lib/closed-beta/checkin";

const actor = { userId: "admin-1", email: "admin@example.com" };

function bankRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "bank-1",
    text: "Como avalia o valor?",
    type: "rating",
    options: null,
    required: true,
    theme: "value",
    isSuggestionQuestion: false,
    status: "active",
    createdAt: new Date("2026-08-18T09:00:00Z"),
    updatedAt: new Date("2026-08-18T09:00:00Z"),
    ...overrides,
  };
}

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
  (getActiveQuestionBankItems as ReturnType<typeof vi.fn>).mockReset();
  prismaMock.$transaction.mockImplementation((fn: unknown) =>
    (fn as (client: unknown) => unknown)(prismaMock),
  );
});

describe("question bank CRUD", () => {
  it("creates an active question bank item and records an audit event", async () => {
    prismaMock.closedBetaQuestionBank.create.mockResolvedValue(bankRow());

    const item = await createQuestionBankItem(
      { text: "Como avalia o valor?", type: "rating", theme: "value" },
      actor,
    );

    expect(item.status).toBe("active");
    expect(item.theme).toBe("value");
    expect(prismaMock.closedBetaQuestionBank.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "active" }) }),
    );
    expect(auditMock.recordClosedBetaAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "question_bank.created" }),
    );
  });

  it("rejects unsupported question types", async () => {
    await expect(
      createQuestionBankItem({ text: "X", type: "bogus" }, actor),
    ).rejects.toBeInstanceOf(QuestionBankValidationError);
  });

  it("rejects choice questions without options", async () => {
    await expect(
      createQuestionBankItem({ text: "Qual?", type: "single_choice" }, actor),
    ).rejects.toBeInstanceOf(QuestionBankValidationError);
  });

  it("rejects choice questions whose options are only whitespace", async () => {
    await expect(
      createQuestionBankItem(
        { text: "Qual?", type: "single_choice", options: ["  "] },
        actor,
      ),
    ).rejects.toBeInstanceOf(QuestionBankValidationError);
  });

  it("rejects a suggestion question with a non-text type", async () => {
    await expect(
      createQuestionBankItem(
        { text: "Qual?", type: "rating", isSuggestionQuestion: true },
        actor,
      ),
    ).rejects.toBeInstanceOf(QuestionBankValidationError);
  });

  it("updates a question bank item and preserves the id", async () => {
    prismaMock.closedBetaQuestionBank.findUnique.mockResolvedValue(bankRow());
    prismaMock.closedBetaQuestionBank.update.mockResolvedValue(
      bankRow({ text: "Novo texto" }),
    );

    const item = await updateQuestionBankItem(
      "bank-1",
      { text: "Novo texto", type: "rating" },
      actor,
    );

    expect(item.text).toBe("Novo texto");
    expect(auditMock.recordClosedBetaAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "question_bank.updated" }),
    );
  });

  it("refuses to edit an archived question", async () => {
    prismaMock.closedBetaQuestionBank.findUnique.mockResolvedValue(
      bankRow({ status: "archived" }),
    );

    await expect(
      updateQuestionBankItem("bank-1", { text: "X", type: "rating" }, actor),
    ).rejects.toBeInstanceOf(QuestionBankValidationError);
  });

  it("archives and restores a question bank item", async () => {
    prismaMock.closedBetaQuestionBank.findUnique.mockResolvedValue(bankRow());
    prismaMock.closedBetaQuestionBank.update.mockResolvedValue(
      bankRow({ status: "archived" }),
    );

    const item = await setQuestionBankItemStatus("bank-1", "archived", actor);
    expect(item.status).toBe("archived");
    expect(auditMock.recordClosedBetaAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "question_bank.archived" }),
    );
  });

  it("lists question bank items", async () => {
    prismaMock.closedBetaQuestionBank.findMany.mockResolvedValue([
      bankRow(),
      bankRow({ id: "bank-2", theme: "onboarding" }),
    ]);

    const items = await listQuestionBankItems();
    expect(items).toHaveLength(2);
  });
});

describe("edition composition from the bank", () => {
  it("creates an edition by snapshotting selected bank questions", async () => {
    (getActiveQuestionBankItems as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "bank-1",
        text: "Como avalia o valor?",
        type: "rating",
        options: null,
        required: true,
        theme: "value",
        isSuggestionQuestion: false,
      },
    ]);
    prismaMock.closedBetaCheckinEdition.create.mockResolvedValue({
      id: "edition-new",
      title: "Check-in Semana 1",
      status: "draft",
      isMandatory: true,
    });
    prismaMock.closedBetaCheckinQuestion.createMany.mockResolvedValue({ count: 1 });
    prismaMock.closedBetaCheckinEdition.findUnique.mockResolvedValue({
      id: "edition-new",
      title: "Check-in Semana 1",
      status: "draft",
      isMandatory: true,
      questions: [],
    });

    const edition = await createCheckinEdition(
      { title: "Check-in Semana 1", questionBankIds: ["bank-1"] },
      actor,
    );

    expect(prismaMock.closedBetaCheckinQuestion.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ text: "Como avalia o valor?", theme: "value" }),
        ]),
      }),
    );
    expect(edition.status).toBe("draft");
  });

  it("rejects an edition when a selected bank question is not available", async () => {
    (getActiveQuestionBankItems as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await expect(
      createCheckinEdition({ title: "X", questionBankIds: ["bank-missing"] }, actor),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe("duplicateCheckinEdition", () => {
  it("copies an edition and its questions as a new draft without touching the source", async () => {
    const source = {
      id: "edition-1",
      title: "Check-in Semana 1",
      status: "published",
      isMandatory: true,
      questions: [
        {
          id: "q-rating",
          editionId: "edition-1",
          text: "Como avalia o valor?",
          type: "rating",
          options: null,
          required: true,
          position: 1,
          theme: "value",
          isSuggestionQuestion: false,
        },
      ],
    };
    prismaMock.closedBetaCheckinEdition.findUnique
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce({
        id: "edition-dup",
        title: "Check-in Semana 1 (cópia)",
        status: "draft",
        isMandatory: true,
        questions: [],
      });
    prismaMock.closedBetaCheckinEdition.create.mockResolvedValue({
      id: "edition-dup",
      title: "Check-in Semana 1 (cópia)",
      status: "draft",
      isMandatory: true,
    });
    prismaMock.closedBetaCheckinQuestion.createMany.mockResolvedValue({ count: 1 });

    const duplicate = await duplicateCheckinEdition("edition-1", actor);

    expect(duplicate.id).toBe("edition-dup");
    expect(prismaMock.closedBetaCheckinEdition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "draft", title: "Check-in Semana 1 (cópia)" }),
      }),
    );
    expect(prismaMock.closedBetaCheckinQuestion.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ text: "Como avalia o valor?" }),
        ]),
      }),
    );
    expect(auditMock.recordClosedBetaAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "checkin.edition.duplicated" }),
    );
  });
});
